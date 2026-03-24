using System.Text;

namespace CodeFest.Api.Services;

/// <summary>
/// Thread-safe Console.Out replacement using AsyncLocal.
/// Each student's execution task sets its own writer via SetWriter(),
/// and Console.Out routes to that writer. Other threads (and the
/// test framework) are unaffected — they fall through to the original writer.
/// </summary>
public class PerSessionConsoleOut : TextWriter
{
    private static readonly AsyncLocal<TextWriter?> _current = new();
    private readonly TextWriter _fallback;

    public PerSessionConsoleOut(TextWriter fallback)
    {
        _fallback = fallback;
    }

    private TextWriter Active => _current.Value ?? _fallback;

    /// <summary>
    /// Set the writer for the current async execution context.
    /// This flows to child tasks via AsyncLocal.
    /// </summary>
    public static void SetWriter(TextWriter writer) => _current.Value = writer;

    /// <summary>
    /// Clear the writer for the current async context (restores fallback).
    /// </summary>
    public static void ClearWriter() => _current.Value = null;

    public override Encoding Encoding => Active.Encoding;

    public override void Write(char value) => Active.Write(value);
    public override void Write(string? value) => Active.Write(value);
    public override void Write(char[] buffer, int index, int count) => Active.Write(buffer, index, count);
    public override void WriteLine() => Active.WriteLine();
    public override void WriteLine(string? value) => Active.WriteLine(value);
    public override void Flush() => Active.Flush();
    public override Task FlushAsync() => Active.FlushAsync();
}

/// <summary>
/// Thread-safe Console.In replacement using AsyncLocal.
/// Each student's execution task sets its own reader via SetReader().
/// </summary>
public class PerSessionConsoleIn : TextReader
{
    private static readonly AsyncLocal<TextReader?> _current = new();
    private readonly TextReader _fallback;

    public PerSessionConsoleIn(TextReader fallback)
    {
        _fallback = fallback;
    }

    private TextReader Active => _current.Value ?? _fallback;

    /// <summary>
    /// Set the reader for the current async execution context.
    /// </summary>
    public static void SetReader(TextReader reader) => _current.Value = reader;

    /// <summary>
    /// Clear the reader for the current async context.
    /// </summary>
    public static void ClearReader() => _current.Value = null;

    public override string? ReadLine() => Active.ReadLine();
    public override int Read() => Active.Read();
    public override int Read(char[] buffer, int index, int count) => Active.Read(buffer, index, count);
    public override int Peek() => Active.Peek();
}
