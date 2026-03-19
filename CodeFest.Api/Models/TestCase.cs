namespace CodeFest.Api.Models;

public class TestCase
{
    public int Id { get; set; }
    public int ChallengeId { get; set; }
    public Challenge Challenge { get; set; } = null!;
    public string Input { get; set; } = string.Empty;
    public string ExpectedOutput { get; set; } = string.Empty;
    public bool IsHidden { get; set; }
    public int Order { get; set; }
    public string? Description { get; set; }
}
