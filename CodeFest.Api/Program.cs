using System.Text;
using CodeFest.Api.Data;
using CodeFest.Api.Hubs;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

builder.Services.AddDbContext<CodeFestDbContext>(options =>
    options.UseNpgsql(connectionString));

// Services
builder.Services.AddScoped<CodeExecutionService>();
builder.Services.AddScoped<ChallengeService>();
builder.Services.AddScoped<SessionService>();
builder.Services.AddScoped<ActivityLogService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddScoped<FileImportService>();
builder.Services.AddScoped<InstructorService>();
builder.Services.AddScoped<StudentService>();
builder.Services.AddScoped<QrCodeService>();
builder.Services.AddSingleton<InteractiveRunService>();

// Authentication — JWT Bearer
var jwtSecret = builder.Configuration["Authentication:Jwt:Secret"] ?? "CodeFest-Dev-Secret-Key-Change-In-Production-Min32Chars!";
var jwtIssuer = builder.Configuration["Authentication:Jwt:Issuer"] ?? "CodeFest";
var jwtAudience = builder.Configuration["Authentication:Jwt:Audience"] ?? "CodeFest";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };

        // Allow SignalR to receive JWT from query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// Authorization policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SuperAdmin", p => p.RequireClaim("role", "SuperAdmin"));
    options.AddPolicy("Instructor", p => p.RequireClaim("role", "Instructor", "SuperAdmin"));
    options.AddPolicy("Student", p => p.RequireClaim("role", "Student", "Instructor", "SuperAdmin"));
    options.AddPolicy("Authenticated", p => p.RequireAuthenticatedUser());
});

// Controllers + SignalR
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddSignalR(options =>
{
    options.KeepAliveInterval = TimeSpan.FromSeconds(10);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Install per-session Console wrappers so concurrent student runs
// get isolated stdin/stdout via AsyncLocal (not global Console.SetIn/SetOut)
Console.SetOut(new CodeFest.Api.Services.PerSessionConsoleOut(Console.Out));
Console.SetIn(new CodeFest.Api.Services.PerSessionConsoleIn(Console.In));

// Apply migrations on startup + seed super admin
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<CodeFestDbContext>();
    db.Database.Migrate();

    var authService = scope.ServiceProvider.GetRequiredService<AuthService>();
    await authService.SeedSuperAdminAsync();
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Could not apply migrations on startup. Will retry when database is available.");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<CodeFestHub>("/hubs/codefest");

app.Run();

// Make Program accessible for integration tests
public partial class Program { }
