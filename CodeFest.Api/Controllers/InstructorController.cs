using System.IdentityModel.Tokens.Jwt;
using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CodeFest.Api.Controllers;

[ApiController]
[Route("api/instructor")]
[Authorize(Policy = "Instructor")]
public class InstructorController : ControllerBase
{
    private readonly InstructorService _instructorService;

    public InstructorController(InstructorService instructorService)
    {
        _instructorService = instructorService;
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst("sub");
        return int.Parse(claim!.Value);
    }

    [HttpGet("courses")]
    public async Task<IActionResult> GetCourses()
    {
        var courses = await _instructorService.GetInstructorCoursesAsync(GetCurrentUserId());
        return Ok(courses);
    }

    [HttpGet("courses/{id}")]
    public async Task<IActionResult> GetCourse(int id)
    {
        var course = await _instructorService.GetCourseAsync(id, GetCurrentUserId());
        if (course == null) return NotFound();
        return Ok(course);
    }

    [HttpGet("courses/{id}/students")]
    public async Task<IActionResult> GetCourseStudents(int id)
    {
        var students = await _instructorService.GetCourseStudentsAsync(id, GetCurrentUserId());
        return Ok(students);
    }

    [HttpPost("courses/{id}/enrollments")]
    public async Task<IActionResult> EnrollStudent(int id, [FromBody] EnrollStudentRequest request)
    {
        var result = await _instructorService.EnrollStudentAsync(id, request.StudentId, GetCurrentUserId());
        if (result == null) return BadRequest(new { error = "Cannot enroll student" });
        return Created("", result);
    }

    [HttpDelete("courses/{id}/enrollments/{enrollmentId}")]
    public async Task<IActionResult> DropStudent(int id, int enrollmentId)
    {
        if (!await _instructorService.DropStudentAsync(id, enrollmentId, GetCurrentUserId()))
            return NotFound();
        return NoContent();
    }

    [HttpGet("courses/{id}/enrollment-requests")]
    public async Task<IActionResult> GetEnrollmentRequests(int id)
    {
        var requests = await _instructorService.GetCourseEnrollmentRequestsAsync(id, GetCurrentUserId());
        return Ok(requests);
    }

    [HttpPut("courses/{id}/enrollment-requests/{requestId}")]
    public async Task<IActionResult> ReviewEnrollmentRequest(int id, int requestId, [FromBody] UpdateEnrollmentRequestDto request)
    {
        if (!await _instructorService.ReviewEnrollmentRequestAsync(id, requestId, request.Status, GetCurrentUserId()))
            return NotFound();
        return NoContent();
    }

    [HttpGet("courses/{id}/challenges")]
    public async Task<IActionResult> GetChallenges(int id)
    {
        var challenges = await _instructorService.GetCourseChallengesAsync(id, GetCurrentUserId());
        return Ok(challenges);
    }

    [HttpPost("courses/{id}/challenges")]
    public async Task<IActionResult> CreateChallenge(int id, [FromBody] Challenge challenge)
    {
        var result = await _instructorService.CreateChallengeAsync(id, challenge, GetCurrentUserId());
        if (result == null) return BadRequest(new { error = "Cannot create challenge" });
        return Created($"/api/instructor/challenges/{result.Id}", result);
    }

    [HttpPut("challenges/{id}")]
    public async Task<IActionResult> UpdateChallenge(int id, [FromBody] Challenge challenge)
    {
        var result = await _instructorService.UpdateChallengeAsync(id, challenge, GetCurrentUserId());
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("challenges/{id}")]
    public async Task<IActionResult> DeleteChallenge(int id)
    {
        if (!await _instructorService.DeleteChallengeAsync(id, GetCurrentUserId()))
            return NotFound();
        return NoContent();
    }

    [HttpGet("courses/{id}/sessions")]
    public async Task<IActionResult> GetCourseSessions(int id)
    {
        var sessions = await _instructorService.GetCourseSessionsAsync(id, GetCurrentUserId());
        return Ok(sessions);
    }

    [HttpPost("sessions")]
    public async Task<IActionResult> CreateSession([FromBody] CreateInstructorSessionRequest request)
    {
        var result = await _instructorService.CreateSessionAsync(
            request.CourseId, request.Name, request.ChallengeIds, "", GetCurrentUserId());
        if (result == null) return BadRequest(new { error = "Cannot create session" });
        return Created("", result);
    }
}

public record EnrollStudentRequest(int StudentId);
public record CreateInstructorSessionRequest(int CourseId, string Name, List<int> ChallengeIds);
