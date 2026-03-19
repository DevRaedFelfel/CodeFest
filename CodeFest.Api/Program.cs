using CodeFest.Api.Data;
using CodeFest.Api.Hubs;
using CodeFest.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

builder.Services.AddDbContext<CodeFestDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0))));

// Services
builder.Services.AddScoped<CodeExecutionService>();
builder.Services.AddScoped<ChallengeService>();
builder.Services.AddScoped<SessionService>();
builder.Services.AddScoped<ActivityLogService>();

// Controllers + SignalR
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddSignalR();
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

// Apply migrations on startup
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<CodeFestDbContext>();
    db.Database.Migrate();
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
app.MapControllers();
app.MapHub<CodeFestHub>("/hubs/codefest");

app.Run();
