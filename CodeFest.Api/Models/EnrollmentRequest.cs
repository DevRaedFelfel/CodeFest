namespace CodeFest.Api.Models;

public class EnrollmentRequest
{
    public int Id { get; set; }
    public int StudentUserId { get; set; }
    public User Student { get; set; } = null!;
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public EnrollmentRequestStatus Status { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public int? ReviewedByUserId { get; set; }
}

public enum EnrollmentRequestStatus { Pending, Approved, Rejected }
