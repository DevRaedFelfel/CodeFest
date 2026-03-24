using System.Text;

namespace CodeFest.Api.Services;

public class SignalRTextWriter : TextWriter
{
    private readonly Action<string> _onWrite;
    private readonly StringBuilder _buffer = new();
    private readonly Timer _flushTimer;
    private readonly object _lock = new();
    private const int FlushDelayMs = 50;

    public SignalRTextWriter(Action<string> onWrite)
    {
        _onWrite = onWrite;
        _flushTimer = new Timer(_ => FlushBuffer(), null, Timeout.Infinite, Timeout.Infinite);
    }

    public override Encoding Encoding => Encoding.UTF8;

    public override void Write(char value)
    {
        lock (_lock)
        {
            _buffer.Append(value);
            if (value == '\n')
                FlushBuffer();
            else
                _flushTimer.Change(FlushDelayMs, Timeout.Infinite);
        }
    }

    public override void Write(string? value)
    {
        if (value == null) return;
        lock (_lock)
        {
            _buffer.Append(value);
            if (value.Contains('\n'))
                FlushBuffer();
            else
                _flushTimer.Change(FlushDelayMs, Timeout.Infinite);
        }
    }

    public override void WriteLine(string? value)
    {
        lock (_lock)
        {
            _buffer.Append(value);
            _buffer.Append('\n');
            FlushBuffer();
        }
    }

    private void FlushBuffer()
    {
        string text;
        lock (_lock)
        {
            if (_buffer.Length == 0) return;
            text = _buffer.ToString();
            _buffer.Clear();
            _flushTimer.Change(Timeout.Infinite, Timeout.Infinite);
        }
        _onWrite(text);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            FlushBuffer();
            _flushTimer.Dispose();
        }
        base.Dispose(disposing);
    }
}
