using System.IdentityModel.Tokens.Jwt;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CodeFest.Api.Controllers;

[ApiController]
[Route("api/student")]
[Authorize(Policy = "Student")]
public class StudentController : ControllerBase
{
    private readonly StudentService _studentService;

    public StudentController(StudentService studentService)
    {
        _studentService = studentService;
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst("sub");
        return int.Parse(claim!.Value);
    }

    [HttpGet("courses")]
    public async Task<IActionResult> GetCourses()
    {
        var courses = await _studentService.GetEnrolledCoursesAsync(GetCurrentUserId());
        return Ok(courses);
    }

    [HttpGet("courses/{id}")]
    public async Task<IActionResult> GetCourse(int id)
    {
        var course = await _studentService.GetCourseAsync(id, GetCurrentUserId());
        if (course == null) return NotFound();
        return Ok(course);
    }

    [HttpPost("enrollment-requests")]
    public async Task<IActionResult> RequestEnrollment([FromBody] EnrollmentRequestBody body)
    {
        var (success, error) = await _studentService.RequestEnrollmentAsync(GetCurrentUserId(), body.CourseId);
        if (!success) return BadRequest(new { error });
        return Ok(new { message = "Enrollment request sent" });
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> GetActiveSessions()
    {
        var sessions = await _studentService.GetActiveSessionsAsync(GetCurrentUserId());
        return Ok(sessions);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int? courseId)
    {
        var history = await _studentService.GetHistoryAsync(GetCurrentUserId(), courseId);
        return Ok(history);
    }
}

public record EnrollmentRequestBody(int CourseId);
