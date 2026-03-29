using System.IdentityModel.Tokens.Jwt;
using CodeFest.Api.Data;
using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "Instructor")]
public class TeacherController : ControllerBase
{
    private readonly SessionService _sessionService;
    private readonly ActivityLogService _activityLogService;
    private readonly CodeFestDbContext _db;

    public TeacherController(SessionService sessionService, ActivityLogService activityLogService, CodeFestDbContext db)
    {
        _sessionService = sessionService;
        _activityLogService = activityLogService;
        _db = db;
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst("sub");
        return int.Parse(claim!.Value);
    }

    private bool IsSuperAdmin()
    {
        return User.HasClaim("role", "SuperAdmin");
    }

    /// <summary>
    /// GET /api/teacher/sessions — paginated, filtered session list
    /// </summary>
    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions(
        [FromQuery] int? courseId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? progress = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string sortBy = "createdAt",
        [FromQuery] string sortDir = "desc")
    {
        var userId = GetCurrentUserId();
        var isSuperAdmin = IsSuperAdmin();

        // Base query: sessions for instructor's courses (via AcademicLoad) or all for SuperAdmin
        IQueryable<Session> query = _db.Sessions
            .Include(s => s.Course)
            .Include(s => s.Participants);

        if (!isSuperAdmin)
        {
            var instructorCourseIds = await _db.AcademicLoads
                .Where(al => al.InstructorId == userId && al.IsActive)
                .Select(al => al.CourseId)
                .ToListAsync();

            // Also include courses where user is direct instructor
            var ownedCourseIds = await _db.Courses
                .Where(c => c.InstructorId == userId)
                .Select(c => c.Id)
                .ToListAsync();

            var allCourseIds = instructorCourseIds.Union(ownedCourseIds).Distinct().ToList();
            query = query.Where(s => s.CourseId.HasValue && allCourseIds.Contains(s.CourseId.Value));
        }

        // Filter: courseId
        if (courseId.HasValue)
            query = query.Where(s => s.CourseId == courseId.Value);

        // Filter: status
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SessionStatus>(status, true, out var statusEnum))
            query = query.Where(s => s.Status == statusEnum);

        // Filter: text search
        if (!string.IsNullOrEmpty(search))
        {
            var term = search.ToLower();
            query = query.Where(s =>
                s.Name.ToLower().Contains(term) ||
                s.Code.ToLower().Contains(term) ||
                (s.Course != null && (s.Course.Name.ToLower().Contains(term) || s.Course.Code.ToLower().Contains(term))));
        }

        // Get total before pagination
        var totalCount = await query.CountAsync();

        // Sort
        query = sortBy.ToLower() switch
        {
            "name" => sortDir == "asc" ? query.OrderBy(s => s.Name) : query.OrderByDescending(s => s.Name),
            "course" => sortDir == "asc" ? query.OrderBy(s => s.Course!.Code) : query.OrderByDescending(s => s.Course!.Code),
            "status" => sortDir == "asc" ? query.OrderBy(s => s.Status) : query.OrderByDescending(s => s.Status),
            _ => sortDir == "asc" ? query.OrderBy(s => s.CreatedAt) : query.OrderByDescending(s => s.CreatedAt),
        };

        // Project to DTO
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new SessionListItem(
                s.Id, s.Name, s.CourseId,
                s.Course != null ? s.Course.Code : null,
                s.Course != null ? s.Course.Name : null,
                s.Code, s.Status.ToString(),
                s.CreatedAt, s.StartedAt, s.EndedAt,
                s.ChallengeIds.Count,
                s.CourseId.HasValue
                    ? _db.Enrollments.Count(e => e.CourseId == s.CourseId.Value && e.Status == EnrollmentStatus.Active)
                    : 0,
                s.Participants.Count,
                s.Participants.Count(p => p.CurrentChallengeIndex >= s.ChallengeIds.Count && s.ChallengeIds.Count > 0)
            ))
            .ToListAsync();

        // Post-filter: progress (needs computed values)
        if (!string.IsNullOrEmpty(progress))
        {
            items = progress.ToLower() switch
            {
                "notstarted" => items.Where(i => i.CompletedCount == 0 && i.ParticipantCount == 0).ToList(),
                "inprogress" => items.Where(i => i.ParticipantCount > 0 && i.CompletedCount < i.EnrolledCount).ToList(),
                "completed" => items.Where(i => i.EnrolledCount > 0 && i.CompletedCount >= i.EnrolledCount).ToList(),
                _ => items
            };
        }

        return Ok(new PaginatedResponse<SessionListItem>(items, totalCount, page, pageSize));
    }

    /// <summary>
    /// GET /api/teacher/sessions/{code} — session detail with participants
    /// </summary>
    [HttpGet("sessions/{code}")]
    public async Task<IActionResult> GetSession(string code)
    {
        var session = await _db.Sessions
            .Include(s => s.Course)
            .Include(s => s.Participants).ThenInclude(p => p.User)
            .Include(s => s.Students)
            .FirstOrDefaultAsync(s => s.Code == code);

        if (session == null) return NotFound();

        // Get submission counts per participant
        var sessionSubmissions = await _db.Submissions
            .Where(s => s.SessionId == session.Id)
            .GroupBy(s => s.UserId ?? s.StudentId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync();

        // Get flags from activity logs
        var flagTypes = new[] { ActivityType.TabSwitched, ActivityType.CopyPaste, ActivityType.FullscreenExited };
        var flags = await _db.ActivityLogs
            .Where(a => a.SessionId == session.Id && flagTypes.Contains(a.Type))
            .GroupBy(a => a.UserId ?? a.StudentId)
            .Select(g => new { UserId = g.Key, Flags = g.Select(a => a.Type.ToString()).Distinct().ToList() })
            .ToListAsync();

        var participants = session.Participants.Select(p =>
        {
            var subCount = sessionSubmissions.FirstOrDefault(s => s.UserId == p.UserId)?.Count ?? 0;
            var pFlags = flags.FirstOrDefault(f => f.UserId == p.UserId)?.Flags ?? new List<string>();
            var connStatus = pFlags.Count > 0 ? "flagged" : (p.IsConnected ? "online" : "offline");

            return new SessionParticipantDetail(
                p.UserId, p.User.DisplayName, p.User.Email, connStatus,
                p.CurrentChallengeIndex, p.TotalPoints, subCount, p.JoinedAt, pFlags);
        }).ToList();

        // Also include legacy students if no participants
        if (!participants.Any() && session.Students.Any())
        {
            participants = session.Students.Select(s =>
            {
                var subCount = sessionSubmissions.FirstOrDefault(sc => sc.UserId == s.Id)?.Count ?? 0;
                var sFlags = flags.FirstOrDefault(f => f.UserId == s.Id)?.Flags ?? new List<string>();
                var connStatus = sFlags.Count > 0 ? "flagged" : (s.IsConnected ? "online" : "offline");

                return new SessionParticipantDetail(
                    s.Id, s.DisplayName, null, connStatus,
                    s.CurrentChallengeIndex, s.TotalPoints, subCount, s.JoinedAt, sFlags);
            }).ToList();
        }

        var enrolledCount = session.CourseId.HasValue
            ? await _db.Enrollments.CountAsync(e => e.CourseId == session.CourseId.Value && e.Status == EnrollmentStatus.Active)
            : 0;

        var result = new SessionDetailResponse(
            session.Id, session.Name, session.CourseId,
            session.Course?.Code, session.Course?.Name,
            session.Code, session.Status.ToString(),
            session.CreatedAt, session.StartedAt, session.EndedAt,
            session.ChallengeIds, session.ShareableLink, session.QrCodeData,
            participants, Math.Max(0, enrolledCount - participants.Count));

        return Ok(result);
    }

    /// <summary>
    /// GET /api/teacher/sessions/{code}/activity — with optional studentId filter
    /// </summary>
    [HttpGet("sessions/{code}/activity")]
    public async Task<IActionResult> GetActivity(
        string code,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? type = null,
        [FromQuery] int? studentId = null)
    {
        ActivityType? typeFilter = null;
        if (!string.IsNullOrEmpty(type) && Enum.TryParse<ActivityType>(type, true, out var parsed))
            typeFilter = parsed;

        var query = _db.ActivityLogs
            .Include(a => a.Student)
            .Include(a => a.Session)
            .Where(a => a.Session.Code == code);

        if (typeFilter.HasValue)
            query = query.Where(a => a.Type == typeFilter.Value);

        if (studentId.HasValue)
            query = query.Where(a => a.StudentId == studentId.Value || a.UserId == studentId.Value);

        var activities = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                StudentId = a.UserId ?? a.StudentId,
                DisplayName = a.Student.DisplayName,
                ActivityType = a.Type.ToString(),
                a.Data,
                a.Timestamp
            })
            .ToListAsync();

        return Ok(activities);
    }

    [HttpGet("sessions/{code}/leaderboard")]
    public async Task<IActionResult> GetLeaderboard(string code)
    {
        var leaderboard = await _sessionService.GetLeaderboardAsync(code);
        return Ok(leaderboard);
    }

    /// <summary>
    /// POST /api/teacher/sessions/bulk-end — end multiple sessions
    /// </summary>
    [HttpPost("sessions/bulk-end")]
    public async Task<IActionResult> BulkEndSessions([FromBody] BulkSessionRequest request)
    {
        var sessions = await _db.Sessions
            .Where(s => request.SessionCodes.Contains(s.Code) &&
                        (s.Status == SessionStatus.Active || s.Status == SessionStatus.Paused))
            .ToListAsync();

        foreach (var session in sessions)
        {
            session.Status = SessionStatus.Ended;
            session.EndedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new { ended = sessions.Count });
    }

    /// <summary>
    /// POST /api/teacher/sessions/bulk-delete — delete multiple sessions (Lobby/Ended only)
    /// </summary>
    [HttpPost("sessions/bulk-delete")]
    public async Task<IActionResult> BulkDeleteSessions([FromBody] BulkSessionRequest request)
    {
        var sessions = await _db.Sessions
            .Include(s => s.Students)
            .Where(s => request.SessionCodes.Contains(s.Code) &&
                        (s.Status == SessionStatus.Lobby || s.Status == SessionStatus.Ended))
            .ToListAsync();

        foreach (var session in sessions)
        {
            _db.Submissions.RemoveRange(_db.Submissions.Where(s => s.SessionId == session.Id));
            _db.ActivityLogs.RemoveRange(_db.ActivityLogs.Where(a => a.SessionId == session.Id));
            _db.Sessions.Remove(session);
        }

        await _db.SaveChangesAsync();
        return Ok(new { deleted = sessions.Count });
    }

    [HttpPost("sessions")]
    public async Task<IActionResult> CreateSession([FromBody] CreateSessionRequest request)
    {
        var session = await _sessionService.CreateAsync(request.Name, request.ChallengeIds, string.Empty);
        return Ok(new { session.Code, session.Name, Status = session.Status.ToString() });
    }

    [HttpGet("students/{id}/code")]
    public async Task<IActionResult> GetStudentCode(int id)
    {
        var codeLog = await _db.ActivityLogs
            .Where(a => a.StudentId == id && a.Type == ActivityType.CodeChanged)
            .OrderByDescending(a => a.Timestamp)
            .FirstOrDefaultAsync();

        if (codeLog == null) return Ok(new { code = "" });
        return Ok(new { code = codeLog.Data });
    }

    [HttpGet("students/{id}/submissions")]
    public async Task<IActionResult> GetStudentSubmissions(int id)
    {
        var submissions = await _db.Submissions
            .Where(s => s.StudentId == id)
            .OrderByDescending(s => s.SubmittedAt)
            .Select(s => new
            {
                s.Id, s.ChallengeId, s.Code, s.TestsPassed, s.TestsTotal,
                s.AllPassed, s.PointsAwarded, s.CompileError, s.RuntimeError,
                s.ExecutionTimeMs, s.SubmittedAt
            })
            .ToListAsync();

        return Ok(submissions);
    }

    [HttpPost("sessions/{code}/hint")]
    public async Task<IActionResult> PushHint(string code, [FromBody] HintRequest request)
    {
        return Ok(new { message = "Use SignalR PushHint method for real-time delivery." });
    }

    [HttpPost("sessions/{code}/broadcast")]
    public async Task<IActionResult> Broadcast(string code, [FromBody] BroadcastRequest request)
    {
        return Ok(new { message = "Use SignalR BroadcastMessage method for real-time delivery." });
    }

    [HttpPut("sessions/{code}/status")]
    public async Task<IActionResult> UpdateStatus(string code, [FromBody] UpdateStatusRequest request)
    {
        var session = request.Status?.ToLower() switch
        {
            "active" or "start" => await _sessionService.StartAsync(code),
            "paused" or "pause" => await _sessionService.PauseAsync(code),
            "resumed" or "resume" => await _sessionService.ResumeAsync(code),
            "ended" or "end" => await _sessionService.EndAsync(code),
            "lobby" or "reopen" => await _sessionService.ReopenAsync(code),
            _ => null
        };

        if (session == null) return BadRequest(new { message = "Invalid status transition." });
        return Ok(new { session.Code, Status = session.Status.ToString() });
    }

    [HttpDelete("sessions/{code}")]
    public async Task<IActionResult> DeleteSession(string code)
    {
        var deleted = await _sessionService.DeleteAsync(code);
        if (!deleted) return NotFound(new { message = "Session not found." });
        return NoContent();
    }
}

public class HintRequest
{
    public int ChallengeId { get; set; }
    public string Hint { get; set; } = string.Empty;
}

public class BroadcastRequest
{
    public string Message { get; set; } = string.Empty;
}
