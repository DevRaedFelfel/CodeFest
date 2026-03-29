using System.IdentityModel.Tokens.Jwt;
using CodeFest.Api.Data;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Hubs;

[Authorize(Policy = "Authenticated")]
public class CodeFestHub : Hub
{
    private readonly SessionService _sessionService;
    private readonly ChallengeService _challengeService;
    private readonly ActivityLogService _activityLog;
    private readonly CodeExecutionService _executor;
    private readonly InteractiveRunService _interactiveRunService;
    private readonly CodeFestDbContext _db;

    public CodeFestHub(
        SessionService sessionService,
        ChallengeService challengeService,
        ActivityLogService activityLog,
        CodeExecutionService executor,
        InteractiveRunService interactiveRunService,
        CodeFestDbContext db)
    {
        _sessionService = sessionService;
        _challengeService = challengeService;
        _activityLog = activityLog;
        _executor = executor;
        _interactiveRunService = interactiveRunService;
        _db = db;
    }

    private int GetUserId()
    {
        var claim = Context.User?.FindFirst(JwtRegisteredClaimNames.Sub)
            ?? Context.User?.FindFirst("sub");
        return claim != null ? int.Parse(claim.Value) : 0;
    }

    private string GetUserRole()
    {
        return Context.User?.FindFirst("role")?.Value ?? "";
    }

    private string GetUserName()
    {
        return Context.User?.FindFirst("name")?.Value ?? "Unknown";
    }

    // --- Teacher Actions ---

    public async Task JoinAsTeacher(string sessionCode)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"teacher-{sessionCode}");
    }

    public async Task<object> CreateSession(string sessionName, List<int> challengeIds)
    {
        var session = await _sessionService.CreateAsync(sessionName, challengeIds, Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, $"teacher-{session.Code}");
        return new { session.Code, session.Name, session.Status };
    }

    // New overload: course-scoped session creation
    public async Task<object> CreateCourseSession(string sessionName, int courseId, List<int> challengeIds)
    {
        var userId = GetUserId();
        var role = GetUserRole();

        // Verify instructor owns the course or is super admin
        var course = await _db.Courses.FindAsync(courseId);
        if (course == null || (course.InstructorId != userId && role != "SuperAdmin"))
        {
            throw new HubException("You do not have access to this course.");
        }

        var session = await _sessionService.CreateAsync(sessionName, challengeIds, Context.ConnectionId);

        // Set course binding
        var sessionEntity = await _db.Sessions.FirstOrDefaultAsync(s => s.Code == session.Code);
        if (sessionEntity != null)
        {
            sessionEntity.CourseId = courseId;
            sessionEntity.CreatedByUserId = userId;

            // Generate shareable link and QR
            var qrService = Context.GetHttpContext()?.RequestServices.GetService<QrCodeService>();
            if (qrService != null)
            {
                sessionEntity.ShareableLink = qrService.GenerateShareableLink(session.Code);
                sessionEntity.QrCodeData = qrService.GenerateQrCodeBase64(sessionEntity.ShareableLink);
            }

            await _db.SaveChangesAsync();
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"teacher-{session.Code}");
        return new
        {
            session.Code, session.Name, session.Status,
            courseId,
            shareableLink = sessionEntity?.ShareableLink,
            qrCodeBase64 = sessionEntity?.QrCodeData
        };
    }

    public async Task StartSession(string sessionCode)
    {
        var session = await _sessionService.StartAsync(sessionCode);
        if (session == null) return;

        if (session.ChallengeIds.Count > 0)
        {
            var challenge = await _challengeService.GetByIdAsync(session.ChallengeIds[0]);
            if (challenge != null)
            {
                var clientChallenge = new
                {
                    challenge.Id,
                    challenge.Title,
                    challenge.Description,
                    challenge.StarterCode,
                    challenge.Order,
                    challenge.Points,
                    challenge.TimeLimitSeconds,
                    challenge.Difficulty,
                    TestCases = challenge.TestCases
                        .Where(t => !t.IsHidden)
                        .Select(t => new { t.Id, t.ChallengeId, t.Description, t.Input, t.ExpectedOutput, t.IsHidden, t.Order }),
                    challenge.PatternChecks
                };
                await Clients.Group($"session-{sessionCode}").SendAsync("SessionStarted", clientChallenge);
            }
        }

        await Clients.Group($"teacher-{sessionCode}").SendAsync("SessionStatusChanged", session.Status.ToString());
    }

    public async Task PauseSession(string sessionCode)
    {
        var session = await _sessionService.PauseAsync(sessionCode);
        if (session == null) return;

        await Clients.Group($"session-{sessionCode}").SendAsync("SessionPaused");
        await Clients.Group($"teacher-{sessionCode}").SendAsync("SessionStatusChanged", session.Status.ToString());
    }

    public async Task ResumeSession(string sessionCode)
    {
        var session = await _sessionService.ResumeAsync(sessionCode);
        if (session == null) return;

        await Clients.Group($"session-{sessionCode}").SendAsync("SessionResumed");
        await Clients.Group($"teacher-{sessionCode}").SendAsync("SessionStatusChanged", session.Status.ToString());
    }

    public async Task EndSession(string sessionCode)
    {
        var session = await _sessionService.EndAsync(sessionCode);
        if (session == null) return;

        var leaderboard = await _sessionService.GetLeaderboardAsync(sessionCode);
        await Clients.Group($"session-{sessionCode}").SendAsync("SessionEnded", leaderboard);
        await Clients.Group($"teacher-{sessionCode}").SendAsync("SessionEnded", leaderboard);
        await Clients.Group($"teacher-{sessionCode}").SendAsync("SessionStatusChanged", session.Status.ToString());
    }

    public async Task DeleteSession(string sessionCode)
    {
        var deleted = await _sessionService.DeleteAsync(sessionCode);
        if (!deleted) return;

        await Clients.Group($"session-{sessionCode}").SendAsync("SessionDeleted");
        await Clients.Group($"teacher-{sessionCode}").SendAsync("SessionDeleted");
    }

    public async Task ReopenSession(string sessionCode)
    {
        var session = await _sessionService.ReopenAsync(sessionCode);
        if (session == null) return;

        await Clients.Group($"session-{sessionCode}").SendAsync("SessionReopened");
        await Clients.Group($"teacher-{sessionCode}").SendAsync("SessionStatusChanged", session.Status.ToString());
    }

    public async Task PushHint(string sessionCode, int challengeId, string hint)
    {
        await Clients.Group($"session-{sessionCode}").SendAsync("HintReceived", new { challengeId, hint });
    }

    public async Task BroadcastMessage(string sessionCode, string message)
    {
        await Clients.Group($"session-{sessionCode}").SendAsync("BroadcastReceived", new { message });
    }

    public async Task UnlockNextChallenge(string sessionCode)
    {
        var session = await _sessionService.GetByCodeAsync(sessionCode);
        if (session == null) return;

        await Clients.Group($"session-{sessionCode}").SendAsync("UnlockNextChallenge");
    }

    // --- Student Actions ---

    public async Task<object?> JoinSession(string sessionCode, string displayName, string clientType)
    {
        var ct = Enum.TryParse<StudentClientType>(clientType, true, out var parsed) ? parsed : StudentClientType.Web;
        var userId = GetUserId();

        // If user is authenticated, check enrollment for course-bound sessions
        if (userId > 0)
        {
            var session = await _sessionService.GetByCodeAsync(sessionCode);
            if (session?.CourseId != null)
            {
                var enrolled = await _db.Enrollments.AnyAsync(e =>
                    e.StudentId == userId && e.CourseId == session.CourseId && e.Status == EnrollmentStatus.Active);

                // Allow instructors and super admins to join without enrollment
                var role = GetUserRole();
                if (!enrolled && role != "Instructor" && role != "SuperAdmin")
                {
                    var course = await _db.Courses.FindAsync(session.CourseId);
                    return new
                    {
                        error = "NOT_ENROLLED",
                        courseId = course?.Id,
                        courseName = course?.Name,
                        courseCode = course?.Code
                    };
                }
            }

            // Use authenticated user's display name
            var user = await _db.Users.FindAsync(userId);
            if (user != null)
            {
                displayName = user.DisplayName;
            }
        }

        try
        {
            var student = await _sessionService.JoinStudentAsync(sessionCode, displayName, Context.ConnectionId, ct);
            await Groups.AddToGroupAsync(Context.ConnectionId, $"session-{sessionCode}");

            await _activityLog.LogAsync(student.Id, student.SessionId, ActivityType.Joined);

            // Also create a SessionParticipant record if authenticated
            if (userId > 0)
            {
                var existingParticipant = await _db.SessionParticipants
                    .FirstOrDefaultAsync(sp => sp.SessionId == student.SessionId && sp.UserId == userId);

                if (existingParticipant == null)
                {
                    _db.SessionParticipants.Add(new SessionParticipant
                    {
                        SessionId = student.SessionId,
                        UserId = userId,
                        ConnectionId = Context.ConnectionId,
                        CurrentChallengeIndex = 0,
                        TotalPoints = 0,
                        JoinedAt = DateTime.UtcNow,
                        IsConnected = true,
                        ClientType = ct
                    });
                    await _db.SaveChangesAsync();
                }
                else
                {
                    existingParticipant.ConnectionId = Context.ConnectionId;
                    existingParticipant.IsConnected = true;
                    await _db.SaveChangesAsync();
                }
            }

            // Notify teacher
            await Clients.Group($"teacher-{sessionCode}").SendAsync("StudentJoined", new
            {
                student.Id,
                student.DisplayName,
                student.ClientType,
                student.IsConnected,
                student.CurrentChallengeIndex,
                student.TotalPoints
            });

            var session = await _sessionService.GetByCodeAsync(sessionCode);

            // If session is active, send the current challenge
            object? currentChallenge = null;
            var totalChallenges = session?.ChallengeIds?.Count ?? 0;
            if (session?.Status == SessionStatus.Active && session.ChallengeIds?.Count > 0)
            {
                var challengeIndex = student.CurrentChallengeIndex;
                if (challengeIndex < session.ChallengeIds.Count)
                {
                    var challenge = await _challengeService.GetByIdAsync(session.ChallengeIds[challengeIndex]);
                    if (challenge != null)
                    {
                        currentChallenge = new
                        {
                            challenge.Id,
                            challenge.Title,
                            challenge.Description,
                            challenge.StarterCode,
                            challenge.Order,
                            challenge.Points,
                            challenge.TimeLimitSeconds,
                            Difficulty = challenge.Difficulty.ToString(),
                            TestCases = challenge.TestCases
                                .Where(t => !t.IsHidden)
                                .Select(t => new { t.Id, t.ChallengeId, t.Input, t.ExpectedOutput, t.IsHidden, t.Order, t.Description }),
                            challenge.PatternChecks
                        };
                    }
                }
            }

            return new
            {
                StudentId = student.Id,
                SessionId = student.SessionId,
                SessionStatus = session?.Status.ToString(),
                SessionName = session?.Name,
                TotalChallenges = totalChallenges,
                CurrentChallenge = currentChallenge
            };
        }
        catch (InvalidOperationException ex)
        {
            await Clients.Caller.SendAsync("Error", ex.Message);
            return null;
        }
    }

    public async Task SubmitCode(string sessionCode, int challengeId, string code)
    {
        var student = await _sessionService.GetStudentByConnectionIdAsync(Context.ConnectionId);
        if (student == null) return;

        await _activityLog.LogAsync(student.Id, student.SessionId, ActivityType.SubmissionAttempt);

        var result = await _challengeService.RunTests(challengeId, code);

        // Send results to student
        await Clients.Caller.SendAsync("TestResults", result);

        // Notify teacher
        await Clients.Group($"teacher-{sessionCode}").SendAsync("SubmissionResult", new
        {
            student.Id,
            student.DisplayName,
            challengeId,
            result.TestsPassed,
            result.TestsTotal,
            result.AllPassed,
            result.PointsAwarded,
            result.CompileError
        });

        if (result.AllPassed)
        {
            await _activityLog.LogAsync(student.Id, student.SessionId, ActivityType.ChallengeCompleted,
                $"{{\"challengeId\":{challengeId},\"points\":{result.PointsAwarded}}}");

            var session = await _sessionService.GetByCodeAsync(sessionCode);
            var nextIndex = student.CurrentChallengeIndex + 1;
            await _sessionService.UpdateStudentPointsAsync(student.Id, result.PointsAwarded, nextIndex);

            // Send celebration
            await Clients.Caller.SendAsync("Celebration", "confetti");

            // Send next challenge if available
            if (session != null && nextIndex < session.ChallengeIds.Count)
            {
                var nextChallenge = await _challengeService.GetByIdAsync(session.ChallengeIds[nextIndex]);
                if (nextChallenge != null)
                {
                    var clientChallenge = new
                    {
                        nextChallenge.Id,
                        nextChallenge.Title,
                        nextChallenge.Description,
                        nextChallenge.StarterCode,
                        nextChallenge.Order,
                        nextChallenge.Points,
                        nextChallenge.TimeLimitSeconds,
                        nextChallenge.Difficulty,
                        TestCases = nextChallenge.TestCases
                            .Where(t => !t.IsHidden)
                            .Select(t => new { t.Id, t.ChallengeId, t.Description, t.Input, t.ExpectedOutput, t.IsHidden, t.Order }),
                        nextChallenge.PatternChecks
                    };
                    await Clients.Caller.SendAsync("NextChallenge", clientChallenge);
                }
            }

            // Update leaderboard for everyone
            var leaderboard = await _sessionService.GetLeaderboardAsync(sessionCode);
            await Clients.Group($"session-{sessionCode}").SendAsync("LeaderboardUpdated", leaderboard);
            await Clients.Group($"teacher-{sessionCode}").SendAsync("LeaderboardUpdated", leaderboard);
        }
        else
        {
            foreach (var tr in result.TestResults)
            {
                var type = tr.Passed ? ActivityType.TestPassed : ActivityType.TestFailed;
                await _activityLog.LogAsync(student.Id, student.SessionId, type,
                    $"{{\"testCaseId\":{tr.TestCaseId}}}");
            }
        }
    }

    public async Task LogActivity(string sessionCode, string activityType, string? data)
    {
        var student = await _sessionService.GetStudentByConnectionIdAsync(Context.ConnectionId);
        if (student == null) return;

        if (Enum.TryParse<ActivityType>(activityType, true, out var type))
        {
            var log = await _activityLog.LogAsync(student.Id, student.SessionId, type, data);

            await Clients.Group($"teacher-{sessionCode}").SendAsync("ActivityLogged", new
            {
                student.Id,
                student.DisplayName,
                ActivityType = type.ToString(),
                Data = data,
                log.Timestamp
            });
        }
    }

    public async Task RequestHint(string sessionCode, int challengeId)
    {
        var student = await _sessionService.GetStudentByConnectionIdAsync(Context.ConnectionId);
        if (student == null) return;

        await _activityLog.LogAsync(student.Id, student.SessionId, ActivityType.HintRequested,
            $"{{\"challengeId\":{challengeId}}}");

        await Clients.Group($"teacher-{sessionCode}").SendAsync("HintRequested", new
        {
            student.Id,
            student.DisplayName,
            challengeId
        });
    }

    // --- Interactive Run ---

    public async Task RunCode(string sessionCode, int challengeId, string code)
    {
        var student = await _sessionService.GetStudentByConnectionIdAsync(Context.ConnectionId);
        if (student == null) return;

        var challenge = await _challengeService.GetByIdAsync(challengeId);
        if (challenge == null) return;

        await _activityLog.LogAsync(student.Id, student.SessionId,
            ActivityType.InteractiveRun, $"{{\"challengeId\":{challengeId},\"codeLength\":{code.Length}}}");

        await _interactiveRunService.StartRunAsync(
            student.Id,
            Context.ConnectionId,
            challengeId,
            code,
            challenge.PatternChecks);

        await Clients.Group($"teacher-{sessionCode}")
            .SendAsync("StudentRunStarted", student.Id, challengeId);
    }

    public async Task SendRunInput(string sessionCode, string input)
    {
        var student = await _sessionService.GetStudentByConnectionIdAsync(Context.ConnectionId);
        if (student == null) return;

        await _interactiveRunService.SendInputAsync(student.Id, input);

        await _activityLog.LogAsync(student.Id, student.SessionId,
            ActivityType.InteractiveRunInput, $"{{\"inputLength\":{input.Length}}}");
    }

    public async Task StopRun(string sessionCode)
    {
        var student = await _sessionService.GetStudentByConnectionIdAsync(Context.ConnectionId);
        if (student == null) return;

        await _interactiveRunService.StopRunAsync(student.Id);

        await _activityLog.LogAsync(student.Id, student.SessionId,
            ActivityType.InteractiveRunStop);

        await Clients.Group($"teacher-{sessionCode}")
            .SendAsync("StudentRunStopped", student.Id);
    }

    public async Task ReconnectToRun(string sessionCode)
    {
        var student = await _sessionService.GetStudentByConnectionIdAsync(Context.ConnectionId);
        if (student == null) return;

        _interactiveRunService.OnStudentReconnected(student.Id, Context.ConnectionId);
    }

    // --- Connection Lifecycle ---

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var student = await _sessionService.GetStudentByConnectionIdAsync(Context.ConnectionId);
        if (student != null)
        {
            // Kill any active interactive run
            await _interactiveRunService.OnStudentDisconnectedAsync(student.Id);

            await _sessionService.DisconnectStudentAsync(Context.ConnectionId);
            await _activityLog.LogAsync(student.Id, student.SessionId, ActivityType.Disconnected);

            var session = await _sessionService.GetByCodeAsync(
                (await _sessionService.GetAllAsync())
                    .FirstOrDefault(s => s.Id == student.SessionId)?.Code ?? "");

            if (session != null)
            {
                await Clients.Group($"teacher-{session.Code}").SendAsync("StudentDisconnected", student.Id);
            }
        }

        // Also update SessionParticipant
        var userId = GetUserId();
        if (userId > 0)
        {
            var participant = await _db.SessionParticipants
                .FirstOrDefaultAsync(sp => sp.ConnectionId == Context.ConnectionId);
            if (participant != null)
            {
                participant.IsConnected = false;
                await _db.SaveChangesAsync();
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
}
