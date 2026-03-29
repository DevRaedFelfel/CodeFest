using CodeFest.Api.Data;
using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Services;

public class InstructorService
{
    private readonly CodeFestDbContext _db;
    private readonly QrCodeService _qrService;

    public InstructorService(CodeFestDbContext db, QrCodeService qrService)
    {
        _db = db;
        _qrService = qrService;
    }

    public async Task<List<CourseResponse>> GetInstructorCoursesAsync(int userId)
    {
        return await _db.Courses
            .Where(c => c.InstructorId == userId && c.IsActive)
            .Include(c => c.Instructor)
            .Select(c => new CourseResponse(
                c.Id, c.Code, c.Name, c.Description,
                c.InstructorId, c.Instructor.DisplayName,
                c.IsActive, c.CreatedAt,
                c.Enrollments.Count(e => e.Status == EnrollmentStatus.Active),
                c.Sessions.Count))
            .ToListAsync();
    }

    public async Task<CourseResponse?> GetCourseAsync(int courseId, int userId)
    {
        var course = await _db.Courses
            .Include(c => c.Instructor)
            .FirstOrDefaultAsync(c => c.Id == courseId && c.InstructorId == userId);

        if (course == null) return null;

        var studentCount = await _db.Enrollments.CountAsync(e => e.CourseId == courseId && e.Status == EnrollmentStatus.Active);
        var sessionCount = await _db.Sessions.CountAsync(s => s.CourseId == courseId);

        return new CourseResponse(course.Id, course.Code, course.Name, course.Description,
            course.InstructorId, course.Instructor.DisplayName, course.IsActive, course.CreatedAt,
            studentCount, sessionCount);
    }

    public async Task<List<EnrollmentResponse>> GetCourseStudentsAsync(int courseId, int userId)
    {
        // Verify instructor owns the course
        if (!await _db.Courses.AnyAsync(c => c.Id == courseId && c.InstructorId == userId))
            return new List<EnrollmentResponse>();

        return await _db.Enrollments
            .Where(e => e.CourseId == courseId)
            .Include(e => e.Student)
            .Include(e => e.Course)
            .Select(e => new EnrollmentResponse(
                e.Id, e.StudentId, e.Student.DisplayName, e.Student.Email,
                e.CourseId, e.Course.Code, e.Course.Name,
                e.Status.ToString(), e.EnrolledAt))
            .ToListAsync();
    }

    public async Task<EnrollmentResponse?> EnrollStudentAsync(int courseId, int studentId, int instructorUserId)
    {
        if (!await _db.Courses.AnyAsync(c => c.Id == courseId && c.InstructorId == instructorUserId))
            return null;

        if (await _db.Enrollments.AnyAsync(e => e.StudentId == studentId && e.CourseId == courseId))
            return null;

        var student = await _db.Users.FindAsync(studentId);
        var course = await _db.Courses.FindAsync(courseId);
        if (student == null || course == null) return null;

        var enrollment = new Enrollment
        {
            StudentId = studentId,
            CourseId = courseId,
            Status = EnrollmentStatus.Active,
            EnrolledAt = DateTime.UtcNow
        };

        _db.Enrollments.Add(enrollment);
        await _db.SaveChangesAsync();

        return new EnrollmentResponse(enrollment.Id, student.Id, student.DisplayName, student.Email,
            course.Id, course.Code, course.Name, enrollment.Status.ToString(), enrollment.EnrolledAt);
    }

    public async Task<bool> DropStudentAsync(int courseId, int enrollmentId, int instructorUserId)
    {
        if (!await _db.Courses.AnyAsync(c => c.Id == courseId && c.InstructorId == instructorUserId))
            return false;

        var enrollment = await _db.Enrollments.FindAsync(enrollmentId);
        if (enrollment == null || enrollment.CourseId != courseId) return false;

        enrollment.Status = EnrollmentStatus.Dropped;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<EnrollmentRequestResponse>> GetCourseEnrollmentRequestsAsync(int courseId, int userId)
    {
        if (!await _db.Courses.AnyAsync(c => c.Id == courseId && c.InstructorId == userId))
            return new List<EnrollmentRequestResponse>();

        return await _db.EnrollmentRequests
            .Where(er => er.CourseId == courseId)
            .Include(er => er.Student)
            .Include(er => er.Course)
            .Select(er => new EnrollmentRequestResponse(
                er.Id, er.StudentUserId, er.Student.DisplayName, er.Student.Email,
                er.CourseId, er.Course.Code, er.Course.Name,
                er.Status.ToString(), er.RequestedAt, er.ReviewedAt))
            .ToListAsync();
    }

    public async Task<bool> ReviewEnrollmentRequestAsync(int courseId, int requestId, string status, int userId)
    {
        if (!await _db.Courses.AnyAsync(c => c.Id == courseId && c.InstructorId == userId))
            return false;

        var request = await _db.EnrollmentRequests.FindAsync(requestId);
        if (request == null || request.CourseId != courseId)
            return false;

        if (!Enum.TryParse<EnrollmentRequestStatus>(status, true, out var statusEnum))
            return false;

        request.Status = statusEnum;
        request.ReviewedAt = DateTime.UtcNow;
        request.ReviewedByUserId = userId;

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

    public async Task<List<Challenge>> GetCourseChallengesAsync(int courseId, int userId)
    {
        if (!await _db.Courses.AnyAsync(c => c.Id == courseId && c.InstructorId == userId))
            return new List<Challenge>();

        return await _db.Challenges
            .Where(c => c.CourseId == courseId)
            .Include(c => c.TestCases)
            .Include(c => c.PatternChecks)
            .OrderBy(c => c.Order)
            .ToListAsync();
    }

    public async Task<Challenge?> CreateChallengeAsync(int courseId, Challenge challenge, int userId)
    {
        if (!await _db.Courses.AnyAsync(c => c.Id == courseId && c.InstructorId == userId))
            return null;

        challenge.CourseId = courseId;
        _db.Challenges.Add(challenge);
        await _db.SaveChangesAsync();
        return challenge;
    }

    public async Task<Challenge?> UpdateChallengeAsync(int challengeId, Challenge updated, int userId)
    {
        var challenge = await _db.Challenges.Include(c => c.Course).FirstOrDefaultAsync(c => c.Id == challengeId);
        if (challenge == null || challenge.Course?.InstructorId != userId)
            return null;

        challenge.Title = updated.Title;
        challenge.Description = updated.Description;
        challenge.StarterCode = updated.StarterCode;
        challenge.Order = updated.Order;
        challenge.Points = updated.Points;
        challenge.TimeLimitSeconds = updated.TimeLimitSeconds;
        challenge.Difficulty = updated.Difficulty;

        await _db.SaveChangesAsync();
        return challenge;
    }

    public async Task<bool> DeleteChallengeAsync(int challengeId, int userId)
    {
        var challenge = await _db.Challenges.Include(c => c.Course).FirstOrDefaultAsync(c => c.Id == challengeId);
        if (challenge == null || challenge.Course?.InstructorId != userId)
            return false;

        _db.Challenges.Remove(challenge);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<object>> GetCourseSessionsAsync(int courseId, int userId)
    {
        if (!await _db.Courses.AnyAsync(c => c.Id == courseId && c.InstructorId == userId))
            return new List<object>();

        return await _db.Sessions
            .Where(s => s.CourseId == courseId)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => (object)new
            {
                s.Id, s.Code, s.Name, Status = s.Status.ToString(),
                s.CreatedAt, s.StartedAt, s.EndedAt,
                StudentCount = s.Participants.Count
            })
            .ToListAsync();
    }

    public async Task<object?> CreateSessionAsync(int courseId, string name, List<int> challengeIds, string teacherConnectionId, int userId)
    {
        var course = await _db.Courses.FindAsync(courseId);
        if (course == null || (course.InstructorId != userId))
            return null;

        var sessionCode = GenerateSessionCode();
        var shareableLink = _qrService.GenerateShareableLink(sessionCode);
        var qrCodeData = _qrService.GenerateQrCodeBase64(shareableLink);

        var session = new Session
        {
            Code = sessionCode,
            Name = name,
            Status = SessionStatus.Lobby,
            CreatedAt = DateTime.UtcNow,
            TeacherConnectionId = teacherConnectionId,
            ChallengeIds = challengeIds,
            CourseId = courseId,
            CreatedByUserId = userId,
            ShareableLink = shareableLink,
            QrCodeData = qrCodeData
        };

        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        return new
        {
            session = new { session.Id, session.Code, session.Name, Status = session.Status.ToString(), session.CreatedAt, session.ChallengeIds, session.CourseId },
            joinCode = session.Code,
            shareableLink,
            qrCodeBase64 = qrCodeData
        };
    }

    private static string GenerateSessionCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }
}
