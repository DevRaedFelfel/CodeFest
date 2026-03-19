namespace CodeFest.Api.DTOs;

public class LeaderboardEntryDto
{
    public int StudentId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public int TotalPoints { get; set; }
    public int ChallengesCompleted { get; set; }
    public int Rank { get; set; }
}
