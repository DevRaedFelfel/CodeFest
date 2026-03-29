using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CodeFest.Api.Data;
using CodeFest.Api.Models;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace CodeFest.Api.Services;

public class AuthService
{
    private readonly CodeFestDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(CodeFestDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<(User? user, string? token, string? error)> AuthenticateWithGoogleAsync(string idToken)
    {
        GoogleJsonWebSignature.Payload payload;
        try
        {
            var clientId = _config["Authentication:Google:ClientId"];
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId }
            });
        }
        catch (InvalidJwtException)
        {
            return (null, null, "Invalid Google token");
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == payload.Email);
        if (user == null)
            return (null, null, "Account not registered in CodeFest. Contact your instructor.");

        if (!user.IsActive)
            return (null, null, "Your account has been deactivated. Contact your instructor.");

        // Update profile from Google if changed
        var updated = false;
        if (user.DisplayName != payload.Name && !string.IsNullOrEmpty(payload.Name))
        {
            user.DisplayName = payload.Name;
            updated = true;
        }
        if (user.PictureUrl != payload.Picture)
        {
            user.PictureUrl = payload.Picture;
            updated = true;
        }
        user.LastLoginAt = DateTime.UtcNow;
        if (updated)
            await _db.SaveChangesAsync();
        else
        {
            _db.Entry(user).Property(u => u.LastLoginAt).IsModified = true;
            await _db.SaveChangesAsync();
        }

        var token = GenerateJwt(user);
        return (user, token, null);
    }

    public string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Authentication:Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret not configured")));

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("role", user.Role.ToString()),
            new Claim("name", user.DisplayName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var expiryHours = int.Parse(_config["Authentication:Jwt:ExpiryHours"] ?? "24");

        var token = new JwtSecurityToken(
            issuer: _config["Authentication:Jwt:Issuer"] ?? "CodeFest",
            audience: _config["Authentication:Jwt:Audience"] ?? "CodeFest",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiryHours),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task SeedSuperAdminAsync()
    {
        var email = _config["CodeFest:SuperAdmin:Email"];
        if (string.IsNullOrEmpty(email)) return;

        var exists = await _db.Users.AnyAsync(u => u.Email == email && u.Role == UserRole.SuperAdmin);
        if (exists) return;

        var user = new User
        {
            Email = email,
            DisplayName = _config["CodeFest:SuperAdmin:DisplayName"] ?? "Super Admin",
            Role = UserRole.SuperAdmin,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
    }
}
