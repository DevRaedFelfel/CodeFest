using System.Collections.Concurrent;
using CodeFest.Api.Hubs;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CodeFest.Api.Tests.Services;

/// <summary>
/// These tests verify that two students running code simultaneously
/// get isolated Console.In/Out streams — no cross-contamination.
/// This is a real production scenario (30+ concurrent students).
/// </summary>
public class ConcurrentRunIsolationTests : IDisposable
{
    private readonly ConcurrentDictionary<string, ConcurrentQueue<(string method, object?[] args)>> _perConnectionMessages = new();
    private readonly InteractiveRunService _service;

    static ConcurrentRunIsolationTests() => PerSessionConsoleFixture.EnsureInstalled();

    public ConcurrentRunIsolationTests()
    {
        var clientProxyMock = new Mock<ISingleClientProxy>();

        var hubClientsMock = new Mock<IHubClients>();
        hubClientsMock.Setup(x => x.Client(It.IsAny<string>()))
            .Returns((string connId) =>
            {
                var proxy = new Mock<ISingleClientProxy>();
                proxy
                    .Setup(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
                    .Callback<string, object?[], CancellationToken>((method, args, _) =>
                    {
                        var queue = _perConnectionMessages.GetOrAdd(connId, _ => new());
                        queue.Enqueue((method, args));
                    })
                    .Returns(Task.CompletedTask);
                return proxy.Object;
            });

        var hubContextMock = new Mock<IHubContext<CodeFestHub>>();
        hubContextMock.Setup(x => x.Clients).Returns(hubClientsMock.Object);

        var services = new ServiceCollection();
        services.AddScoped<CodeExecutionService>();
        var provider = services.BuildServiceProvider();

        _service = new InteractiveRunService(
            hubContextMock.Object,
            NullLogger<InteractiveRunService>.Instance,
            provider.GetRequiredService<IServiceScopeFactory>());
    }

    [Fact]
    public async Task TwoStudents_SimultaneousRuns_OutputIsIsolated()
    {
        // Student 1 prints "I am Student1"
        var code1 = """
            using System;
            Console.WriteLine("I am Student1");
            """;

        // Student 2 prints "I am Student2"
        var code2 = """
            using System;
            Console.WriteLine("I am Student2");
            """;

        // Start both runs simultaneously
        var task1 = _service.StartRunAsync(1, "conn-1", 1, code1, new());
        var task2 = _service.StartRunAsync(2, "conn-2", 1, code2, new());

        await Task.WhenAll(task1, task2);

        // Wait for both to finish
        await Task.Delay(3000);

        // Collect output per connection
        var output1 = GetAllOutput("conn-1");
        var output2 = GetAllOutput("conn-2");

        // Student 1 should see "Student1" and NOT "Student2"
        output1.Should().Contain("Student1",
            "Student 1's output should contain their own text");
        output1.Should().NotContain("Student2",
            "Student 1's output should NOT contain Student 2's text (cross-contamination!)");

        // Student 2 should see "Student2" and NOT "Student1"
        output2.Should().Contain("Student2",
            "Student 2's output should contain their own text");
        output2.Should().NotContain("Student1",
            "Student 2's output should NOT contain Student 1's text (cross-contamination!)");
    }

    [Fact]
    public async Task ThreeStudents_StaggeredRuns_NoOutputLeakage()
    {
        var code1 = """
            using System;
            Console.WriteLine("AAA_OUTPUT");
            """;
        var code2 = """
            using System;
            Console.WriteLine("BBB_OUTPUT");
            """;
        var code3 = """
            using System;
            Console.WriteLine("CCC_OUTPUT");
            """;

        // Stagger starts slightly
        await _service.StartRunAsync(1, "conn-a", 1, code1, new());
        await Task.Delay(50);
        await _service.StartRunAsync(2, "conn-b", 1, code2, new());
        await Task.Delay(50);
        await _service.StartRunAsync(3, "conn-c", 1, code3, new());

        await Task.Delay(3000);

        var outputA = GetAllOutput("conn-a");
        var outputB = GetAllOutput("conn-b");
        var outputC = GetAllOutput("conn-c");

        // Each student should only see their own output
        outputA.Should().Contain("AAA_OUTPUT");
        outputA.Should().NotContain("BBB_OUTPUT");
        outputA.Should().NotContain("CCC_OUTPUT");

        outputB.Should().Contain("BBB_OUTPUT");
        outputB.Should().NotContain("AAA_OUTPUT");
        outputB.Should().NotContain("CCC_OUTPUT");

        outputC.Should().Contain("CCC_OUTPUT");
        outputC.Should().NotContain("AAA_OUTPUT");
        outputC.Should().NotContain("BBB_OUTPUT");
    }

    [Fact]
    public async Task TwoStudents_OverlappingLongRuns_OutputIsIsolated()
    {
        // Student 1: prints multiple lines with delays between them
        // The loop ensures the program is running while Student 2 also runs
        var code1 = """
            using System;
            for (int i = 0; i < 5; i++)
            {
                Console.WriteLine("STUDENT1_LINE_" + i);
                // Busy wait ~100ms to keep the program alive and overlapping
                var end = DateTime.Now.AddMilliseconds(100);
                while (DateTime.Now < end) { }
            }
            """;

        var code2 = """
            using System;
            for (int i = 0; i < 5; i++)
            {
                Console.WriteLine("STUDENT2_LINE_" + i);
                var end = DateTime.Now.AddMilliseconds(100);
                while (DateTime.Now < end) { }
            }
            """;

        // Start both runs simultaneously
        var task1 = _service.StartRunAsync(1, "conn-1", 1, code1, new());
        var task2 = _service.StartRunAsync(2, "conn-2", 1, code2, new());

        await Task.WhenAll(task1, task2);

        // Wait for both to finish (5 iterations × 100ms = ~500ms + overhead)
        await Task.Delay(5000);

        var output1 = GetAllOutput("conn-1");
        var output2 = GetAllOutput("conn-2");

        // Student 1 should see ALL their lines
        for (int i = 0; i < 5; i++)
        {
            output1.Should().Contain($"STUDENT1_LINE_{i}",
                $"Student 1 should receive their line {i}");
        }

        // Student 1 should NOT see Student 2's lines
        output1.Should().NotContain("STUDENT2",
            "Student 1 should NOT see Student 2's output (cross-contamination!)");

        // Student 2 should see ALL their lines
        for (int i = 0; i < 5; i++)
        {
            output2.Should().Contain($"STUDENT2_LINE_{i}",
                $"Student 2 should receive their line {i}");
        }

        // Student 2 should NOT see Student 1's lines
        output2.Should().NotContain("STUDENT1",
            "Student 2 should NOT see Student 1's output (cross-contamination!)");
    }

    private string GetAllOutput(string connectionId)
    {
        if (!_perConnectionMessages.TryGetValue(connectionId, out var queue))
            return "";

        return string.Concat(queue
            .Where(m => m.method == "RunOutput")
            .Select(m => m.args[0] as string ?? ""));
    }

    public void Dispose() => _service.Dispose();
}
