using CodeFest.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CodeFest.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SessionsController : ControllerBase
{
    private readonly SessionService _sessionService;

    public SessionsController(SessionService sessionService)
    {
        _sessionService = sessionService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
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
            StudentCount = s.Students.Count,
            s.ChallengeIds
        }));
    }

    [HttpGet("{code}")]
    public async Task<IActionResult> GetByCode(string code)
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

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSessionRequest request)
    {
        var session = await _sessionService.CreateAsync(request.Name, request.ChallengeIds, string.Empty);
        return CreatedAtAction(nameof(GetByCode), new { code = session.Code }, new
        {
            session.Id,
            session.Code,
            session.Name,
            Status = session.Status.ToString()
        });
    }

    [HttpPut("{code}/status")]
    public async Task<IActionResult> UpdateStatus(string code, [FromBody] UpdateStatusRequest request)
    {
        var session = request.Status?.ToLower() switch
        {
            "active" or "start" => await _sessionService.StartAsync(code),
            "paused" or "pause" => await _sessionService.PauseAsync(code),
            "resumed" or "resume" => await _sessionService.ResumeAsync(code),
            "ended" or "end" => await _sessionService.EndAsync(code),
            _ => null
        };

        if (session == null) return BadRequest(new { message = "Invalid status transition." });

        return Ok(new { session.Code, Status = session.Status.ToString() });
    }
}

public class CreateSessionRequest
{
    public string Name { get; set; } = string.Empty;
    public List<int> ChallengeIds { get; set; } = new();
}

public class UpdateStatusRequest
{
    public string? Status { get; set; }
}
