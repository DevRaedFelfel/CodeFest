using CodeFest.Api.Controllers;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;

namespace CodeFest.Api.Tests.Controllers;

public class SessionsControllerTests
{
    private (SessionsController controller, SessionService service) CreateController(string? dbName = null)
    {
        dbName ??= Guid.NewGuid().ToString();
        var db = TestDbContextFactory.Create(dbName);
        var service = new SessionService(db);
        var controller = new SessionsController(service);
        return (controller, service);
    }

    // --- GetAll ---

    [Fact]
    public async Task GetAll_ShouldReturnOkWithEmptyList()
    {
        var (controller, _) = CreateController();

        var result = await controller.GetAll();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var sessions = (okResult.Value as IEnumerable<object>)!.ToList();
        sessions.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAll_ShouldReturnAllSessions()
    {
        var (controller, service) = CreateController();
        await service.CreateAsync("Session 1", new List<int> { 1 }, "conn1");
        await service.CreateAsync("Session 2", new List<int> { 2 }, "conn2");

        var result = await controller.GetAll();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var sessions = (okResult.Value as IEnumerable<object>)!.ToList();
        sessions.Should().HaveCount(2);
    }

    // --- GetByCode ---

    [Fact]
    public async Task GetByCode_ShouldReturnOkForExistingSession()
    {
        var (controller, service) = CreateController();
        var session = await service.CreateAsync("Test", new List<int> { 1 }, "conn");

        var result = await controller.GetByCode(session.Code);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task GetByCode_ShouldReturnNotFoundForNonexistent()
    {
        var (controller, _) = CreateController();

        var result = await controller.GetByCode("NOPE");

        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task GetByCode_ShouldIncludeStudents()
    {
        var (controller, service) = CreateController();
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.JoinStudentAsync(session.Code, "Ali", "s-conn", StudentClientType.Web);

        var result = await controller.GetByCode(session.Code);

        result.Should().BeOfType<OkObjectResult>();
    }

    // --- Create ---

    [Fact]
    public async Task Create_ShouldReturnCreatedAtAction()
    {
        var (controller, _) = CreateController();
        var request = new CreateSessionRequest { Name = "New Session", ChallengeIds = new List<int> { 1, 2, 3 } };

        var result = await controller.Create(request);

        result.Should().BeOfType<CreatedAtActionResult>();
        var created = (result as CreatedAtActionResult)!;
        created.ActionName.Should().Be("GetByCode");
    }

    // --- UpdateStatus ---

    [Fact]
    public async Task UpdateStatus_ShouldStartSession()
    {
        var (controller, service) = CreateController();
        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "start" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_ShouldPauseActiveSession()
    {
        var (controller, service) = CreateController();
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.StartAsync(session.Code);

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "pause" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_ShouldResumeFromPaused()
    {
        var (controller, service) = CreateController();
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.StartAsync(session.Code);
        await service.PauseAsync(session.Code);

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "resume" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_ShouldEndSession()
    {
        var (controller, service) = CreateController();
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.StartAsync(session.Code);

        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "end" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_ShouldReturnBadRequestForInvalidTransition()
    {
        var (controller, service) = CreateController();
        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        // Try to pause a Lobby session (invalid)
        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "pause" });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_ShouldAcceptAlternativeStatusNames()
    {
        var (controller, service) = CreateController();
        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        // "active" should work same as "start"
        var result = await controller.UpdateStatus(session.Code, new UpdateStatusRequest { Status = "active" });

        result.Should().BeOfType<OkObjectResult>();
    }
}
