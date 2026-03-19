namespace CodeFest.Api.Models;

public class ActivityLog
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public int SessionId { get; set; }
    public Session Session { get; set; } = null!;
    public ActivityType Type { get; set; }
    public string? Data { get; set; }
    public DateTime Timestamp { get; set; }
}

public enum ActivityType
{
    Joined,
    Disconnected,
    Reconnected,
    CodeChanged,
    SubmissionAttempt,
    TestPassed,
    TestFailed,
    ChallengeCompleted,
    TabSwitched,
    TabReturned,
    CopyPaste,
    FullscreenExited,
    FullscreenResumed,
    HintRequested,
    ChatMessage
}
