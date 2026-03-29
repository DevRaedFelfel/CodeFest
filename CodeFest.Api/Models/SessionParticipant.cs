namespace CodeFest.Api.Models;

public class SessionParticipant
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public Session Session { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string ConnectionId { get; set; } = string.Empty;
    public int CurrentChallengeIndex { get; set; }
    public int TotalPoints { get; set; }
    public DateTime JoinedAt { get; set; }
    public bool IsConnected { get; set; }
    public StudentClientType ClientType { get; set; }
}
