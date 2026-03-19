using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;
using FluentAssertions;

namespace CodeFest.Api.Tests.Services;

public class ActivityLogServiceTests
{
    private (ActivityLogService service, SessionService sessionService) CreateServices(string? dbName = null)
    {
        dbName ??= Guid.NewGuid().ToString();
        var db = TestDbContextFactory.Create(dbName);
        return (new ActivityLogService(db), new SessionService(db));
    }

    private async Task<(Session session, Student student)> SeedSessionWithStudent(SessionService sessionService)
    {
        var session = await sessionService.CreateAsync("Test Session", new List<int>(), "teacher-conn");
        var student = await sessionService.JoinStudentAsync(session.Code, "Ali", "student-conn", StudentClientType.Web);
        return (session, student);
    }

    // --- LogAsync ---

    [Fact]
    public async Task LogAsync_ShouldCreateLogEntry()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        var log = await service.LogAsync(student.Id, session.Id, ActivityType.Joined);

        log.Should().NotBeNull();
        log.StudentId.Should().Be(student.Id);
        log.SessionId.Should().Be(session.Id);
        log.Type.Should().Be(ActivityType.Joined);
        log.Timestamp.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task LogAsync_ShouldStoreOptionalData()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        var log = await service.LogAsync(student.Id, session.Id, ActivityType.CodeChanged, "{\"snapshot\":\"code\"}");

        log.Data.Should().Be("{\"snapshot\":\"code\"}");
    }

    [Fact]
    public async Task LogAsync_ShouldStoreNullDataWhenNotProvided()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        var log = await service.LogAsync(student.Id, session.Id, ActivityType.Joined);

        log.Data.Should().BeNull();
    }

    // --- GetBySessionAsync ---

    [Fact]
    public async Task GetBySessionAsync_ShouldReturnActivitiesForSession()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        await service.LogAsync(student.Id, session.Id, ActivityType.Joined);
        await service.LogAsync(student.Id, session.Id, ActivityType.CodeChanged, "snapshot1");
        await service.LogAsync(student.Id, session.Id, ActivityType.TabSwitched);

        var activities = await service.GetBySessionAsync(session.Code);

        activities.Should().HaveCount(3);
    }

    [Fact]
    public async Task GetBySessionAsync_ShouldReturnOrderedByTimestampDesc()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        await service.LogAsync(student.Id, session.Id, ActivityType.Joined);
        await Task.Delay(10);
        await service.LogAsync(student.Id, session.Id, ActivityType.TabSwitched);

        var activities = await service.GetBySessionAsync(session.Code);

        activities[0].ActivityType.Should().Be("TabSwitched");
        activities[1].ActivityType.Should().Be("Joined");
    }

    [Fact]
    public async Task GetBySessionAsync_ShouldFilterByType()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        await service.LogAsync(student.Id, session.Id, ActivityType.Joined);
        await service.LogAsync(student.Id, session.Id, ActivityType.TabSwitched);
        await service.LogAsync(student.Id, session.Id, ActivityType.TabReturned);

        var activities = await service.GetBySessionAsync(session.Code, typeFilter: ActivityType.TabSwitched);

        activities.Should().HaveCount(1);
        activities[0].ActivityType.Should().Be("TabSwitched");
    }

    [Fact]
    public async Task GetBySessionAsync_ShouldPaginate()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        for (int i = 0; i < 10; i++)
        {
            await service.LogAsync(student.Id, session.Id, ActivityType.CodeChanged, $"snapshot-{i}");
        }

        var page1 = await service.GetBySessionAsync(session.Code, page: 1, pageSize: 3);
        var page2 = await service.GetBySessionAsync(session.Code, page: 2, pageSize: 3);

        page1.Should().HaveCount(3);
        page2.Should().HaveCount(3);
    }

    [Fact]
    public async Task GetBySessionAsync_ShouldIncludeStudentDisplayName()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        await service.LogAsync(student.Id, session.Id, ActivityType.Joined);

        var activities = await service.GetBySessionAsync(session.Code);

        activities[0].DisplayName.Should().Be("Ali");
    }

    // --- GetByStudentAsync ---

    [Fact]
    public async Task GetByStudentAsync_ShouldReturnActivitiesForStudent()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        await service.LogAsync(student.Id, session.Id, ActivityType.Joined);
        await service.LogAsync(student.Id, session.Id, ActivityType.CodeChanged);

        var activities = await service.GetByStudentAsync(student.Id);

        activities.Should().HaveCount(2);
        activities.Should().AllSatisfy(a => a.StudentId.Should().Be(student.Id));
    }

    [Fact]
    public async Task GetByStudentAsync_ShouldPaginate()
    {
        var (service, sessionService) = CreateServices();
        var (session, student) = await SeedSessionWithStudent(sessionService);

        for (int i = 0; i < 5; i++)
        {
            await service.LogAsync(student.Id, session.Id, ActivityType.CodeChanged);
        }

        var page1 = await service.GetByStudentAsync(student.Id, page: 1, pageSize: 2);
        var page2 = await service.GetByStudentAsync(student.Id, page: 2, pageSize: 2);

        page1.Should().HaveCount(2);
        page2.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetByStudentAsync_ShouldReturnEmptyForNonexistentStudent()
    {
        var (service, _) = CreateServices();

        var activities = await service.GetByStudentAsync(999);

        activities.Should().BeEmpty();
    }
}
