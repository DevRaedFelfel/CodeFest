using System.Collections.Concurrent;
using System.IO.Pipelines;
using System.Reflection;
using CodeFest.Api.Hubs;
using CodeFest.Api.Models;
using CodeFest.Api.DTOs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;

namespace CodeFest.Api.Services;

public class InteractiveRunService : IDisposable
{
    private readonly ConcurrentDictionary<int, RunSession> _activeSessions = new();
    private readonly IHubContext<CodeFestHub> _hubContext;
    private readonly ILogger<InteractiveRunService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    private const int MaxRunTimeSeconds = 30;
    private const int MaxOutputBytes = 64 * 1024; // 64KB
    private const int InputWaitDetectionMs = 100;

    public InteractiveRunService(
        IHubContext<CodeFestHub> hubContext,
        ILogger<InteractiveRunService> logger,
        IServiceScopeFactory scopeFactory)
    {
        _hubContext = hubContext;
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    private CodeExecutionService GetCodeExecutionService()
    {
        using var scope = _scopeFactory.CreateScope();
        return scope.ServiceProvider.GetRequiredService<CodeExecutionService>();
    }

    public async Task<string?> StartRunAsync(
        int studentId,
        string connectionId,
        int challengeId,
        string sourceCode,
        List<CodePatternCheck> patternChecks)
    {
        // 1. Kill existing run
        await StopRunAsync(studentId);

        // 2. Pattern checks
        var codeExecution = GetCodeExecutionService();
        var patternResults = codeExecution.RunPatternChecks(sourceCode, patternChecks);
        var failedPattern = patternResults.FirstOrDefault(p => !p.Passed);
        if (failedPattern != null)
        {
            await _hubContext.Clients.Client(connectionId)
                .SendAsync("RunError", failedPattern.FailureMessage);
            await _hubContext.Clients.Client(connectionId)
                .SendAsync("RunFinished", -1);
            return null;
        }

        // 3. Compile
        await _hubContext.Clients.Client(connectionId)
            .SendAsync("RunCompiling");

        var compileResult = codeExecution.Compile(sourceCode);
        if (!compileResult.Success)
        {
            await _hubContext.Clients.Client(connectionId)
                .SendAsync("RunCompileError", compileResult.Errors);
            await _hubContext.Clients.Client(connectionId)
                .SendAsync("RunFinished", -1);
            return null;
        }

        // 4. Create session
        var session = new RunSession
        {
            SessionId = Guid.NewGuid().ToString(),
            StudentId = studentId,
            ConnectionId = connectionId,
            ChallengeId = challengeId,
            StartedAt = DateTime.UtcNow,
            State = RunSessionState.Running
        };

        _activeSessions[studentId] = session;

        // 5. Start execution
        session.ExecutionTask = Task.Run(() =>
            ExecuteWithStreamingAsync(session, compileResult.CompiledAssembly!));

        // 6. Notify client
        await _hubContext.Clients.Client(connectionId)
            .SendAsync("RunStarted", session.SessionId);

        return session.SessionId;
    }

    public async Task SendInputAsync(int studentId, string input)
    {
        if (!_activeSessions.TryGetValue(studentId, out var session))
            return;

        if (session.State != RunSessionState.WaitingForInput &&
            session.State != RunSessionState.Running)
            return;

        try
        {
            if (session.StdinWriter != null)
            {
                await session.StdinWriter.WriteLineAsync(input);
                await session.StdinWriter.FlushAsync();
            }
            session.State = RunSessionState.Running;

            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunInputEcho", input);
        }
        catch (ObjectDisposedException)
        {
            // Program already finished
        }
    }

    public async Task StopRunAsync(int studentId)
    {
        if (_activeSessions.TryRemove(studentId, out var session))
        {
            session.State = RunSessionState.Cancelled;
            session.Cts.Cancel();

            try
            {
                await Task.WhenAny(
                    session.ExecutionTask ?? Task.CompletedTask,
                    Task.Delay(1000));
            }
            catch { /* swallow */ }

            session.Dispose();

            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunFinished", -1);
        }
    }

    public bool HasActiveRun(int studentId)
        => _activeSessions.ContainsKey(studentId);

    public async Task OnStudentDisconnectedAsync(int studentId)
    {
        await StopRunAsync(studentId);
    }

    public async Task StopAllRunsForSessionAsync(IEnumerable<int> studentIds)
    {
        foreach (var studentId in studentIds)
        {
            await StopRunAsync(studentId);
        }
    }

    private async Task ExecuteWithStreamingAsync(
        RunSession session,
        Assembly compiledAssembly)
    {
        var pipe = new Pipe();
        var stdinReader = new StreamReader(pipe.Reader.AsStream());
        session.StdinWriter = new StreamWriter(pipe.Writer.AsStream())
        {
            AutoFlush = true
        };

        var totalOutputBytes = 0;

        var signalrWriter = new SignalRTextWriter(
            text =>
            {
                totalOutputBytes += text.Length;
                if (totalOutputBytes > MaxOutputBytes)
                {
                    session.Cts.Cancel();
                    return;
                }

                _ = _hubContext.Clients.Client(session.ConnectionId)
                    .SendAsync("RunOutput", text, session.Cts.Token);
            });

        try
        {
            var originalIn = Console.In;
            var originalOut = Console.Out;

            var notifyingReader = new NotifyingTextReader(
                stdinReader,
                onWaiting: () =>
                {
                    session.State = RunSessionState.WaitingForInput;
                    _ = _hubContext.Clients.Client(session.ConnectionId)
                        .SendAsync("RunWaiting", session.Cts.Token);
                },
                waitDetectionMs: InputWaitDetectionMs);

            Console.SetIn(notifyingReader);
            Console.SetOut(signalrWriter);

            try
            {
                var entryPoint = compiledAssembly.EntryPoint;
                if (entryPoint == null)
                {
                    await _hubContext.Clients.Client(session.ConnectionId)
                        .SendAsync("RunError", "No entry point found (Main method missing).");
                    session.State = RunSessionState.Error;
                    await _hubContext.Clients.Client(session.ConnectionId)
                        .SendAsync("RunFinished", -1);
                    return;
                }

                using var timeoutCts = CancellationTokenSource
                    .CreateLinkedTokenSource(session.Cts.Token);
                timeoutCts.CancelAfter(TimeSpan.FromSeconds(MaxRunTimeSeconds));

                var task = Task.Run(() =>
                {
                    var parameters = entryPoint.GetParameters();
                    var args = parameters.Length > 0
                        ? new object[] { Array.Empty<string>() }
                        : null;
                    entryPoint.Invoke(null, args);
                }, timeoutCts.Token);

                await task;

                // Flush any remaining buffered output
                signalrWriter.Dispose();

                session.State = RunSessionState.Finished;
                await _hubContext.Clients.Client(session.ConnectionId)
                    .SendAsync("RunFinished", 0);
            }
            finally
            {
                Console.SetIn(originalIn);
                Console.SetOut(originalOut);
            }
        }
        catch (OperationCanceledException)
        {
            if (session.State != RunSessionState.Cancelled)
            {
                await _hubContext.Clients.Client(session.ConnectionId)
                    .SendAsync("RunError",
                        totalOutputBytes > MaxOutputBytes
                            ? "Too much output — program stopped."
                            : $"Program timed out after {MaxRunTimeSeconds} seconds.");
                session.State = RunSessionState.Error;
            }
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunFinished", -1);
        }
        catch (TargetInvocationException ex)
        {
            var inner = ex.InnerException ?? ex;
            var message = $"{inner.GetType().Name}: {inner.Message}";

            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunError", message);
            session.State = RunSessionState.Error;
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunFinished", 1);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Unexpected error in interactive run for student {StudentId}",
                session.StudentId);

            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunError", "An unexpected error occurred.");
            session.State = RunSessionState.Error;
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunFinished", 1);
        }
        finally
        {
            _activeSessions.TryRemove(session.StudentId, out _);
            signalrWriter.Dispose();
            session.Dispose();
        }
    }

    public void Dispose()
    {
        foreach (var session in _activeSessions.Values)
        {
            session.Dispose();
        }
        _activeSessions.Clear();
    }
}
