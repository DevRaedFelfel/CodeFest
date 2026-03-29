using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;
using Microsoft.Extensions.Configuration;

namespace CodeFest.Api.Tests.Services;

public class InstructorServiceTests
{
    private InstructorService CreateService(out Data.CodeFestDbContext db)
    {
        db = TestDbContext.Create();
        TestDbContext.SeedAsync(db).Wait();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CodeFest:Session:ShareableLinkBase"] = "https://test.com/join"
            })
            .Build();
        var qrService = new QrCodeService(config);
        return new InstructorService(db, qrService);
    }

    [Fact]
    public async Task GetInstructorCourses_ReturnsOnlyOwnCourses()
    {
        var service = CreateService(out _);
        var courses = await service.GetInstructorCoursesAsync(2); // instructor

        Assert.Equal(2, courses.Count);
    }

    [Fact]
    public async Task GetInstructorCourses_ReturnsEmptyForStudent()
    {
        var service = CreateService(out _);
        var courses = await service.GetInstructorCoursesAsync(3); // student

        Assert.Empty(courses);
    }

    [Fact]
    public async Task GetCourse_ReturnsForOwner()
    {
        var service = CreateService(out _);
        var course = await service.GetCourseAsync(1, 2); // instructor owns CS101

        Assert.NotNull(course);
        Assert.Equal("CS101", course.Code);
    }

    [Fact]
    public async Task GetCourse_ReturnsNullForNonOwner()
    {
        var service = CreateService(out _);
        var course = await service.GetCourseAsync(1, 3); // student can't access

        Assert.Null(course);
    }

    [Fact]
    public async Task GetCourseStudents_ReturnsEnrolledStudents()
    {
        var service = CreateService(out _);
        var students = await service.GetCourseStudentsAsync(1, 2);

        Assert.Equal(2, students.Count);
    }

    [Fact]
    public async Task GetCourseStudents_ReturnsEmptyForNonOwner()
    {
        var service = CreateService(out _);
        var students = await service.GetCourseStudentsAsync(1, 3);

        Assert.Empty(students);
    }

    [Fact]
    public async Task EnrollStudent_EnrollsSuccessfully()
    {
        var service = CreateService(out _);
        var result = await service.EnrollStudentAsync(2, 3, 2); // student 3 in course 2 by instructor 2

        Assert.NotNull(result);
        Assert.Equal("Alice", result.StudentName);
    }

    [Fact]
    public async Task EnrollStudent_FailsForNonOwner()
    {
        var service = CreateService(out _);
        var result = await service.EnrollStudentAsync(1, 4, 3); // student can't enroll others

        Assert.Null(result);
    }

    [Fact]
    public async Task GetCourseChallenges_ReturnsChallenges()
    {
        var service = CreateService(out _);
        var challenges = await service.GetCourseChallengesAsync(1, 2);

        Assert.Single(challenges);
        Assert.Equal("Hello World", challenges[0].Title);
    }

    [Fact]
    public async Task CreateChallenge_CreatesSuccessfully()
    {
        var service = CreateService(out _);
        var challenge = new Challenge { Title = "New Challenge", Description = "Test", StarterCode = "", Order = 2, Points = 50 };
        var result = await service.CreateChallengeAsync(1, challenge, 2);

        Assert.NotNull(result);
        Assert.Equal("New Challenge", result.Title);
        Assert.Equal(1, result.CourseId);
    }

    [Fact]
    public async Task CreateChallenge_FailsForNonOwner()
    {
        var service = CreateService(out _);
        var challenge = new Challenge { Title = "Fail", Description = "Test", StarterCode = "", Order = 2 };
        var result = await service.CreateChallengeAsync(1, challenge, 3);

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteChallenge_DeletesSuccessfully()
    {
        var service = CreateService(out var db);
        var result = await service.DeleteChallengeAsync(1, 2);

        Assert.True(result);
        Assert.Null(db.Challenges.Find(1));
    }

    [Fact]
    public async Task DeleteChallenge_FailsForNonOwner()
    {
        var service = CreateService(out _);
        var result = await service.DeleteChallengeAsync(1, 3);

        Assert.False(result);
    }

    [Fact]
    public async Task CreateSession_CreatesWithQrCode()
    {
        var service = CreateService(out _);
        var result = await service.CreateSessionAsync(1, "Test Session", new List<int> { 1 }, "conn1", 2);

        Assert.NotNull(result);
        // Result is anonymous type, check it's not null
        var json = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.Contains("shareableLink", json);
        Assert.Contains("qrCodeBase64", json);
        Assert.Contains("joinCode", json);
    }

    [Fact]
    public async Task CreateSession_FailsForNonOwner()
    {
        var service = CreateService(out _);
        var result = await service.CreateSessionAsync(1, "Fail", new List<int>(), "conn1", 3);

        Assert.Null(result);
    }
}
