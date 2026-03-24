namespace CodeFest.Api.Services;

public class NotifyingTextReader : TextReader
{
    private readonly TextReader _inner;
    private readonly Action _onWaiting;
    private readonly int _waitDetectionMs;

    public NotifyingTextReader(TextReader inner, Action onWaiting, int waitDetectionMs = 100)
    {
        _inner = inner;
        _onWaiting = onWaiting;
        _waitDetectionMs = waitDetectionMs;
    }

    public override string? ReadLine()
    {
        using var waitTimer = new Timer(_ => _onWaiting(), null, _waitDetectionMs, Timeout.Infinite);
        return _inner.ReadLine();
    }

    public override int Read()
    {
        using var waitTimer = new Timer(_ => _onWaiting(), null, _waitDetectionMs, Timeout.Infinite);
        return _inner.Read();
    }

    public override int Read(char[] buffer, int index, int count)
    {
        using var waitTimer = new Timer(_ => _onWaiting(), null, _waitDetectionMs, Timeout.Infinite);
        return _inner.Read(buffer, index, count);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _inner.Dispose();
        }
        base.Dispose(disposing);
    }
}
