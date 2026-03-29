using System.IdentityModel.Tokens.Jwt;
using CodeFest.Api.DTOs;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CodeFest.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "SuperAdmin")]
public class AdminController : ControllerBase
{
    private readonly AdminService _adminService;

    public AdminController(AdminService adminService)
    {
        _adminService = adminService;
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst("sub");
        return int.Parse(claim!.Value);
    }

    // --- Users ---

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] string? role, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _adminService.GetUsersAsync(role, search, page, pageSize);
        return Ok(result);
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var result = await _adminService.CreateUserAsync(request);
        if (result == null) return BadRequest(new { error = "Invalid role or email already exists" });
        return Created($"/api/admin/users/{result.Id}", result);
    }

    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var result = await _adminService.UpdateUserAsync(id, request);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeactivateUser(int id)
    {
        if (!await _adminService.DeactivateUserAsync(id)) return NotFound();
        return NoContent();
    }

    [HttpPost("users/upload")]
    public async Task<IActionResult> UploadUsers(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest(new { error = "No file uploaded" });
        var result = await _adminService.ImportUsersAsync(file);
        return Ok(result);
    }

    // --- Courses ---

    [HttpGet("courses")]
    public async Task<IActionResult> GetCourses()
    {
        var result = await _adminService.GetCoursesAsync();
        return Ok(result);
    }

    [HttpPost("courses")]
    public async Task<IActionResult> CreateCourse([FromBody] CreateCourseRequest request)
    {
        var result = await _adminService.CreateCourseAsync(request);
        if (result == null) return BadRequest(new { error = "Invalid instructor or course code already exists" });
        return Created($"/api/admin/courses/{result.Id}", result);
    }

    [HttpPut("courses/{id}")]
    public async Task<IActionResult> UpdateCourse(int id, [FromBody] UpdateCourseRequest request)
    {
        var result = await _adminService.UpdateCourseAsync(id, request);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("courses/{id}")]
    public async Task<IActionResult> DeactivateCourse(int id)
    {
        if (!await _adminService.DeactivateCourseAsync(id)) return NotFound();
        return NoContent();
    }

    [HttpPost("courses/upload")]
    public async Task<IActionResult> UploadCourses(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest(new { error = "No file uploaded" });
        var result = await _adminService.ImportCoursesAsync(file);
        return Ok(result);
    }

    // --- Enrollments ---

    [HttpGet("enrollments")]
    public async Task<IActionResult> GetEnrollments([FromQuery] int? courseId, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _adminService.GetEnrollmentsAsync(courseId, status, page, pageSize);
        return Ok(result);
    }

    [HttpPost("enrollments")]
    public async Task<IActionResult> CreateEnrollment([FromBody] CreateEnrollmentRequest request)
    {
        var result = await _adminService.CreateEnrollmentAsync(request);
        if (result == null) return BadRequest(new { error = "Student or course not found, or already enrolled" });
        return Created($"/api/admin/enrollments/{result.Id}", result);
    }

    [HttpDelete("enrollments/{id}")]
    public async Task<IActionResult> DeleteEnrollment(int id)
    {
        if (!await _adminService.DeleteEnrollmentAsync(id)) return NotFound();
        return NoContent();
    }

    [HttpPost("enrollments/upload")]
    public async Task<IActionResult> UploadEnrollments(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest(new { error = "No file uploaded" });
        var result = await _adminService.ImportEnrollmentsAsync(file);
        return Ok(result);
    }

    // --- Enrollment Requests ---

    [HttpGet("enrollment-requests")]
    public async Task<IActionResult> GetEnrollmentRequests([FromQuery] int? courseId, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _adminService.GetEnrollmentRequestsAsync(courseId, status, page, pageSize);
        return Ok(result);
    }

    [HttpPut("enrollment-requests/{id}")]
    public async Task<IActionResult> ReviewEnrollmentRequest(int id, [FromBody] UpdateEnrollmentRequestDto request)
    {
        var userId = GetCurrentUserId();
        if (!await _adminService.ReviewEnrollmentRequestAsync(id, request.Status, userId)) return NotFound();
        return NoContent();
    }

    // --- Academic Loads ---

    [HttpGet("academic-loads")]
    public async Task<IActionResult> GetAcademicLoads()
    {
        var result = await _adminService.GetAcademicLoadsAsync();
        return Ok(result);
    }

    [HttpPost("academic-loads")]
    public async Task<IActionResult> CreateAcademicLoad([FromBody] CreateAcademicLoadRequest request)
    {
        var result = await _adminService.CreateAcademicLoadAsync(request);
        if (result == null) return BadRequest(new { error = "Invalid instructor/course or already assigned" });
        return Created($"/api/admin/academic-loads/{result.Id}", result);
    }

    [HttpPut("academic-loads/{id}")]
    public async Task<IActionResult> UpdateAcademicLoad(int id, [FromBody] UpdateAcademicLoadRequest request)
    {
        var result = await _adminService.UpdateAcademicLoadAsync(id, request);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("academic-loads/{id}")]
    public async Task<IActionResult> DeleteAcademicLoad(int id)
    {
        if (!await _adminService.DeleteAcademicLoadAsync(id)) return NotFound();
        return NoContent();
    }
}
