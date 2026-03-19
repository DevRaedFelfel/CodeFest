namespace CodeFest.Api.DTOs;

public class SubmissionResult
{
    public bool Success { get; set; }
    public int TestsPassed { get; set; }
    public int TestsTotal { get; set; }
    public bool AllPassed { get; set; }
    public int PointsAwarded { get; set; }
    public string? CompileError { get; set; }
    public string? RuntimeError { get; set; }
    public List<TestCaseResult> TestResults { get; set; } = new();
    public List<PatternCheckResult> PatternResults { get; set; } = new();
    public long ExecutionTimeMs { get; set; }
}

public class TestCaseResult
{
    public int TestCaseId { get; set; }
    public string? Description { get; set; }
    public bool Passed { get; set; }
    public string? ExpectedOutput { get; set; }
    public string? ActualOutput { get; set; }
    public bool IsHidden { get; set; }
    public string? Error { get; set; }
}

public class PatternCheckResult
{
    public bool Passed { get; set; }
    public string FailureMessage { get; set; } = string.Empty;
}
