namespace CodeFest.Api.Models;

public class Session
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public SessionStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string TeacherConnectionId { get; set; } = string.Empty;
    public List<int> ChallengeIds { get; set; } = new();
    public List<Student> Students { get; set; } = new();
}

public enum SessionStatus { Lobby, Active, Paused, Ended }
