using CodeFest.Api.Services;
using FluentAssertions;

namespace CodeFest.Api.Tests.Services;

public class SignalRTextWriterTests
{
    [Fact]
    public void Write_WithNewline_FlushesImmediately()
    {
        var captured = new List<string>();
        using var writer = new SignalRTextWriter(text => captured.Add(text));

        writer.WriteLine("Hello, World!");

        captured.Should().ContainSingle();
        captured[0].Should().Be("Hello, World!\n");
    }

    [Fact]
    public async Task Write_WithoutNewline_FlushesAfterDelay()
    {
        var captured = new List<string>();
        using var writer = new SignalRTextWriter(text => captured.Add(text));

        writer.Write("Enter name: ");

        // Wait with retry — timer-based flush can be delayed under load
        for (var i = 0; i < 20 && captured.Count == 0; i++)
            await Task.Delay(50);

        captured.Should().ContainSingle();
        captured[0].Should().Be("Enter name: ");
    }

    [Fact]
    public void Write_MultipleSmallWrites_BatchesBeforeNewline()
    {
        var captured = new List<string>();
        using var writer = new SignalRTextWriter(text => captured.Add(text));

        writer.Write("a");
        writer.Write("b");
        writer.Write("c");
        writer.WriteLine(""); // Just newline

        captured.Should().ContainSingle();
        captured[0].Should().Be("abc\n");
    }

    [Fact]
    public void Dispose_FlushesRemainingBuffer()
    {
        var captured = new List<string>();
        var writer = new SignalRTextWriter(text => captured.Add(text));

        writer.Write("unflushed");
        writer.Dispose();

        captured.Should().ContainSingle();
        captured[0].Should().Be("unflushed");
    }

    [Fact]
    public void Write_Char_WithNewline_FlushesImmediately()
    {
        var captured = new List<string>();
        using var writer = new SignalRTextWriter(text => captured.Add(text));

        writer.Write('H');
        writer.Write('i');
        writer.Write('\n');

        captured.Should().ContainSingle();
        captured[0].Should().Be("Hi\n");
    }

    [Fact]
    public void Write_NullString_DoesNothing()
    {
        var captured = new List<string>();
        using var writer = new SignalRTextWriter(text => captured.Add(text));

        writer.Write((string?)null);

        captured.Should().BeEmpty();
    }

    [Fact]
    public void Write_StringContainingNewline_FlushesImmediately()
    {
        var captured = new List<string>();
        using var writer = new SignalRTextWriter(text => captured.Add(text));

        writer.Write("line1\nline2");

        captured.Should().ContainSingle();
        captured[0].Should().Be("line1\nline2");
    }

    [Fact]
    public async Task Write_MultipleFlushes_ProducesSeparateCallbacks()
    {
        var captured = new List<string>();
        using var writer = new SignalRTextWriter(text => captured.Add(text));

        writer.WriteLine("first");
        writer.WriteLine("second");

        captured.Should().HaveCount(2);
        captured[0].Should().Be("first\n");
        captured[1].Should().Be("second\n");
    }
}
