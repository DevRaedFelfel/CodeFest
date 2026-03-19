using CodeFest.Api.Models;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.SignalR;

namespace CodeFest.Api.Hubs;

public class CodeFestHub : Hub
{
    private readonly SessionService _sessionService;
    private readonly ChallengeService _challengeService;
    private readonly ActivityLogService _activityLog;
    private readonly CodeExecutionService _executor;

    public CodeFestHub(
        SessionService sessionService,
        ChallengeService challengeService,
        ActivityLogService activityLog,
        CodeExecutionService executor)
    {
        _sessionService = sessionService;
        _challengeService = challengeService;
        _activityLog = activityLog;
        _executor = executor;
    }

    // --- Teacher Actions ---

    public async Task<object> CreateSession(string sessionName, List<int> challengeIds)
    {
        var session = await _sessionService.CreateAsync(sessionName, challengeIds, Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, $"teacher-{session.Code}");
        return new { session.Code, session.Name, session.Status };
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
                // Send challenge but exclude hidden test details
                var clientChallenge = new
                {
                    challenge.Id,
                    challenge.Title,
                    challenge.Description,
                    challenge.StarterCode,
                    challenge.Points,
                    challenge.TimeLimitSeconds,
                    challenge.Difficulty,
                    TestCases = challenge.TestCases
                        .Where(t => !t.IsHidden)
                        .Select(t => new { t.Id, t.Description, t.Input, t.ExpectedOutput })
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
    }

    public async Task PushHint(string sessionCode, int challengeId, string hint)
    {
        await Clients.Group($"session-{sessionCode}").SendAsync("HintReceived", new { challengeId, hint });
    }

    public async Task BroadcastMessage(string sessionCode, string message)
    {
        await Clients.Group($"session-{sessionCode}").SendAsync("BroadcastReceived", message);
    }

    public async Task UnlockNextChallenge(string sessionCode)
    {
        var session = await _sessionService.GetByCodeAsync(sessionCode);
        if (session == null) return;

        // This broadcasts to all students to advance to next challenge
        await Clients.Group($"session-{sessionCode}").SendAsync("UnlockNextChallenge");
    }

    // --- Student Actions ---

    public async Task<object?> JoinSession(string sessionCode, string displayName, string clientType)
    {
        var ct = Enum.TryParse<StudentClientType>(clientType, true, out var parsed) ? parsed : StudentClientType.Web;

        try
        {
            var student = await _sessionService.JoinStudentAsync(sessionCode, displayName, Context.ConnectionId, ct);
            await Groups.AddToGroupAsync(Context.ConnectionId, $"session-{sessionCode}");

            await _activityLog.LogAsync(student.Id, student.SessionId, ActivityType.Joined);

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

        // Save submission
        var submission = new Submission
        {
            StudentId = student.Id,
            ChallengeId = challengeId,
            SessionId = student.SessionId,
            Code = code,
            TestsPassed = result.TestsPassed,
            TestsTotal = result.TestsTotal,
            AllPassed = result.AllPassed,
            PointsAwarded = result.PointsAwarded,
            CompileError = result.CompileError,
            RuntimeError = result.RuntimeError,
            ExecutionTimeMs = result.ExecutionTimeMs,
            SubmittedAt = DateTime.UtcNow
        };

        // We need DbContext access — inject it or use service
        // For now, let the challenge service handle it

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
                        nextChallenge.Points,
                        nextChallenge.TimeLimitSeconds,
                        nextChallenge.Difficulty,
                        TestCases = nextChallenge.TestCases
                            .Where(t => !t.IsHidden)
                            .Select(t => new { t.Id, t.Description, t.Input, t.ExpectedOutput })
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

    // --- Connection Lifecycle ---

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var student = await _sessionService.GetStudentByConnectionIdAsync(Context.ConnectionId);
        if (student != null)
        {
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

        await base.OnDisconnectedAsync(exception);
    }
}
