using CodeFest.Api.Data;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
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

    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions()
    {
        var sessions = await _sessionService.GetAllAsync();
        return Ok(sessions.Select(s => new
        {
            s.Id,
            s.Code,
            s.Name,
            Status = s.Status.ToString(),
            s.CreatedAt,
            s.StartedAt,
            s.EndedAt,
            s.ChallengeIds,
            StudentCount = s.Students.Count
        }));
    }

    [HttpPost("sessions")]
    public async Task<IActionResult> CreateSession([FromBody] CreateSessionRequest request)
    {
        var session = await _sessionService.CreateAsync(request.Name, request.ChallengeIds, string.Empty);
        return Ok(new { session.Code, session.Name, Status = session.Status.ToString() });
    }

    [HttpGet("sessions/{code}")]
    public async Task<IActionResult> GetSession(string code)
    {
        var session = await _sessionService.GetByCodeAsync(code);
        if (session == null) return NotFound();

        return Ok(new
        {
            session.Id,
            session.Code,
            session.Name,
            Status = session.Status.ToString(),
            session.CreatedAt,
            session.StartedAt,
            session.EndedAt,
            session.ChallengeIds,
            Students = session.Students.Select(s => new
            {
                s.Id,
                s.DisplayName,
                s.CurrentChallengeIndex,
                s.TotalPoints,
                s.IsConnected,
                ClientType = s.ClientType.ToString(),
                s.JoinedAt
            })
        });
    }

    [HttpGet("sessions/{code}/activity")]
    public async Task<IActionResult> GetActivity(string code, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? type = null)
    {
        ActivityType? typeFilter = null;
        if (!string.IsNullOrEmpty(type) && Enum.TryParse<ActivityType>(type, true, out var parsed))
            typeFilter = parsed;

        var activities = await _activityLogService.GetBySessionAsync(code, page, pageSize, typeFilter);
        return Ok(activities);
    }

    [HttpGet("sessions/{code}/leaderboard")]
    public async Task<IActionResult> GetLeaderboard(string code)
    {
        var leaderboard = await _sessionService.GetLeaderboardAsync(code);
        return Ok(leaderboard);
    }

    [HttpGet("students/{id}/code")]
    public async Task<IActionResult> GetStudentCode(int id)
    {
        // Get the latest code snapshot from activity logs
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
                s.Id,
                s.ChallengeId,
                s.Code,
                s.TestsPassed,
                s.TestsTotal,
                s.AllPassed,
                s.PointsAwarded,
                s.CompileError,
                s.RuntimeError,
                s.ExecutionTimeMs,
                s.SubmittedAt
            })
            .ToListAsync();

        return Ok(submissions);
    }

    [HttpPost("sessions/{code}/hint")]
    public async Task<IActionResult> PushHint(string code, [FromBody] HintRequest request)
    {
        // This is primarily handled via SignalR, but exposing as REST too
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
