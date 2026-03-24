namespace CodeFest.Api.Models;

public class RunSession : IDisposable
{
    public string SessionId { get; init; } = string.Empty;
    public int StudentId { get; init; }
    public string ConnectionId { get; init; } = string.Empty;
    public int ChallengeId { get; init; }

    public CancellationTokenSource Cts { get; } = new();
    public StreamWriter? StdinWriter { get; set; }
    public Task? ExecutionTask { get; set; }
    public DateTime StartedAt { get; init; }
    public RunSessionState State { get; set; }

    private int _disposed;

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;

        try { Cts.Cancel(); } catch (ObjectDisposedException) { }
        try { Cts.Dispose(); } catch (ObjectDisposedException) { }
        StdinWriter?.Dispose();
    }
}

public enum RunSessionState
{
    Compiling,
    Running,
    WaitingForInput,
    Finished,
    Error,
    Cancelled
}
