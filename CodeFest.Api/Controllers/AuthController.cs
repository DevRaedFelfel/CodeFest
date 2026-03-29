using System.IdentityModel.Tokens.Jwt;
using CodeFest.Api.Data;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly CodeFestDbContext _db;

    public AuthController(AuthService authService, CodeFestDbContext db)
    {
        _authService = authService;
        _db = db;
    }

    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        var (user, token, error) = await _authService.AuthenticateWithGoogleAsync(request.IdToken);

        if (user == null)
            return StatusCode(403, new { error });

        return Ok(new
        {
            token,
            user = new
            {
                user.Id,
                user.Email,
                name = user.DisplayName,
                role = user.Role.ToString(),
                user.PictureUrl
            }
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirst("sub");
        if (userIdClaim == null)
            return Unauthorized();

        var userId = int.Parse(userIdClaim.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return NotFound();

        return Ok(new
        {
            user.Id,
            user.Email,
            name = user.DisplayName,
            role = user.Role.ToString(),
            user.PictureUrl
        });
    }

    [Authorize]
    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken()
    {
        var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirst("sub");
        if (userIdClaim == null)
            return Unauthorized();

        var userId = int.Parse(userIdClaim.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user == null || !user.IsActive)
            return Unauthorized();

        var token = _authService.GenerateJwt(user);
        return Ok(new { token });
    }
}

public record GoogleLoginRequest(string IdToken);
