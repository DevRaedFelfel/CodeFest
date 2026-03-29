using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using CodeFest.Api.Controllers;
using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CodeFest.Api.Tests.Controllers;

public class TeacherControllerTests
{
    private (TeacherController controller, SessionService sessionService, ActivityLogService activityLogService) CreateController(string? dbName = null, int userId = 1, string role = "SuperAdmin")
    {
        dbName ??= Guid.NewGuid().ToString();
        var db = TestDbContextFactory.Create(dbName);
        var sessionService = new SessionService(db);
        var activityLogService = new ActivityLogService(db);
        var controller = new TeacherController(sessionService, activityLogService, db);

        // Set up claims principal with sub and role claims
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new("role", role),
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        return (controller, sessionService, activityLogService);
    }

    // --- GetSessions ---

    [Fact]
    public async Task GetSessions_ShouldReturnOkWithSessionsList()
    {
        var (controller, sessionService, _) = CreateController();
        await sessionService.CreateAsync("Session 1", new List<int> { 1 }, "conn1");
        await sessionService.CreateAsync("Session 2", new List<int> { 2 }, "conn2");

        var result = await controller.GetSessions();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var paginated = okResult.Value as PaginatedResponse<SessionListItem>;
        paginated.Should().NotBeNull();
        paginated!.Items.Should().HaveCount(2);
    }

    // --- CreateSession ---

    [Fact]
    public async Task CreateSession_ShouldReturnOkWithNewSession()
    {
        var (controller, _, _) = CreateController();
        var request = new CreateSessionRequest { Name = "New Session", ChallengeIds = new List<int> { 1, 2 } };

        var result = await controller.CreateSession(request);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
    }

    // --- GetSession ---

    [Fact]
    public async Task GetSession_ShouldReturnOkWithSessionDetails()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int> { 1 }, "conn");
        await sessionService.JoinStudentAsync(session.Code, "Ali", "s-conn", StudentClientType.Web);

        var result = await controller.GetSession(session.Code);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task GetSession_ShouldReturnNotFoundForNonexistent()
    {
        var (controller, _, _) = CreateController();

        var result = await controller.GetSession("NOPE");

        result.Should().BeOfType<NotFoundResult>();
    }

    // --- GetActivity ---

    [Fact]
    public async Task GetActivity_ShouldReturnOkWithActivities()
    {
        var (controller, sessionService, activityLogService) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        var student = await sessionService.JoinStudentAsync(session.Code, "Ali", "s-conn", StudentClientType.Web);
        await activityLogService.LogAsync(student.Id, session.Id, ActivityType.Joined);
        await activityLogService.LogAsync(student.Id, session.Id, ActivityType.TabSwitched);

        var result = await controller.GetActivity(session.Code);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var activities = (okResult.Value as IEnumerable<object>)!.ToList();
        activities.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetActivity_ShouldFilterByType()
    {
        var (controller, sessionService, activityLogService) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        var student = await sessionService.JoinStudentAsync(session.Code, "Ali", "s-conn", StudentClientType.Web);
        await activityLogService.LogAsync(student.Id, session.Id, ActivityType.Joined);
        await activityLogService.LogAsync(student.Id, session.Id, ActivityType.TabSwitched);

        var result = await controller.GetActivity(session.Code, type: "TabSwitched");

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var activities = (okResult.Value as IEnumerable<object>)!.ToList();
        activities.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetActivity_ShouldFilterByStudentId()
    {
        var (controller, sessionService, activityLogService) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        var s1 = await sessionService.JoinStudentAsync(session.Code, "Ali", "c1", StudentClientType.Web);
        var s2 = await sessionService.JoinStudentAsync(session.Code, "Sara", "c2", StudentClientType.Web);
        await activityLogService.LogAsync(s1.Id, session.Id, ActivityType.Joined);
        await activityLogService.LogAsync(s2.Id, session.Id, ActivityType.Joined);
        await activityLogService.LogAsync(s1.Id, session.Id, ActivityType.TabSwitched);

        var result = await controller.GetActivity(session.Code, studentId: s1.Id);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var activities = (okResult.Value as IEnumerable<object>)!.ToList();
        activities.Should().HaveCount(2);
    }

    // --- GetLeaderboard ---

    [Fact]
    public async Task GetLeaderboard_ShouldReturnOkWithRankedEntries()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        var s1 = await sessionService.JoinStudentAsync(session.Code, "Ali", "c1", StudentClientType.Web);
        var s2 = await sessionService.JoinStudentAsync(session.Code, "Sara", "c2", StudentClientType.Web);
        await sessionService.UpdateStudentPointsAsync(s1.Id, 100, 1);
        await sessionService.UpdateStudentPointsAsync(s2.Id, 200, 2);

        var result = await controller.GetLeaderboard(session.Code);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var entries = (okResult.Value as IEnumerable<object>)!.ToList();
        entries.Should().HaveCount(2);
    }

    // --- GetStudentCode ---

    [Fact]
    public async Task GetStudentCode_ShouldReturnLatestCodeSnapshot()
    {
        var (controller, sessionService, activityLogService) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        var student = await sessionService.JoinStudentAsync(session.Code, "Ali", "s-conn", StudentClientType.Web);
        await activityLogService.LogAsync(student.Id, session.Id, ActivityType.CodeChanged, "first version");
        await Task.Delay(10);
        await activityLogService.LogAsync(student.Id, session.Id, ActivityType.CodeChanged, "latest version");

        var result = await controller.GetStudentCode(student.Id);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var code = okResult.Value!.GetType().GetProperty("code")!.GetValue(okResult.Value) as string;
        code.Should().Be("latest version");
    }

    [Fact]
    public async Task GetStudentCode_ShouldReturnEmptyWhenNoSnapshots()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        var student = await sessionService.JoinStudentAsync(session.Code, "Ali", "s-conn", StudentClientType.Web);

        var result = await controller.GetStudentCode(student.Id);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var code = okResult.Value!.GetType().GetProperty("code")!.GetValue(okResult.Value) as string;
        code.Should().BeEmpty();
    }

    // --- GetStudentSubmissions ---

    [Fact]
    public async Task GetStudentSubmissions_ShouldReturnSubmissions()
    {
        var dbName = Guid.NewGuid().ToString();
        var db = TestDbContextFactory.Create(dbName);
        var sessionService = new SessionService(db);
        var activityLogService = new ActivityLogService(db);
        var controller = new TeacherController(sessionService, activityLogService, db);

        // Set up claims
        var claims = new List<Claim> { new(JwtRegisteredClaimNames.Sub, "1"), new("role", "SuperAdmin") };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        // Create challenge first
        var challenge = new Challenge { Title = "Test", Description = "d", StarterCode = "c", Order = 1 };
        db.Challenges.Add(challenge);
        await db.SaveChangesAsync();

        var session = await sessionService.CreateAsync("Test", new List<int> { challenge.Id }, "conn");
        var student = await sessionService.JoinStudentAsync(session.Code, "Ali", "s-conn", StudentClientType.Web);

        db.Submissions.Add(new Submission
        {
            StudentId = student.Id,
            ChallengeId = challenge.Id,
            SessionId = session.Id,
            Code = "Console.WriteLine(\"test\");",
            TestsPassed = 1,
            TestsTotal = 2,
            AllPassed = false,
            PointsAwarded = 0,
            ExecutionTimeMs = 50,
            SubmittedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await controller.GetStudentSubmissions(student.Id);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var submissions = (okResult.Value as IEnumerable<object>)!.ToList();
        submissions.Should().HaveCount(1);
    }

    // --- UpdateStatus ---

    [Fact]
    public async Task UpdateStatus_StartShouldTransitionLobbyToActive()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "start" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_PauseShouldTransitionActiveToPaused()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        await sessionService.StartAsync(session.Code);

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "pause" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_InvalidStatusShouldReturnBadRequest()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "invalid" });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_EndShouldTransitionActiveToEnded()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        await sessionService.StartAsync(session.Code);

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "end" });

        result.Should().BeOfType<OkObjectResult>();
    }

    // --- Hint and Broadcast ---

    [Fact]
    public async Task PushHint_ShouldReturnOk()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");

        var result = await controller.PushHint(session.Code, new HintRequest { ChallengeId = 1, Hint = "Try using a loop" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Broadcast_ShouldReturnOk()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");

        var result = await controller.Broadcast(session.Code, new BroadcastRequest { Message = "5 minutes left!" });

        result.Should().BeOfType<OkObjectResult>();
    }

    // --- DeleteSession ---

    [Fact]
    public async Task DeleteSession_ShouldReturnNoContent()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");

        var result = await controller.DeleteSession(session.Code);

        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task DeleteSession_ShouldReturnNotFoundForNonexistent()
    {
        var (controller, _, _) = CreateController();

        var result = await controller.DeleteSession("NOPE");

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    // --- Reopen via UpdateStatus ---

    [Fact]
    public async Task UpdateStatus_ReopenShouldTransitionEndedToLobby()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        await sessionService.StartAsync(session.Code);
        await sessionService.EndAsync(session.Code);

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "reopen" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_ReopenShouldReturnBadRequestForActiveSession()
    {
        var (controller, sessionService, _) = CreateController();
        var session = await sessionService.CreateAsync("Test", new List<int>(), "conn");
        await sessionService.StartAsync(session.Code);

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "reopen" });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // --- Bulk Operations ---

    [Fact]
    public async Task BulkEndSessions_ShouldEndActiveAndPausedSessions()
    {
        var (controller, sessionService, _) = CreateController();
        var s1 = await sessionService.CreateAsync("Active Session", new List<int>(), "conn");
        await sessionService.StartAsync(s1.Code);
        var s2 = await sessionService.CreateAsync("Lobby Session", new List<int>(), "conn");

        var result = await controller.BulkEndSessions(new BulkSessionRequest(new List<string> { s1.Code, s2.Code }));

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var ended = okResult.Value!.GetType().GetProperty("ended")!.GetValue(okResult.Value);
        ended.Should().Be(1); // Only the active one
    }

    [Fact]
    public async Task BulkDeleteSessions_ShouldDeleteLobbyAndEndedOnly()
    {
        var (controller, sessionService, _) = CreateController();
        var s1 = await sessionService.CreateAsync("Lobby Session", new List<int>(), "conn");
        var s2 = await sessionService.CreateAsync("Active Session", new List<int>(), "conn");
        await sessionService.StartAsync(s2.Code);

        var result = await controller.BulkDeleteSessions(new BulkSessionRequest(new List<string> { s1.Code, s2.Code }));

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var deleted = okResult.Value!.GetType().GetProperty("deleted")!.GetValue(okResult.Value);
        deleted.Should().Be(1); // Only the lobby one
    }
}
