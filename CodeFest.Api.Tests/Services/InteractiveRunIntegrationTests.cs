using System.Collections.Concurrent;
using CodeFest.Api.DTOs;
using CodeFest.Api.Hubs;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CodeFest.Api.Tests.Services;

/// <summary>
/// Integration tests that verify the full pipeline:
/// InteractiveRunService → Roslyn compilation → execution → SignalR events.
/// Uses a real CodeExecutionService (no mocks) with mocked SignalR hub context.
/// </summary>
public class InteractiveRunIntegrationTests : IDisposable
{
    private readonly ConcurrentQueue<(string method, object?[] args)> _sentMessages = new();
    private readonly InteractiveRunService _service;

    public InteractiveRunIntegrationTests()
    {
        var clientProxyMock = new Mock<ISingleClientProxy>();
        clientProxyMock
            .Setup(x => x.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Callback<string, object?[], CancellationToken>((method, args, _) =>
                _sentMessages.Enqueue((method, args)))
            .Returns(Task.CompletedTask);

        var hubClientsMock = new Mock<IHubClients>();
        hubClientsMock.Setup(x => x.Client(It.IsAny<string>()))
            .Returns(clientProxyMock.Object);

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
    public async Task Integration_HelloWorld_StreamsOutputAndFinishes()
    {
        var code = """
            using System;
            Console.WriteLine("Hello from interactive run!");
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await WaitForMessage("RunFinished", TimeSpan.FromSeconds(10));

        var methods = GetMethods();
        methods.Should().Contain("RunCompiling");
        methods.Should().Contain("RunStarted");
        methods.Should().Contain("RunOutput");
        methods.Should().Contain("RunFinished");

        var outputMessages = _sentMessages.Where(m => m.method == "RunOutput").ToList();
        var allOutput = string.Concat(outputMessages.Select(m => m.args[0] as string));
        allOutput.Should().Contain("Hello from interactive run!");

        var finished = _sentMessages.Last(m => m.method == "RunFinished");
        finished.args[0].Should().Be(0);
    }

    [Fact]
    public async Task Integration_WithReadLine_WaitsForInputThenContinues()
    {
        var code = """
            using System;
            Console.Write("Enter name: ");
            var name = Console.ReadLine();
            Console.WriteLine($"Hello, {name}!");
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await WaitForMessage("RunWaiting", TimeSpan.FromSeconds(5));

        // Verify prompt output
        var outputMessages = _sentMessages.Where(m => m.method == "RunOutput").ToList();
        var allOutput = string.Concat(outputMessages.Select(m => m.args[0] as string));
        allOutput.Should().Contain("Enter name: ");

        // Send input
        await _service.SendInputAsync(1, "Ali");
        await WaitForMessage("RunFinished", TimeSpan.FromSeconds(5));

        GetMethods().Should().Contain("RunInputEcho");

        var allOutput2 = string.Concat(_sentMessages
            .Where(m => m.method == "RunOutput")
            .Select(m => m.args[0] as string));
        allOutput2.Should().Contain("Hello, Ali!");
    }

    [Fact]
    public async Task Integration_MultipleReadLines_HandlesSequentialInput()
    {
        var code = """
            using System;
            Console.Write("First: ");
            var a = Console.ReadLine();
            Console.Write("Second: ");
            var b = Console.ReadLine();
            Console.WriteLine($"{a} + {b}");
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());

        // First input
        await WaitForMessage("RunWaiting", TimeSpan.FromSeconds(5));
        await _service.SendInputAsync(1, "Hello");

        // Second input — wait for next "waiting" event
        await WaitForNthMessage("RunWaiting", 2, TimeSpan.FromSeconds(5));
        await _service.SendInputAsync(1, "World");

        await WaitForMessage("RunFinished", TimeSpan.FromSeconds(5));

        var allOutput = string.Concat(_sentMessages
            .Where(m => m.method == "RunOutput")
            .Select(m => m.args[0] as string));
        allOutput.Should().Contain("Hello + World");
    }

    [Fact]
    public async Task Integration_CompileError_ReturnsErrors()
    {
        var code = """
            using System;
            Console.WritLine("typo");
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await WaitForMessage("RunFinished", TimeSpan.FromSeconds(5));

        GetMethods().Should().Contain("RunCompileError");

        var compileError = _sentMessages.First(m => m.method == "RunCompileError");
        var errors = compileError.args[0] as List<CompileError>;
        errors.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Integration_RuntimeException_ReportsError()
    {
        var code = """
            using System;
            int[] arr = new int[3];
            Console.WriteLine(arr[10]);
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await WaitForMessage("RunFinished", TimeSpan.FromSeconds(5));

        var errorMessages = _sentMessages.Where(m => m.method == "RunError").ToList();
        errorMessages.Should().NotBeEmpty();
        (errorMessages[0].args[0] as string).Should().Contain("IndexOutOfRangeException");
    }

    [Fact]
    public async Task Integration_StopRun_KillsActiveExecution()
    {
        var code = """
            using System;
            while(true) { }
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await WaitForMessage("RunStarted", TimeSpan.FromSeconds(5));

        await _service.StopRunAsync(1);
        await Task.Delay(500);

        _service.HasActiveRun(1).Should().BeFalse();
        GetMethods().Should().Contain("RunFinished");

        var finished = _sentMessages.Where(m => m.method == "RunFinished").ToList();
        finished.Should().Contain(m => (int)m.args[0]! == -1);
    }

    [Fact]
    public async Task Integration_NewRun_KillsPreviousRun()
    {
        var code1 = """
            using System;
            while(true) { }
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code1, new());
        await WaitForMessage("RunStarted", TimeSpan.FromSeconds(5));

        var code2 = """
            using System;
            Console.WriteLine("second run");
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code2, new());
        await Task.Delay(3000);

        var finishedMessages = _sentMessages.Where(m => m.method == "RunFinished").ToList();
        finishedMessages.Should().HaveCountGreaterThanOrEqualTo(2);
        finishedMessages.Should().Contain(m => (int)m.args[0]! == -1); // killed
        finishedMessages.Should().Contain(m => (int)m.args[0]! == 0);  // success
    }

    // Helpers

    private List<string> GetMethods() =>
        _sentMessages.Select(m => m.method).ToList();

    private async Task WaitForMessage(string messageType, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (_sentMessages.Any(m => m.method == messageType)) return;
            await Task.Delay(50);
        }
        throw new TimeoutException($"Message '{messageType}' not received within {timeout}");
    }

    private async Task WaitForNthMessage(string messageType, int n, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (_sentMessages.Count(m => m.method == messageType) >= n) return;
            await Task.Delay(50);
        }
        throw new TimeoutException($"Message '{messageType}' #{n} not received within {timeout}");
    }

    public void Dispose() => _service.Dispose();
}
