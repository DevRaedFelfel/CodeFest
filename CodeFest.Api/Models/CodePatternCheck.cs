namespace CodeFest.Api.Models;

public class CodePatternCheck
{
    public int Id { get; set; }
    public int ChallengeId { get; set; }
    public Challenge Challenge { get; set; } = null!;
    public PatternCheckType Type { get; set; }
    public string Pattern { get; set; } = string.Empty;
    public bool IsRegex { get; set; }
    public string FailureMessage { get; set; } = string.Empty;
}

public enum PatternCheckType
{
    MustContain,
    MustNotContain
}
