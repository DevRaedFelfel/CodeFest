namespace CodeFest.Api.Models;

public class Enrollment
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public User Student { get; set; } = null!;
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public EnrollmentStatus Status { get; set; }
    public DateTime EnrolledAt { get; set; }
}

public enum EnrollmentStatus { Active, Pending, Dropped, Rejected }
