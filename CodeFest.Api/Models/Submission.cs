namespace CodeFest.Api.Models;

public class Submission
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public int ChallengeId { get; set; }
    public Challenge Challenge { get; set; } = null!;
    public int SessionId { get; set; }
    public Session Session { get; set; } = null!;
    public string Code { get; set; } = string.Empty;
    public int TestsPassed { get; set; }
    public int TestsTotal { get; set; }
    public bool AllPassed { get; set; }
    public int PointsAwarded { get; set; }
    public string? CompileError { get; set; }
    public string? RuntimeError { get; set; }
    public string? Output { get; set; }
    public long ExecutionTimeMs { get; set; }
    public DateTime SubmittedAt { get; set; }
}
