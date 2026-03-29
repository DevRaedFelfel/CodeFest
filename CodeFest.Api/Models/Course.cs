namespace CodeFest.Api.Models;

public class Course
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int InstructorId { get; set; }
    public User Instructor { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public List<Enrollment> Enrollments { get; set; } = new();
    public List<Challenge> Challenges { get; set; } = new();
    public List<Session> Sessions { get; set; } = new();
}
