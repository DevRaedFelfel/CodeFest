using CodeFest.Api.Data;
using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Services;

public class AdminService
{
    private readonly CodeFestDbContext _db;
    private readonly FileImportService _fileImport;

    public AdminService(CodeFestDbContext db, FileImportService fileImport)
    {
        _db = db;
        _fileImport = fileImport;
    }

    // --- Users ---

    public async Task<PaginatedResponse<UserResponse>> GetUsersAsync(string? role, string? search, int page = 1, int pageSize = 20)
    {
        var query = _db.Users.AsQueryable();

        if (!string.IsNullOrEmpty(role) && Enum.TryParse<UserRole>(role, true, out var roleEnum))
            query = query.Where(u => u.Role == roleEnum);

        if (!string.IsNullOrEmpty(search))
            query = query.Where(u => u.DisplayName.Contains(search) || u.Email.Contains(search));

        var totalCount = await query.CountAsync();
        var users = await query
            .OrderBy(u => u.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserResponse(u.Id, u.Email, u.DisplayName, u.Role.ToString(), u.PictureUrl, u.IsActive, u.CreatedAt, u.LastLoginAt))
            .ToListAsync();

        return new PaginatedResponse<UserResponse>(users, totalCount, page, pageSize);
    }

    public async Task<UserResponse?> CreateUserAsync(CreateUserRequest request)
    {
        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
            return null;

        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
            return null;

        var user = new User
        {
            Email = request.Email,
            DisplayName = request.DisplayName,
            Role = role,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return new UserResponse(user.Id, user.Email, user.DisplayName, user.Role.ToString(), user.PictureUrl, user.IsActive, user.CreatedAt, user.LastLoginAt);
    }

    public async Task<UserResponse?> UpdateUserAsync(int id, UpdateUserRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return null;

        if (request.DisplayName != null) user.DisplayName = request.DisplayName;
        if (request.Role != null && Enum.TryParse<UserRole>(request.Role, true, out var role)) user.Role = role;
        if (request.IsActive.HasValue) user.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync();
        return new UserResponse(user.Id, user.Email, user.DisplayName, user.Role.ToString(), user.PictureUrl, user.IsActive, user.CreatedAt, user.LastLoginAt);
    }

    public async Task<bool> DeactivateUserAsync(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return false;
        user.IsActive = false;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<ImportResult> ImportUsersAsync(IFormFile file)
    {
        var rows = await _fileImport.ParseFileAsync<UserImportRow>(file);
        int imported = 0, skipped = 0;
        var errors = new List<ImportError>();

        for (int i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (string.IsNullOrWhiteSpace(row.Email) || !row.Email.Contains('@'))
            {
                errors.Add(new ImportError(i + 2, $"Invalid email: {row.Email}"));
                continue;
            }
            if (!Enum.TryParse<UserRole>(row.Role, true, out var role))
            {
                errors.Add(new ImportError(i + 2, $"Invalid role: {row.Role}"));
                continue;
            }
            if (await _db.Users.AnyAsync(u => u.Email == row.Email))
            {
                skipped++;
                continue;
            }
            _db.Users.Add(new User
            {
                Email = row.Email,
                DisplayName = row.DisplayName,
                Role = role,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            });
            imported++;
        }

        await _db.SaveChangesAsync();
        return new ImportResult(imported, skipped, errors);
    }

    // --- Courses ---

    public async Task<List<CourseResponse>> GetCoursesAsync()
    {
        return await _db.Courses
            .Include(c => c.Instructor)
            .Select(c => new CourseResponse(
                c.Id, c.Code, c.Name, c.Description,
                c.InstructorId, c.Instructor.DisplayName,
                c.IsActive, c.CreatedAt,
                c.Enrollments.Count(e => e.Status == EnrollmentStatus.Active),
                c.Sessions.Count))
            .ToListAsync();
    }

    public async Task<CourseResponse?> CreateCourseAsync(CreateCourseRequest request)
    {
        var instructor = await _db.Users.FindAsync(request.InstructorId);
        if (instructor == null || (instructor.Role != UserRole.Instructor && instructor.Role != UserRole.SuperAdmin))
            return null;

        if (await _db.Courses.AnyAsync(c => c.Code == request.Code))
            return null;

        var course = new Course
        {
            Code = request.Code,
            Name = request.Name,
            Description = request.Description,
            InstructorId = request.InstructorId,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.Courses.Add(course);
        await _db.SaveChangesAsync();

        return new CourseResponse(course.Id, course.Code, course.Name, course.Description,
            course.InstructorId, instructor.DisplayName, course.IsActive, course.CreatedAt, 0, 0);
    }

    public async Task<CourseResponse?> UpdateCourseAsync(int id, UpdateCourseRequest request)
    {
        var course = await _db.Courses.Include(c => c.Instructor).FirstOrDefaultAsync(c => c.Id == id);
        if (course == null) return null;

        if (request.Code != null) course.Code = request.Code;
        if (request.Name != null) course.Name = request.Name;
        if (request.Description != null) course.Description = request.Description;
        if (request.InstructorId.HasValue) course.InstructorId = request.InstructorId.Value;
        if (request.IsActive.HasValue) course.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync();

        var studentCount = await _db.Enrollments.CountAsync(e => e.CourseId == id && e.Status == EnrollmentStatus.Active);
        var sessionCount = await _db.Sessions.CountAsync(s => s.CourseId == id);

        return new CourseResponse(course.Id, course.Code, course.Name, course.Description,
            course.InstructorId, course.Instructor.DisplayName, course.IsActive, course.CreatedAt,
            studentCount, sessionCount);
    }

    public async Task<bool> DeactivateCourseAsync(int id)
    {
        var course = await _db.Courses.FindAsync(id);
        if (course == null) return false;
        course.IsActive = false;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<ImportResult> ImportCoursesAsync(IFormFile file)
    {
        var rows = await _fileImport.ParseFileAsync<CourseImportRow>(file);
        int imported = 0, skipped = 0;
        var errors = new List<ImportError>();

        for (int i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (string.IsNullOrWhiteSpace(row.Code))
            {
                errors.Add(new ImportError(i + 2, "Missing course code"));
                continue;
            }
            var instructor = await _db.Users.FirstOrDefaultAsync(u => u.Email == row.InstructorEmail);
            if (instructor == null)
            {
                errors.Add(new ImportError(i + 2, $"Instructor not found: {row.InstructorEmail}"));
                continue;
            }
            if (await _db.Courses.AnyAsync(c => c.Code == row.Code))
            {
                skipped++;
                continue;
            }
            _db.Courses.Add(new Course
            {
                Code = row.Code,
                Name = row.Name,
                Description = string.IsNullOrEmpty(row.Description) ? null : row.Description,
                InstructorId = instructor.Id,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            });
            imported++;
        }

        await _db.SaveChangesAsync();
        return new ImportResult(imported, skipped, errors);
    }

    // --- Enrollments ---

    public async Task<PaginatedResponse<EnrollmentResponse>> GetEnrollmentsAsync(int? courseId, string? status, int page = 1, int pageSize = 20)
    {
        var query = _db.Enrollments
            .Include(e => e.Student)
            .Include(e => e.Course)
            .AsQueryable();

        if (courseId.HasValue)
            query = query.Where(e => e.CourseId == courseId.Value);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<EnrollmentStatus>(status, true, out var statusEnum))
            query = query.Where(e => e.Status == statusEnum);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(e => e.EnrolledAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new EnrollmentResponse(
                e.Id, e.StudentId, e.Student.DisplayName, e.Student.Email,
                e.CourseId, e.Course.Code, e.Course.Name,
                e.Status.ToString(), e.EnrolledAt))
            .ToListAsync();

        return new PaginatedResponse<EnrollmentResponse>(items, totalCount, page, pageSize);
    }

    public async Task<EnrollmentResponse?> CreateEnrollmentAsync(CreateEnrollmentRequest request)
    {
        if (await _db.Enrollments.AnyAsync(e => e.StudentId == request.StudentId && e.CourseId == request.CourseId))
            return null;

        var student = await _db.Users.FindAsync(request.StudentId);
        var course = await _db.Courses.FindAsync(request.CourseId);
        if (student == null || course == null) return null;

        var enrollment = new Enrollment
        {
            StudentId = request.StudentId,
            CourseId = request.CourseId,
            Status = EnrollmentStatus.Active,
            EnrolledAt = DateTime.UtcNow
        };

        _db.Enrollments.Add(enrollment);
        await _db.SaveChangesAsync();

        return new EnrollmentResponse(enrollment.Id, student.Id, student.DisplayName, student.Email,
            course.Id, course.Code, course.Name, enrollment.Status.ToString(), enrollment.EnrolledAt);
    }

    public async Task<bool> DeleteEnrollmentAsync(int id)
    {
        var enrollment = await _db.Enrollments.FindAsync(id);
        if (enrollment == null) return false;
        enrollment.Status = EnrollmentStatus.Dropped;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<ImportResult> ImportEnrollmentsAsync(IFormFile file)
    {
        var rows = await _fileImport.ParseFileAsync<EnrollmentImportRow>(file);
        int imported = 0, skipped = 0;
        var errors = new List<ImportError>();

        for (int i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            var student = await _db.Users.FirstOrDefaultAsync(u => u.Email == row.StudentEmail);
            if (student == null)
            {
                errors.Add(new ImportError(i + 2, $"Student not found: {row.StudentEmail}"));
                continue;
            }
            var course = await _db.Courses.FirstOrDefaultAsync(c => c.Code == row.CourseCode);
            if (course == null)
            {
                errors.Add(new ImportError(i + 2, $"Course not found: {row.CourseCode}"));
                continue;
            }
            if (await _db.Enrollments.AnyAsync(e => e.StudentId == student.Id && e.CourseId == course.Id))
            {
                skipped++;
                continue;
            }
            _db.Enrollments.Add(new Enrollment
            {
                StudentId = student.Id,
                CourseId = course.Id,
                Status = EnrollmentStatus.Active,
                EnrolledAt = DateTime.UtcNow
            });
            imported++;
        }

        await _db.SaveChangesAsync();
        return new ImportResult(imported, skipped, errors);
    }

    // --- Enrollment Requests ---

    public async Task<PaginatedResponse<EnrollmentRequestResponse>> GetEnrollmentRequestsAsync(int? courseId, string? status, int page = 1, int pageSize = 20)
    {
        var query = _db.EnrollmentRequests
            .Include(er => er.Student)
            .Include(er => er.Course)
            .AsQueryable();

        if (courseId.HasValue)
            query = query.Where(er => er.CourseId == courseId.Value);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<EnrollmentRequestStatus>(status, true, out var statusEnum))
            query = query.Where(er => er.Status == statusEnum);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(er => er.RequestedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(er => new EnrollmentRequestResponse(
                er.Id, er.StudentUserId, er.Student.DisplayName, er.Student.Email,
                er.CourseId, er.Course.Code, er.Course.Name,
                er.Status.ToString(), er.RequestedAt, er.ReviewedAt))
            .ToListAsync();

        return new PaginatedResponse<EnrollmentRequestResponse>(items, totalCount, page, pageSize);
    }

    public async Task<bool> ReviewEnrollmentRequestAsync(int id, string status, int reviewerUserId)
    {
        var request = await _db.EnrollmentRequests.FindAsync(id);
        if (request == null || !Enum.TryParse<EnrollmentRequestStatus>(status, true, out var statusEnum))
            return false;

        request.Status = statusEnum;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewedByUserId = reviewerUserId;

        if (statusEnum == EnrollmentRequestStatus.Approved)
        {
            if (!await _db.Enrollments.AnyAsync(e => e.StudentId == request.StudentUserId && e.CourseId == request.CourseId))
            {
                _db.Enrollments.Add(new Enrollment
                {
                    StudentId = request.StudentUserId,
                    CourseId = request.CourseId,
                    Status = EnrollmentStatus.Active,
                    EnrolledAt = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync();
        return true;
    }

    // --- Academic Loads ---

    public async Task<List<AcademicLoadResponse>> GetAcademicLoadsAsync()
    {
        return await _db.AcademicLoads
            .Include(al => al.Instructor)
            .Include(al => al.Course)
            .Select(al => new AcademicLoadResponse(
                al.Id, al.InstructorId, al.Instructor.DisplayName,
                al.CourseId, al.Course.Code, al.Course.Name,
                al.Term, al.IsActive, al.AssignedAt))
            .ToListAsync();
    }

    public async Task<AcademicLoadResponse?> CreateAcademicLoadAsync(CreateAcademicLoadRequest request)
    {
        if (await _db.AcademicLoads.AnyAsync(al => al.InstructorId == request.InstructorId && al.CourseId == request.CourseId))
            return null;

        var instructor = await _db.Users.FindAsync(request.InstructorId);
        var course = await _db.Courses.FindAsync(request.CourseId);
        if (instructor == null || course == null) return null;

        var load = new AcademicLoad
        {
            InstructorId = request.InstructorId,
            CourseId = request.CourseId,
            Term = request.Term,
            IsActive = true,
            AssignedAt = DateTime.UtcNow
        };

        _db.AcademicLoads.Add(load);
        await _db.SaveChangesAsync();

        return new AcademicLoadResponse(load.Id, instructor.Id, instructor.DisplayName,
            course.Id, course.Code, course.Name, load.Term, load.IsActive, load.AssignedAt);
    }

    public async Task<AcademicLoadResponse?> UpdateAcademicLoadAsync(int id, UpdateAcademicLoadRequest request)
    {
        var load = await _db.AcademicLoads
            .Include(al => al.Instructor)
            .Include(al => al.Course)
            .FirstOrDefaultAsync(al => al.Id == id);
        if (load == null) return null;

        if (request.Term != null) load.Term = request.Term;
        if (request.IsActive.HasValue) load.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync();

        return new AcademicLoadResponse(load.Id, load.InstructorId, load.Instructor.DisplayName,
            load.CourseId, load.Course.Code, load.Course.Name, load.Term, load.IsActive, load.AssignedAt);
    }

    public async Task<bool> DeleteAcademicLoadAsync(int id)
    {
        var load = await _db.AcademicLoads.FindAsync(id);
        if (load == null) return false;
        _db.AcademicLoads.Remove(load);
        await _db.SaveChangesAsync();
        return true;
    }
}
