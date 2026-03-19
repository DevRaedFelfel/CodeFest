namespace CodeFest.Api.DTOs;

public class SubmissionRequest
{
    public int StudentId { get; set; }
    public int ChallengeId { get; set; }
    public int SessionId { get; set; }
    public string Code { get; set; } = string.Empty;
}
