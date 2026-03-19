using CodeFest.Api.Data;
using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SubmissionsController : ControllerBase
{
    private readonly ChallengeService _challengeService;
    private readonly CodeFestDbContext _db;

    public SubmissionsController(ChallengeService challengeService, CodeFestDbContext db)
    {
        _challengeService = challengeService;
        _db = db;
    }

    [HttpPost]
    public async Task<ActionResult<SubmissionResult>> Submit([FromBody] SubmissionRequest request)
    {
        var result = await _challengeService.RunTests(request.ChallengeId, request.Code);

        var submission = new Submission
        {
            StudentId = request.StudentId,
            ChallengeId = request.ChallengeId,
            SessionId = request.SessionId,
            Code = request.Code,
            TestsPassed = result.TestsPassed,
            TestsTotal = result.TestsTotal,
            AllPassed = result.AllPassed,
            PointsAwarded = result.PointsAwarded,
            CompileError = result.CompileError,
            RuntimeError = result.RuntimeError,
            ExecutionTimeMs = result.ExecutionTimeMs,
            SubmittedAt = DateTime.UtcNow
        };

        _db.Submissions.Add(submission);
        await _db.SaveChangesAsync();

        return Ok(result);
    }

    [HttpGet("student/{studentId}")]
    public async Task<IActionResult> GetByStudent(int studentId)
    {
        var submissions = await _db.Submissions
            .Where(s => s.StudentId == studentId)
            .OrderByDescending(s => s.SubmittedAt)
            .Select(s => new
            {
                s.Id,
                s.ChallengeId,
                s.TestsPassed,
                s.TestsTotal,
                s.AllPassed,
                s.PointsAwarded,
                s.CompileError,
                s.ExecutionTimeMs,
                s.SubmittedAt
            })
            .ToListAsync();

        return Ok(submissions);
    }

    [HttpGet("session/{sessionCode}")]
    public async Task<IActionResult> GetBySession(string sessionCode)
    {
        var submissions = await _db.Submissions
            .Include(s => s.Student)
            .Include(s => s.Session)
            .Where(s => s.Session.Code == sessionCode)
            .OrderByDescending(s => s.SubmittedAt)
            .Select(s => new
            {
                s.Id,
                s.StudentId,
                StudentName = s.Student.DisplayName,
                s.ChallengeId,
                s.TestsPassed,
                s.TestsTotal,
                s.AllPassed,
                s.PointsAwarded,
                s.CompileError,
                s.ExecutionTimeMs,
                s.SubmittedAt
            })
            .ToListAsync();

        return Ok(submissions);
    }
}
