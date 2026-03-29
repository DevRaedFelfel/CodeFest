using System.Text.Json;
using CodeFest.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace CodeFest.Api.Data;

public class CodeFestDbContext : DbContext
{
    public CodeFestDbContext(DbContextOptions<CodeFestDbContext> options) : base(options) { }

    public DbSet<Challenge> Challenges => Set<Challenge>();
    public DbSet<TestCase> TestCases => Set<TestCase>();
    public DbSet<CodePatternCheck> CodePatternChecks => Set<CodePatternCheck>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    // --- NEW DBSETS ---
    public DbSet<User> Users => Set<User>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<AcademicLoad> AcademicLoads => Set<AcademicLoad>();
    public DbSet<EnrollmentRequest> EnrollmentRequests => Set<EnrollmentRequest>();
    public DbSet<SessionParticipant> SessionParticipants => Set<SessionParticipant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Challenge
        modelBuilder.Entity<Challenge>(e =>
        {
            e.HasMany(c => c.TestCases)
                .WithOne(t => t.Challenge)
                .HasForeignKey(t => t.ChallengeId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasMany(c => c.PatternChecks)
                .WithOne(p => p.Challenge)
                .HasForeignKey(p => p.ChallengeId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(c => c.Course)
                .WithMany(co => co.Challenges)
                .HasForeignKey(c => c.CourseId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Session
        modelBuilder.Entity<Session>(e =>
        {
            e.HasIndex(s => s.Code).IsUnique();

            e.Property(s => s.ChallengeIds)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<int>>(v, (JsonSerializerOptions?)null) ?? new List<int>())
                .HasColumnType("jsonb")
                .Metadata.SetValueComparer(new ValueComparer<List<int>>(
                    (a, b) => a != null && b != null && a.SequenceEqual(b),
                    c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList()));

            e.HasMany(s => s.Students)
                .WithOne(st => st.Session)
                .HasForeignKey(st => st.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(s => s.Course)
                .WithMany(c => c.Sessions)
                .HasForeignKey(s => s.CourseId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasOne(s => s.CreatedBy)
                .WithMany()
                .HasForeignKey(s => s.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasMany(s => s.Participants)
                .WithOne(p => p.Session)
                .HasForeignKey(p => p.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Student (legacy — kept for backward compat)
        modelBuilder.Entity<Student>(e =>
        {
            e.HasIndex(s => s.SessionId);
        });

        // Submission
        modelBuilder.Entity<Submission>(e =>
        {
            e.HasIndex(s => s.StudentId);
            e.HasIndex(s => s.SessionId);
            e.HasOne(s => s.Student).WithMany().HasForeignKey(s => s.StudentId);
            e.HasOne(s => s.Challenge).WithMany().HasForeignKey(s => s.ChallengeId);
            e.HasOne(s => s.Session).WithMany().HasForeignKey(s => s.SessionId);
            e.HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.SetNull);
        });

        // ActivityLog
        modelBuilder.Entity<ActivityLog>(e =>
        {
            e.HasIndex(a => a.SessionId);
            e.HasIndex(a => a.StudentId);
            e.HasOne(a => a.Student).WithMany().HasForeignKey(a => a.StudentId);
            e.HasOne(a => a.Session).WithMany().HasForeignKey(a => a.SessionId);
            e.HasOne(a => a.User).WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.SetNull);
        });

        // --- NEW ENTITIES ---

        // User
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
        });

        // Course
        modelBuilder.Entity<Course>(e =>
        {
            e.HasIndex(c => c.Code).IsUnique();
            e.HasOne(c => c.Instructor)
                .WithMany()
                .HasForeignKey(c => c.InstructorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Enrollment
        modelBuilder.Entity<Enrollment>(e =>
        {
            e.HasIndex(en => new { en.StudentId, en.CourseId }).IsUnique();
            e.HasOne(en => en.Student)
                .WithMany()
                .HasForeignKey(en => en.StudentId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(en => en.Course)
                .WithMany(c => c.Enrollments)
                .HasForeignKey(en => en.CourseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // AcademicLoad
        modelBuilder.Entity<AcademicLoad>(e =>
        {
            e.HasIndex(al => new { al.InstructorId, al.CourseId }).IsUnique();
            e.HasOne(al => al.Instructor)
                .WithMany()
                .HasForeignKey(al => al.InstructorId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(al => al.Course)
                .WithMany()
                .HasForeignKey(al => al.CourseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // EnrollmentRequest
        modelBuilder.Entity<EnrollmentRequest>(e =>
        {
            e.HasOne(er => er.Student)
                .WithMany()
                .HasForeignKey(er => er.StudentUserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(er => er.Course)
                .WithMany()
                .HasForeignKey(er => er.CourseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // SessionParticipant
        modelBuilder.Entity<SessionParticipant>(e =>
        {
            e.HasIndex(sp => new { sp.SessionId, sp.UserId }).IsUnique();
            e.HasOne(sp => sp.User)
                .WithMany()
                .HasForeignKey(sp => sp.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
