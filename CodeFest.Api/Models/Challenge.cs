namespace CodeFest.Api.Models;

public class Challenge
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string StarterCode { get; set; } = string.Empty;
    public int Order { get; set; }
    public int Points { get; set; } = 100;
    public int TimeLimitSeconds { get; set; } = 300;
    public DifficultyLevel Difficulty { get; set; }
    public List<TestCase> TestCases { get; set; } = new();
    public List<CodePatternCheck> PatternChecks { get; set; } = new();
}

public enum DifficultyLevel { Easy, Medium, Hard, Boss }
