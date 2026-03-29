namespace CodeFest.Api.DTOs;

// --- User DTOs ---
public record CreateUserRequest(string Email, string DisplayName, string Role);
public record UpdateUserRequest(string? DisplayName, string? Role, bool? IsActive);
public record UserResponse(int Id, string Email, string DisplayName, string Role, string? PictureUrl, bool IsActive, DateTime CreatedAt, DateTime? LastLoginAt);

// --- Course DTOs ---
public record CreateCourseRequest(string Code, string Name, string? Description, int InstructorId);
public record UpdateCourseRequest(string? Code, string? Name, string? Description, int? InstructorId, bool? IsActive);
public record CourseResponse(int Id, string Code, string Name, string? Description, int InstructorId, string InstructorName, bool IsActive, DateTime CreatedAt, int StudentCount, int SessionCount);

// --- Enrollment DTOs ---
public record CreateEnrollmentRequest(int StudentId, int CourseId);
public record EnrollmentResponse(int Id, int StudentId, string StudentName, string StudentEmail, int CourseId, string CourseCode, string CourseName, string Status, DateTime EnrolledAt);

// --- Academic Load DTOs ---
public record CreateAcademicLoadRequest(int InstructorId, int CourseId, string? Term);
public record UpdateAcademicLoadRequest(string? Term, bool? IsActive);
public record AcademicLoadResponse(int Id, int InstructorId, string InstructorName, int CourseId, string CourseCode, string CourseName, string? Term, bool IsActive, DateTime AssignedAt);

// --- Enrollment Request DTOs ---
public record UpdateEnrollmentRequestDto(string Status); // "Approved" or "Rejected"
public record EnrollmentRequestResponse(int Id, int StudentUserId, string StudentName, string StudentEmail, int CourseId, string CourseCode, string CourseName, string Status, DateTime RequestedAt, DateTime? ReviewedAt);

// --- File Import DTOs ---
public record ImportResult(int Imported, int Skipped, List<ImportError> Errors);
public record ImportError(int Row, string Error);

// --- Pagination ---
public record PaginatedResponse<T>(List<T> Items, int TotalCount, int Page, int PageSize);

// --- Session List DTOs ---
public record SessionListItem(
    int Id, string Name, int? CourseId, string? CourseCode, string? CourseName,
    string Code, string Status, DateTime CreatedAt, DateTime? StartedAt, DateTime? EndedAt,
    int ChallengeCount, int EnrolledCount, int ParticipantCount, int CompletedCount);

public record SessionDetailResponse(
    int Id, string Name, int? CourseId, string? CourseCode, string? CourseName,
    string Code, string Status, DateTime CreatedAt, DateTime? StartedAt, DateTime? EndedAt,
    List<int> ChallengeIds, string? ShareableLink, string? QrCodeData,
    List<SessionParticipantDetail> Participants, int EnrolledNotJoinedCount);

public record SessionParticipantDetail(
    int UserId, string DisplayName, string? Email, string ConnectionStatus,
    int CurrentChallengeIndex, int TotalPoints, int SubmissionCount,
    DateTime JoinedAt, List<string> Flags);

public record BulkSessionRequest(List<string> SessionCodes);
