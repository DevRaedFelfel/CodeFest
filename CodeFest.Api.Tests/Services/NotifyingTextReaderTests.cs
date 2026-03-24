using System.IO.Pipelines;
using CodeFest.Api.Services;
using FluentAssertions;

namespace CodeFest.Api.Tests.Services;

public class NotifyingTextReaderTests
{
    [Fact]
    public void ReadLine_WhenDataAvailable_ReturnsWithoutNotifying()
    {
        var innerReader = new StringReader("hello\n");
        var notified = false;
        var reader = new NotifyingTextReader(innerReader,
            onWaiting: () => notified = true,
            waitDetectionMs: 50);

        var result = reader.ReadLine();

        result.Should().Be("hello");
        notified.Should().BeFalse();
    }

    [Fact]
    public async Task ReadLine_WhenBlocked_NotifiesAfterDelay()
    {
        var pipe = new Pipe();
        var streamReader = new StreamReader(pipe.Reader.AsStream());
        var notified = false;
        var reader = new NotifyingTextReader(streamReader,
            onWaiting: () => notified = true,
            waitDetectionMs: 50);

        // Start ReadLine on background thread
        var readTask = Task.Run(() => reader.ReadLine());

        await Task.Delay(150);
        notified.Should().BeTrue();

        // Feed data to unblock
        var writer = new StreamWriter(pipe.Writer.AsStream()) { AutoFlush = true };
        await writer.WriteLineAsync("world");

        var result = await readTask;
        result.Should().Be("world");
    }

    [Fact]
    public void ReadLine_ReturnsNull_WhenStreamEnds()
    {
        var innerReader = new StringReader("");
        var reader = new NotifyingTextReader(innerReader,
            onWaiting: () => { },
            waitDetectionMs: 50);

        var result = reader.ReadLine();

        result.Should().BeNull();
    }

    [Fact]
    public void Read_WhenDataAvailable_ReturnsWithoutNotifying()
    {
        var innerReader = new StringReader("A");
        var notified = false;
        var reader = new NotifyingTextReader(innerReader,
            onWaiting: () => notified = true,
            waitDetectionMs: 50);

        var result = reader.Read();

        result.Should().Be('A');
        notified.Should().BeFalse();
    }

    [Fact]
    public void ReadLine_MultipleLines_ReadsSequentially()
    {
        var innerReader = new StringReader("line1\nline2\nline3");
        var reader = new NotifyingTextReader(innerReader,
            onWaiting: () => { },
            waitDetectionMs: 50);

        reader.ReadLine().Should().Be("line1");
        reader.ReadLine().Should().Be("line2");
        reader.ReadLine().Should().Be("line3");
    }

    [Fact]
    public void ReadCharArray_WhenDataAvailable_ReturnsWithoutNotifying()
    {
        var innerReader = new StringReader("Hello");
        var notified = false;
        var reader = new NotifyingTextReader(innerReader,
            onWaiting: () => notified = true,
            waitDetectionMs: 50);

        var buffer = new char[5];
        var count = reader.Read(buffer, 0, 5);

        count.Should().Be(5);
        new string(buffer).Should().Be("Hello");
        notified.Should().BeFalse();
    }
}
