namespace CodeFest.Api.DTOs;

public class StudentActivity
{
    public int StudentId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string ActivityType { get; set; } = string.Empty;
    public string? Data { get; set; }
    public DateTime Timestamp { get; set; }
}
