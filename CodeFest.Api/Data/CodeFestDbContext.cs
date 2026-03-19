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
        });

        // Student
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
        });

        // ActivityLog
        modelBuilder.Entity<ActivityLog>(e =>
        {
            e.HasIndex(a => a.SessionId);
            e.HasIndex(a => a.StudentId);
            e.HasOne(a => a.Student).WithMany().HasForeignKey(a => a.StudentId);
            e.HasOne(a => a.Session).WithMany().HasForeignKey(a => a.SessionId);
        });
    }
}
