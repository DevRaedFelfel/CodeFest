using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;
using Microsoft.Extensions.Configuration;

namespace CodeFest.Api.Tests.Services;

public class AuthServiceTests
{
    private IConfiguration CreateConfig(string? superAdminEmail = null)
    {
        var config = new Dictionary<string, string?>
        {
            ["Authentication:Jwt:Secret"] = "TestSecretKeyThatIsAtLeast32Characters!",
            ["Authentication:Jwt:Issuer"] = "CodeFest",
            ["Authentication:Jwt:Audience"] = "CodeFest",
            ["Authentication:Jwt:ExpiryHours"] = "24",
            ["Authentication:Google:ClientId"] = "test-client-id",
            ["CodeFest:SuperAdmin:Email"] = superAdminEmail ?? "admin@test.com",
            ["CodeFest:SuperAdmin:DisplayName"] = "Super Admin"
        };

        return new ConfigurationBuilder()
            .AddInMemoryCollection(config)
            .Build();
    }

    [Fact]
    public void GenerateJwt_ReturnsValidToken()
    {
        var db = TestDbContext.Create();
        var config = CreateConfig();
        var service = new AuthService(db, config);

        var user = new User { Id = 1, Email = "test@test.com", DisplayName = "Test", Role = UserRole.Student };
        var token = service.GenerateJwt(user);

        Assert.NotNull(token);
        Assert.NotEmpty(token);
        Assert.Contains(".", token); // JWT has 3 parts separated by dots
    }

    [Fact]
    public void GenerateJwt_ContainsCorrectClaims()
    {
        var db = TestDbContext.Create();
        var config = CreateConfig();
        var service = new AuthService(db, config);

        var user = new User { Id = 42, Email = "instructor@test.com", DisplayName = "Dr. Test", Role = UserRole.Instructor };
        var token = service.GenerateJwt(user);

        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        Assert.Equal("42", jwt.Claims.First(c => c.Type == "sub").Value);
        Assert.Equal("instructor@test.com", jwt.Claims.First(c => c.Type == "email").Value);
        Assert.Equal("Instructor", jwt.Claims.First(c => c.Type == "role").Value);
        Assert.Equal("Dr. Test", jwt.Claims.First(c => c.Type == "name").Value);
    }

    [Fact]
    public async Task SeedSuperAdmin_CreatesUserWhenNotExists()
    {
        var db = TestDbContext.Create();
        var config = CreateConfig("newadmin@test.com");
        var service = new AuthService(db, config);

        await service.SeedSuperAdminAsync();

        var user = db.Users.FirstOrDefault(u => u.Email == "newadmin@test.com");
        Assert.NotNull(user);
        Assert.Equal(UserRole.SuperAdmin, user.Role);
        Assert.Equal("Super Admin", user.DisplayName);
    }

    [Fact]
    public async Task SeedSuperAdmin_DoesNotDuplicate()
    {
        var db = await TestDbContext.CreateWithSeedAsync();
        var config = CreateConfig("admin@test.com");
        var service = new AuthService(db, config);

        await service.SeedSuperAdminAsync();

        var count = db.Users.Count(u => u.Email == "admin@test.com" && u.Role == UserRole.SuperAdmin);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task SeedSuperAdmin_DoesNothingWhenEmailMissing()
    {
        var db = TestDbContext.Create();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        var service = new AuthService(db, config);

        await service.SeedSuperAdminAsync(); // Should not throw

        Assert.Empty(db.Users);
    }
}
