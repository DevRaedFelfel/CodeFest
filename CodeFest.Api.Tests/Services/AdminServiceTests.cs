using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;

namespace CodeFest.Api.Tests.Services;

public class AdminServiceTests
{
    private AdminService CreateService(out Data.CodeFestDbContext db)
    {
        db = TestDbContext.Create();
        TestDbContext.SeedAsync(db).Wait();
        return new AdminService(db, new FileImportService());
    }

    // --- User Tests ---

    [Fact]
    public async Task GetUsers_ReturnsAllUsers()
    {
        var service = CreateService(out var db);
        var result = await service.GetUsersAsync(null, null);

        Assert.Equal(5, result.TotalCount);
        Assert.Equal(5, result.Items.Count);
    }

    [Fact]
    public async Task GetUsers_FiltersByRole()
    {
        var service = CreateService(out _);
        var result = await service.GetUsersAsync("Student", null);

        Assert.Equal(3, result.TotalCount); // student1, student2, inactive
        Assert.All(result.Items, u => Assert.Equal("Student", u.Role));
    }

    [Fact]
    public async Task GetUsers_SearchesByName()
    {
        var service = CreateService(out _);
        var result = await service.GetUsersAsync(null, "Alice");

        Assert.Single(result.Items);
        Assert.Equal("Alice", result.Items[0].DisplayName);
    }

    [Fact]
    public async Task GetUsers_SearchesByEmail()
    {
        var service = CreateService(out _);
        var result = await service.GetUsersAsync(null, "instructor@test.com");

        Assert.Single(result.Items);
        Assert.Equal("instructor@test.com", result.Items[0].Email);
    }

    [Fact]
    public async Task CreateUser_CreatesSuccessfully()
    {
        var service = CreateService(out var db);
        var result = await service.CreateUserAsync(new CreateUserRequest("new@test.com", "New User", "Student"));

        Assert.NotNull(result);
        Assert.Equal("new@test.com", result.Email);
        Assert.Equal("Student", result.Role);
        Assert.True(db.Users.Any(u => u.Email == "new@test.com"));
    }

    [Fact]
    public async Task CreateUser_RejectsInvalidRole()
    {
        var service = CreateService(out _);
        var result = await service.CreateUserAsync(new CreateUserRequest("new@test.com", "New", "InvalidRole"));

        Assert.Null(result);
    }

    [Fact]
    public async Task CreateUser_RejectsDuplicateEmail()
    {
        var service = CreateService(out _);
        var result = await service.CreateUserAsync(new CreateUserRequest("student1@test.com", "Dup", "Student"));

        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateUser_UpdatesFields()
    {
        var service = CreateService(out _);
        var result = await service.UpdateUserAsync(3, new UpdateUserRequest("Alice Updated", null, null));

        Assert.NotNull(result);
        Assert.Equal("Alice Updated", result.DisplayName);
    }

    [Fact]
    public async Task UpdateUser_ReturnsNullForNonexistent()
    {
        var service = CreateService(out _);
        var result = await service.UpdateUserAsync(999, new UpdateUserRequest("X", null, null));

        Assert.Null(result);
    }

    [Fact]
    public async Task DeactivateUser_SetsInactive()
    {
        var service = CreateService(out var db);
        var result = await service.DeactivateUserAsync(3);

        Assert.True(result);
        Assert.False(db.Users.Find(3)!.IsActive);
    }

    // --- Course Tests ---

    [Fact]
    public async Task GetCourses_ReturnsAllCourses()
    {
        var service = CreateService(out _);
        var courses = await service.GetCoursesAsync();

        Assert.Equal(2, courses.Count);
    }

    [Fact]
    public async Task CreateCourse_CreatesSuccessfully()
    {
        var service = CreateService(out _);
        var result = await service.CreateCourseAsync(new CreateCourseRequest("CS301", "Algorithms", null, 2));

        Assert.NotNull(result);
        Assert.Equal("CS301", result.Code);
        Assert.Equal("Dr. Test", result.InstructorName);
    }

    [Fact]
    public async Task CreateCourse_RejectsDuplicateCode()
    {
        var service = CreateService(out _);
        var result = await service.CreateCourseAsync(new CreateCourseRequest("CS101", "Duplicate", null, 2));

        Assert.Null(result);
    }

    [Fact]
    public async Task CreateCourse_RejectsStudentAsInstructor()
    {
        var service = CreateService(out _);
        var result = await service.CreateCourseAsync(new CreateCourseRequest("CS301", "Algorithms", null, 3)); // student id

        Assert.Null(result);
    }

    [Fact]
    public async Task DeactivateCourse_SetsInactive()
    {
        var service = CreateService(out var db);
        var result = await service.DeactivateCourseAsync(1);

        Assert.True(result);
        Assert.False(db.Courses.Find(1)!.IsActive);
    }

    // --- Enrollment Tests ---

    [Fact]
    public async Task GetEnrollments_ReturnsAll()
    {
        var service = CreateService(out _);
        var result = await service.GetEnrollmentsAsync(null, null);

        Assert.Equal(2, result.TotalCount);
    }

    [Fact]
    public async Task GetEnrollments_FiltersByCourseId()
    {
        var service = CreateService(out _);
        var result = await service.GetEnrollmentsAsync(1, null);

        Assert.Equal(2, result.TotalCount);

        var result2 = await service.GetEnrollmentsAsync(2, null);
        Assert.Equal(0, result2.TotalCount);
    }

    [Fact]
    public async Task CreateEnrollment_CreatesSuccessfully()
    {
        var service = CreateService(out _);
        var result = await service.CreateEnrollmentAsync(new CreateEnrollmentRequest(3, 2)); // student 3 in course 2

        Assert.NotNull(result);
        Assert.Equal("Alice", result.StudentName);
        Assert.Equal("CS201", result.CourseCode);
    }

    [Fact]
    public async Task CreateEnrollment_RejectsDuplicate()
    {
        var service = CreateService(out _);
        var result = await service.CreateEnrollmentAsync(new CreateEnrollmentRequest(3, 1)); // Already enrolled

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteEnrollment_SetsDropped()
    {
        var service = CreateService(out var db);
        var result = await service.DeleteEnrollmentAsync(1);

        Assert.True(result);
        Assert.Equal(EnrollmentStatus.Dropped, db.Enrollments.Find(1)!.Status);
    }

    // --- Enrollment Request Tests ---

    [Fact]
    public async Task ReviewEnrollmentRequest_ApprovesAndCreatesEnrollment()
    {
        var service = CreateService(out var db);

        // Create a pending request
        db.EnrollmentRequests.Add(new EnrollmentRequest
        {
            Id = 1,
            StudentUserId = 4, // Bob
            CourseId = 2, // CS201
            Status = EnrollmentRequestStatus.Pending,
            RequestedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await service.ReviewEnrollmentRequestAsync(1, "Approved", 1);

        Assert.True(result);
        var request = db.EnrollmentRequests.Find(1)!;
        Assert.Equal(EnrollmentRequestStatus.Approved, request.Status);
        Assert.NotNull(request.ReviewedAt);

        // Enrollment should be created
        Assert.True(db.Enrollments.Any(e => e.StudentId == 4 && e.CourseId == 2));
    }

    [Fact]
    public async Task ReviewEnrollmentRequest_RejectsWithoutCreatingEnrollment()
    {
        var service = CreateService(out var db);

        db.EnrollmentRequests.Add(new EnrollmentRequest
        {
            Id = 1,
            StudentUserId = 4,
            CourseId = 2,
            Status = EnrollmentRequestStatus.Pending,
            RequestedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await service.ReviewEnrollmentRequestAsync(1, "Rejected", 1);

        Assert.True(result);
        Assert.False(db.Enrollments.Any(e => e.StudentId == 4 && e.CourseId == 2));
    }

    // --- Academic Load Tests ---

    [Fact]
    public async Task GetAcademicLoads_ReturnsAll()
    {
        var service = CreateService(out _);
        var loads = await service.GetAcademicLoadsAsync();

        Assert.Single(loads);
        Assert.Equal("Spring 2026", loads[0].Term);
    }

    [Fact]
    public async Task CreateAcademicLoad_CreatesSuccessfully()
    {
        var service = CreateService(out _);
        var result = await service.CreateAcademicLoadAsync(new CreateAcademicLoadRequest(2, 2, "Fall 2026"));

        Assert.NotNull(result);
        Assert.Equal("CS201", result.CourseCode);
        Assert.Equal("Fall 2026", result.Term);
    }

    [Fact]
    public async Task CreateAcademicLoad_RejectsDuplicate()
    {
        var service = CreateService(out _);
        var result = await service.CreateAcademicLoadAsync(new CreateAcademicLoadRequest(2, 1, "Dup")); // Already exists

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteAcademicLoad_RemovesRecord()
    {
        var service = CreateService(out var db);
        var result = await service.DeleteAcademicLoadAsync(1);

        Assert.True(result);
        Assert.Null(db.AcademicLoads.Find(1));
    }
}
