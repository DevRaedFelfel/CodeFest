using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;

namespace CodeFest.Api.Tests.Services;

public class StudentServiceTests
{
    private StudentService CreateService(out Data.CodeFestDbContext db)
    {
        db = TestDbContext.Create();
        TestDbContext.SeedAsync(db).Wait();
        return new StudentService(db);
    }

    [Fact]
    public async Task GetEnrolledCourses_ReturnsEnrolledCourses()
    {
        var service = CreateService(out _);
        var courses = await service.GetEnrolledCoursesAsync(3); // Alice

        Assert.Single(courses); // enrolled in CS101 only
    }

    [Fact]
    public async Task GetEnrolledCourses_ReturnsEmptyForUnenrolled()
    {
        var service = CreateService(out _);
        var courses = await service.GetEnrolledCoursesAsync(5); // inactive student, no enrollments

        Assert.Empty(courses);
    }

    [Fact]
    public async Task GetCourse_ReturnsForEnrolledStudent()
    {
        var service = CreateService(out _);
        var course = await service.GetCourseAsync(1, 3); // Alice enrolled in CS101

        Assert.NotNull(course);
    }

    [Fact]
    public async Task GetCourse_ReturnsNullForUnenrolled()
    {
        var service = CreateService(out _);
        var course = await service.GetCourseAsync(2, 3); // Alice not in CS201

        Assert.Null(course);
    }

    [Fact]
    public async Task RequestEnrollment_Succeeds()
    {
        var service = CreateService(out var db);
        var (success, error) = await service.RequestEnrollmentAsync(3, 2); // Alice requests CS201

        Assert.True(success);
        Assert.True(db.EnrollmentRequests.Any(er => er.StudentUserId == 3 && er.CourseId == 2));
    }

    [Fact]
    public async Task RequestEnrollment_FailsIfAlreadyEnrolled()
    {
        var service = CreateService(out _);
        var (success, error) = await service.RequestEnrollmentAsync(3, 1); // Already enrolled

        Assert.False(success);
        Assert.Equal("Already enrolled", error);
    }

    [Fact]
    public async Task RequestEnrollment_FailsIfPendingExists()
    {
        var service = CreateService(out var db);

        // First request
        await service.RequestEnrollmentAsync(3, 2);

        // Second request
        var (success, error) = await service.RequestEnrollmentAsync(3, 2);

        Assert.False(success);
        Assert.Equal("Request already pending", error);
    }

    [Fact]
    public async Task RequestEnrollment_FailsForNonexistentCourse()
    {
        var service = CreateService(out _);
        var (success, error) = await service.RequestEnrollmentAsync(3, 999);

        Assert.False(success);
        Assert.Equal("Course not found", error);
    }

    [Fact]
    public async Task GetActiveSessions_ReturnsSessionsForEnrolledCourses()
    {
        var service = CreateService(out _);
        var sessions = await service.GetActiveSessionsAsync(3); // Alice enrolled in CS101

        Assert.Single(sessions); // Session "Lab 1" is in Lobby status
    }

    [Fact]
    public async Task GetActiveSessions_ReturnsEmptyForUnenrolledStudent()
    {
        var service = CreateService(out _);
        var sessions = await service.GetActiveSessionsAsync(5); // inactive, no enrollments

        Assert.Empty(sessions);
    }

    [Fact]
    public async Task GetHistory_ReturnsEmptyWhenNoParticipation()
    {
        var service = CreateService(out _);
        var history = await service.GetHistoryAsync(3, null);

        Assert.Empty(history); // No SessionParticipant records seeded
    }

    [Fact]
    public async Task GetHistory_ReturnsParticipations()
    {
        var service = CreateService(out var db);

        db.SessionParticipants.Add(new SessionParticipant
        {
            Id = 1, SessionId = 1, UserId = 3, ConnectionId = "c1",
            TotalPoints = 200, JoinedAt = DateTime.UtcNow, IsConnected = false
        });
        await db.SaveChangesAsync();

        var history = await service.GetHistoryAsync(3, null);

        Assert.Single(history);
    }
}
