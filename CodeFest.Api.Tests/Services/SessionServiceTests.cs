using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;
using FluentAssertions;

namespace CodeFest.Api.Tests.Services;

public class SessionServiceTests
{
    private SessionService CreateService(string? dbName = null)
    {
        var db = TestDbContextFactory.Create(dbName);
        return new SessionService(db);
    }

    // --- CreateAsync ---

    [Fact]
    public async Task CreateAsync_ShouldCreateSessionWithLobbyStatus()
    {
        var service = CreateService();

        var session = await service.CreateAsync("Test Session", new List<int> { 1, 2, 3 }, "conn-123");

        session.Should().NotBeNull();
        session.Name.Should().Be("Test Session");
        session.Status.Should().Be(SessionStatus.Lobby);
        session.ChallengeIds.Should().BeEquivalentTo(new[] { 1, 2, 3 });
        session.TeacherConnectionId.Should().Be("conn-123");
        session.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task CreateAsync_ShouldGenerateSixCharCode()
    {
        var service = CreateService();

        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        session.Code.Should().HaveLength(6);
        session.Code.Should().MatchRegex("^[A-Z0-9]+$");
    }

    [Fact]
    public async Task CreateAsync_ShouldGenerateUniqueCodesForMultipleSessions()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);

        var session1 = await service.CreateAsync("Session 1", new List<int>(), "conn1");
        var session2 = await service.CreateAsync("Session 2", new List<int>(), "conn2");

        session1.Code.Should().NotBe(session2.Code);
    }

    // --- GetByCodeAsync ---

    [Fact]
    public async Task GetByCodeAsync_ShouldReturnNullForNonexistentCode()
    {
        var service = CreateService();

        var result = await service.GetByCodeAsync("NONEXIST");

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByCodeAsync_ShouldReturnSessionWithStudents()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);

        var session = await service.CreateAsync("Test", new List<int> { 1 }, "conn");
        await service.JoinStudentAsync(session.Code, "Ali", "student-conn", StudentClientType.Web);

        var result = await service.GetByCodeAsync(session.Code);

        result.Should().NotBeNull();
        result!.Students.Should().HaveCount(1);
        result.Students[0].DisplayName.Should().Be("Ali");
    }

    // --- GetAllAsync ---

    [Fact]
    public async Task GetAllAsync_ShouldReturnSessionsOrderedByCreatedAtDesc()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);

        await service.CreateAsync("First", new List<int>(), "c1");
        await Task.Delay(10);
        await service.CreateAsync("Second", new List<int>(), "c2");

        var sessions = await service.GetAllAsync();

        sessions.Should().HaveCount(2);
        sessions[0].Name.Should().Be("Second");
        sessions[1].Name.Should().Be("First");
    }

    // --- StartAsync ---

    [Fact]
    public async Task StartAsync_ShouldTransitionFromLobbyToActive()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        var result = await service.StartAsync(session.Code);

        result.Should().NotBeNull();
        result!.Status.Should().Be(SessionStatus.Active);
        result.StartedAt.Should().NotBeNull();
        result.StartedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task StartAsync_ShouldReturnNullForNonLobbySession()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.StartAsync(session.Code); // Now Active

        var result = await service.StartAsync(session.Code); // Try again

        result.Should().BeNull();
    }

    [Fact]
    public async Task StartAsync_ShouldReturnNullForNonexistentSession()
    {
        var service = CreateService();

        var result = await service.StartAsync("NOPE");

        result.Should().BeNull();
    }

    // --- PauseAsync ---

    [Fact]
    public async Task PauseAsync_ShouldTransitionFromActiveToPaused()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.StartAsync(session.Code);

        var result = await service.PauseAsync(session.Code);

        result.Should().NotBeNull();
        result!.Status.Should().Be(SessionStatus.Paused);
    }

    [Fact]
    public async Task PauseAsync_ShouldReturnNullForNonActiveSession()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        var result = await service.PauseAsync(session.Code); // Still Lobby

        result.Should().BeNull();
    }

    // --- ResumeAsync ---

    [Fact]
    public async Task ResumeAsync_ShouldTransitionFromPausedToActive()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.StartAsync(session.Code);
        await service.PauseAsync(session.Code);

        var result = await service.ResumeAsync(session.Code);

        result.Should().NotBeNull();
        result!.Status.Should().Be(SessionStatus.Active);
    }

    [Fact]
    public async Task ResumeAsync_ShouldReturnNullForNonPausedSession()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.StartAsync(session.Code); // Active, not paused

        var result = await service.ResumeAsync(session.Code);

        result.Should().BeNull();
    }

    // --- EndAsync ---

    [Fact]
    public async Task EndAsync_ShouldTransitionToEnded()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.StartAsync(session.Code);

        var result = await service.EndAsync(session.Code);

        result.Should().NotBeNull();
        result!.Status.Should().Be(SessionStatus.Ended);
        result.EndedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task EndAsync_ShouldReturnNullForNonexistentSession()
    {
        var service = CreateService();

        var result = await service.EndAsync("NOPE");

        result.Should().BeNull();
    }

    // --- JoinStudentAsync ---

    [Fact]
    public async Task JoinStudentAsync_ShouldAddNewStudent()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        var student = await service.JoinStudentAsync(session.Code, "Ali", "student-conn", StudentClientType.Web);

        student.Should().NotBeNull();
        student.DisplayName.Should().Be("Ali");
        student.SessionId.Should().Be(session.Id);
        student.IsConnected.Should().BeTrue();
        student.CurrentChallengeIndex.Should().Be(0);
        student.TotalPoints.Should().Be(0);
        student.ClientType.Should().Be(StudentClientType.Web);
    }

    [Fact]
    public async Task JoinStudentAsync_ShouldReconnectExistingStudentByDisplayName()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        var first = await service.JoinStudentAsync(session.Code, "Ali", "conn-1", StudentClientType.Web);
        await service.DisconnectStudentAsync("conn-1");
        var second = await service.JoinStudentAsync(session.Code, "Ali", "conn-2", StudentClientType.Web);

        second.Id.Should().Be(first.Id);
        second.ConnectionId.Should().Be("conn-2");
        second.IsConnected.Should().BeTrue();
    }

    [Fact]
    public async Task JoinStudentAsync_ShouldThrowForNonexistentSession()
    {
        var service = CreateService();

        var act = () => service.JoinStudentAsync("NOPE", "Ali", "conn", StudentClientType.Web);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Session not found.");
    }

    [Fact]
    public async Task JoinStudentAsync_ShouldThrowForEndedSession()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.StartAsync(session.Code);
        await service.EndAsync(session.Code);

        var act = () => service.JoinStudentAsync(session.Code, "Ali", "conn", StudentClientType.Web);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Session has ended.");
    }

    [Fact]
    public async Task JoinStudentAsync_ShouldSupportAndroidClientType()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        var student = await service.JoinStudentAsync(session.Code, "Omar", "conn-1", StudentClientType.Android);

        student.ClientType.Should().Be(StudentClientType.Android);
    }

    // --- DisconnectStudentAsync ---

    [Fact]
    public async Task DisconnectStudentAsync_ShouldSetIsConnectedToFalse()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        var student = await service.JoinStudentAsync(session.Code, "Ali", "student-conn", StudentClientType.Web);

        await service.DisconnectStudentAsync("student-conn");

        var found = await service.GetStudentByIdAsync(student.Id);
        found!.IsConnected.Should().BeFalse();
    }

    [Fact]
    public async Task DisconnectStudentAsync_ShouldDoNothingForUnknownConnection()
    {
        var service = CreateService();

        // Should not throw
        await service.DisconnectStudentAsync("unknown-conn");
    }

    // --- GetStudentByConnectionIdAsync ---

    [Fact]
    public async Task GetStudentByConnectionIdAsync_ShouldFindStudent()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        await service.JoinStudentAsync(session.Code, "Ali", "student-conn", StudentClientType.Web);

        var found = await service.GetStudentByConnectionIdAsync("student-conn");

        found.Should().NotBeNull();
        found!.DisplayName.Should().Be("Ali");
    }

    [Fact]
    public async Task GetStudentByConnectionIdAsync_ShouldReturnNullForUnknown()
    {
        var service = CreateService();

        var result = await service.GetStudentByConnectionIdAsync("unknown");

        result.Should().BeNull();
    }

    // --- UpdateStudentPointsAsync ---

    [Fact]
    public async Task UpdateStudentPointsAsync_ShouldAddPointsAndUpdateIndex()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        var student = await service.JoinStudentAsync(session.Code, "Ali", "student-conn", StudentClientType.Web);

        await service.UpdateStudentPointsAsync(student.Id, 100, 1);

        var found = await service.GetStudentByIdAsync(student.Id);
        found!.TotalPoints.Should().Be(100);
        found.CurrentChallengeIndex.Should().Be(1);
    }

    [Fact]
    public async Task UpdateStudentPointsAsync_ShouldAccumulatePoints()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");
        var student = await service.JoinStudentAsync(session.Code, "Ali", "conn", StudentClientType.Web);

        await service.UpdateStudentPointsAsync(student.Id, 100, 1);
        await service.UpdateStudentPointsAsync(student.Id, 200, 2);

        var found = await service.GetStudentByIdAsync(student.Id);
        found!.TotalPoints.Should().Be(300);
        found.CurrentChallengeIndex.Should().Be(2);
    }

    // --- GetLeaderboardAsync ---

    [Fact]
    public async Task GetLeaderboardAsync_ShouldReturnStudentsRankedByPointsDesc()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "conn");

        var ali = await service.JoinStudentAsync(session.Code, "Ali", "c1", StudentClientType.Web);
        var sara = await service.JoinStudentAsync(session.Code, "Sara", "c2", StudentClientType.Web);
        var omar = await service.JoinStudentAsync(session.Code, "Omar", "c3", StudentClientType.Web);

        await service.UpdateStudentPointsAsync(ali.Id, 150, 1);
        await service.UpdateStudentPointsAsync(sara.Id, 300, 2);
        await service.UpdateStudentPointsAsync(omar.Id, 50, 0);

        var leaderboard = await service.GetLeaderboardAsync(session.Code);

        leaderboard.Should().HaveCount(3);
        leaderboard[0].DisplayName.Should().Be("Sara");
        leaderboard[0].Rank.Should().Be(1);
        leaderboard[0].TotalPoints.Should().Be(300);
        leaderboard[1].DisplayName.Should().Be("Ali");
        leaderboard[1].Rank.Should().Be(2);
        leaderboard[2].DisplayName.Should().Be("Omar");
        leaderboard[2].Rank.Should().Be(3);
    }

    [Fact]
    public async Task GetLeaderboardAsync_ShouldReturnEmptyForNonexistentSession()
    {
        var service = CreateService();

        var result = await service.GetLeaderboardAsync("NOPE");

        result.Should().BeEmpty();
    }

    // --- UpdateTeacherConnectionAsync ---

    [Fact]
    public async Task UpdateTeacherConnectionAsync_ShouldUpdateConnectionId()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var session = await service.CreateAsync("Test", new List<int>(), "old-conn");

        await service.UpdateTeacherConnectionAsync(session.Code, "new-conn");

        var found = await service.GetByCodeAsync(session.Code);
        found!.TeacherConnectionId.Should().Be("new-conn");
    }
}
