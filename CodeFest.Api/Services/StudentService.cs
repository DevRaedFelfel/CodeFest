using CodeFest.Api.Data;
using CodeFest.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Services;

public class StudentService
{
    private readonly CodeFestDbContext _db;

    public StudentService(CodeFestDbContext db)
    {
        _db = db;
    }

    public async Task<List<object>> GetEnrolledCoursesAsync(int userId)
    {
        var enrollments = await _db.Enrollments
            .Where(e => e.StudentId == userId && e.Status == EnrollmentStatus.Active)
            .Include(e => e.Course)
                .ThenInclude(c => c.Instructor)
            .ToListAsync();

        var result = new List<object>();

        foreach (var e in enrollments)
        {
            var activeSession = await _db.Sessions
                .Where(s => s.CourseId == e.CourseId && (s.Status == SessionStatus.Lobby || s.Status == SessionStatus.Active))
                .Select(s => new { s.Code })
                .FirstOrDefaultAsync();

            result.Add(new
            {
                id = e.Course.Id,
                code = e.Course.Code,
                name = e.Course.Name,
                description = e.Course.Description,
                instructorName = e.Course.Instructor.DisplayName,
                hasActiveSession = activeSession != null,
                activeSessionCode = activeSession?.Code
            });
        }

        return result;
    }

    public async Task<object?> GetCourseAsync(int courseId, int userId)
    {
        var enrolled = await _db.Enrollments
            .AnyAsync(e => e.StudentId == userId && e.CourseId == courseId && e.Status == EnrollmentStatus.Active);
        if (!enrolled) return null;

        var course = await _db.Courses.Include(c => c.Instructor).FirstOrDefaultAsync(c => c.Id == courseId);
        if (course == null) return null;

        return new
        {
            course.Id,
            course.Code,
            course.Name,
            course.Description,
            instructorName = course.Instructor.DisplayName
        };
    }

    public async Task<(bool success, string error)> RequestEnrollmentAsync(int userId, int courseId)
    {
        if (await _db.Enrollments.AnyAsync(e => e.StudentId == userId && e.CourseId == courseId && e.Status == EnrollmentStatus.Active))
            return (false, "Already enrolled");

        if (await _db.EnrollmentRequests.AnyAsync(er => er.StudentUserId == userId && er.CourseId == courseId && er.Status == EnrollmentRequestStatus.Pending))
            return (false, "Request already pending");

        var course = await _db.Courses.FindAsync(courseId);
        if (course == null) return (false, "Course not found");

        _db.EnrollmentRequests.Add(new EnrollmentRequest
        {
            StudentUserId = userId,
            CourseId = courseId,
            Status = EnrollmentRequestStatus.Pending,
            RequestedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return (true, "");
    }

    public async Task<List<object>> GetActiveSessionsAsync(int userId)
    {
        var enrolledCourseIds = await _db.Enrollments
            .Where(e => e.StudentId == userId && e.Status == EnrollmentStatus.Active)
            .Select(e => e.CourseId)
            .ToListAsync();

        return await _db.Sessions
            .Where(s => s.CourseId.HasValue && enrolledCourseIds.Contains(s.CourseId.Value)
                && (s.Status == SessionStatus.Lobby || s.Status == SessionStatus.Active))
            .Include(s => s.Course)
            .Select(s => (object)new
            {
                s.Id, s.Code, s.Name, Status = s.Status.ToString(),
                s.CreatedAt,
                courseCode = s.Course != null ? s.Course.Code : "",
                courseName = s.Course != null ? s.Course.Name : ""
            })
            .ToListAsync();
    }

    public async Task<List<object>> GetHistoryAsync(int userId, int? courseId)
    {
        IQueryable<SessionParticipant> query = _db.SessionParticipants
            .Where(sp => sp.UserId == userId)
            .Include(sp => sp.Session)
                .ThenInclude(s => s.Course);

        if (courseId.HasValue)
            query = query.Where(sp => sp.Session.CourseId == courseId.Value);

        return await query
            .OrderByDescending(sp => sp.JoinedAt)
            .Select(sp => (object)new
            {
                sessionName = sp.Session.Name,
                sessionCode = sp.Session.Code,
                courseCode = sp.Session.Course != null ? sp.Session.Code : "",
                sp.TotalPoints,
                sp.JoinedAt,
                status = sp.Session.Status.ToString()
            })
            .ToListAsync();
    }
}
