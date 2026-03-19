namespace CodeFest.Api.Models;

public class Leaderboard
{
    public int SessionId { get; set; }
    public List<LeaderboardEntry> Entries { get; set; } = new();
}

public class LeaderboardEntry
{
    public int StudentId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public int TotalPoints { get; set; }
    public int ChallengesCompleted { get; set; }
    public int Rank { get; set; }
}
