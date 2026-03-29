using CodeFest.Api.Data;
using CodeFest.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Tests.Helpers;

public static class TestDbContext
{
    public static CodeFestDbContext Create(string? dbName = null)
    {
        var options = new DbContextOptionsBuilder<CodeFestDbContext>()
            .UseInMemoryDatabase(databaseName: dbName ?? Guid.NewGuid().ToString())
            .Options;

        var context = new CodeFestDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    public static async Task<CodeFestDbContext> CreateWithSeedAsync(string? dbName = null)
    {
        var db = Create(dbName);
        await SeedAsync(db);
        return db;
    }

    public static async Task SeedAsync(CodeFestDbContext db)
    {
        // Super Admin
        var admin = new User { Id = 1, Email = "admin@test.com", DisplayName = "Admin", Role = UserRole.SuperAdmin, CreatedAt = DateTime.UtcNow, IsActive = true };
        // Instructor
        var instructor = new User { Id = 2, Email = "instructor@test.com", DisplayName = "Dr. Test", Role = UserRole.Instructor, CreatedAt = DateTime.UtcNow, IsActive = true };
        // Students
        var student1 = new User { Id = 3, Email = "student1@test.com", DisplayName = "Alice", Role = UserRole.Student, CreatedAt = DateTime.UtcNow, IsActive = true };
        var student2 = new User { Id = 4, Email = "student2@test.com", DisplayName = "Bob", Role = UserRole.Student, CreatedAt = DateTime.UtcNow, IsActive = true };
        var inactiveStudent = new User { Id = 5, Email = "inactive@test.com", DisplayName = "Inactive", Role = UserRole.Student, CreatedAt = DateTime.UtcNow, IsActive = false };

        db.Users.AddRange(admin, instructor, student1, student2, inactiveStudent);

        // Course
        var course = new Course { Id = 1, Code = "CS101", Name = "Intro to Programming", InstructorId = 2, CreatedAt = DateTime.UtcNow, IsActive = true };
        var course2 = new Course { Id = 2, Code = "CS201", Name = "Data Structures", InstructorId = 2, CreatedAt = DateTime.UtcNow, IsActive = true };
        db.Courses.AddRange(course, course2);

        // Enrollments
        db.Enrollments.AddRange(
            new Enrollment { Id = 1, StudentId = 3, CourseId = 1, Status = EnrollmentStatus.Active, EnrolledAt = DateTime.UtcNow },
            new Enrollment { Id = 2, StudentId = 4, CourseId = 1, Status = EnrollmentStatus.Active, EnrolledAt = DateTime.UtcNow }
        );

        // Academic Load
        db.AcademicLoads.Add(new AcademicLoad { Id = 1, InstructorId = 2, CourseId = 1, Term = "Spring 2026", IsActive = true, AssignedAt = DateTime.UtcNow });

        // Challenge
        db.Challenges.Add(new Challenge { Id = 1, Title = "Hello World", Description = "Print hello", StarterCode = "", Order = 1, Points = 100, CourseId = 1 });

        // Session
        db.Sessions.Add(new Session { Id = 1, Code = "ABC123", Name = "Lab 1", Status = SessionStatus.Lobby, CreatedAt = DateTime.UtcNow, CourseId = 1, CreatedByUserId = 2, TeacherConnectionId = "conn1" });

        await db.SaveChangesAsync();
    }
}
