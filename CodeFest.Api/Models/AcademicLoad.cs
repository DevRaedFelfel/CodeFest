namespace CodeFest.Api.Models;

public class AcademicLoad
{
    public int Id { get; set; }
    public int InstructorId { get; set; }
    public User Instructor { get; set; } = null!;
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public string? Term { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime AssignedAt { get; set; }
}
