using System.Collections.Concurrent;
using CodeFest.Api.DTOs;
using CodeFest.Api.Hubs;
using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CodeFest.Api.Tests.Services;

public class InteractiveRunServiceTests : IDisposable
{
    static InteractiveRunServiceTests() => PerSessionConsoleFixture.EnsureInstalled();
    private readonly ConcurrentQueue<(string method, object?[] args)> _sentMessages = new();
    private readonly InteractiveRunService _service;

    public InteractiveRunServiceTests()
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

        // Create a real CodeExecutionService via scope factory mock
        var scopeFactory = CreateScopeFactory();

        _service = new InteractiveRunService(
            hubContextMock.Object,
            NullLogger<InteractiveRunService>.Instance,
            scopeFactory);
    }

    private static IServiceScopeFactory CreateScopeFactory()
    {
        var services = new ServiceCollection();
        services.AddScoped<CodeExecutionService>();
        var provider = services.BuildServiceProvider();
        return provider.GetRequiredService<IServiceScopeFactory>();
    }

    [Fact]
    public async Task StartRun_CompileError_SendsCompileErrorAndFinished()
    {
        await _service.StartRunAsync(1, "conn-1", 1, "bad code {", new());

        await Task.Delay(200);

        var methods = _sentMessages.Select(m => m.method).ToList();
        methods.Should().Contain("RunCompiling");
        methods.Should().Contain("RunCompileError");
        methods.Should().Contain("RunFinished");
        _service.HasActiveRun(1).Should().BeFalse();
    }

    [Fact]
    public async Task StartRun_PatternCheckFails_SendsErrorImmediately()
    {
        var patterns = new List<CodePatternCheck>
        {
            new()
            {
                Type = PatternCheckType.MustContain,
                Pattern = "for",
                IsRegex = false,
                FailureMessage = "Must use for loop"
            }
        };

        await _service.StartRunAsync(1, "conn-1", 1,
            "Console.WriteLine(\"hello\");", patterns);

        await Task.Delay(100);

        var methods = _sentMessages.Select(m => m.method).ToList();
        methods.Should().Contain("RunError");
        methods.Should().Contain("RunFinished");
        _service.HasActiveRun(1).Should().BeFalse();
    }

    [Fact]
    public async Task StartRun_SimpleProgram_SendsOutputAndFinished()
    {
        var code = """
            using System;
            Console.WriteLine("hello");
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());

        await Task.Delay(2000);

        var methods = _sentMessages.Select(m => m.method).ToList();
        methods.Should().Contain("RunStarted");
        methods.Should().Contain("RunOutput");
        methods.Should().Contain("RunFinished");

        // Check exit code is 0
        var finished = _sentMessages.FirstOrDefault(m => m.method == "RunFinished");
        finished.args[0].Should().Be(0);
    }

    [Fact]
    public async Task StopRun_CancelsExecution()
    {
        var loopCode = """
            using System;
            while(true) { }
            """;

        await _service.StartRunAsync(1, "conn-1", 1, loopCode, new());

        await Task.Delay(300);
        _service.HasActiveRun(1).Should().BeTrue();

        await _service.StopRunAsync(1);

        await Task.Delay(500);
        _service.HasActiveRun(1).Should().BeFalse();

        var methods = _sentMessages.Select(m => m.method).ToList();
        methods.Should().Contain("RunFinished");
    }

    [Fact]
    public async Task SendInput_NoActiveRun_DoesNothing()
    {
        await _service.SendInputAsync(999, "orphan input");

        _sentMessages.Should().BeEmpty();
    }

    [Fact]
    public async Task HasActiveRun_ReturnsFalse_WhenNoRun()
    {
        _service.HasActiveRun(999).Should().BeFalse();
    }

    [Fact]
    public async Task StartRun_BlockedCode_ReportsCompileError()
    {
        var code = """
            using System;
            System.IO.File.ReadAllText("test.txt");
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());

        await Task.Delay(200);

        var methods = _sentMessages.Select(m => m.method).ToList();
        methods.Should().Contain("RunCompileError");
        _service.HasActiveRun(1).Should().BeFalse();
    }

    [Fact]
    public async Task StartRun_RuntimeException_ReportsError()
    {
        var code = """
            using System;
            int[] a = new int[1];
            Console.WriteLine(a[5]);
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());

        await Task.Delay(2000);

        var errorMessages = _sentMessages.Where(m => m.method == "RunError").ToList();
        errorMessages.Should().NotBeEmpty();

        var errorMsg = errorMessages[0].args[0] as string;
        errorMsg.Should().Contain("IndexOutOfRangeException");
    }

    [Fact]
    public async Task OnStudentDisconnected_StartsGracePeriod()
    {
        var code = """
            using System;
            while(true) { }
            """;

        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await Task.Delay(300);
        _service.HasActiveRun(1).Should().BeTrue();

        // OnStudentDisconnectedAsync now starts a grace period
        // (not an immediate kill)
        await _service.OnStudentDisconnectedAsync(1);

        // Run should still be active during grace period
        await Task.Delay(500);
        _service.HasActiveRun(1).Should().BeTrue();

        // Use StopRunAsync directly for immediate kill
        await _service.StopRunAsync(1);
        await Task.Delay(500);
        _service.HasActiveRun(1).Should().BeFalse();
    }

    [Fact]
    public async Task StartRun_KillsPreviousRun()
    {
        // Start first run (infinite loop)
        var code1 = """
            using System;
            while(true) { }
            """;
        await _service.StartRunAsync(1, "conn-1", 1, code1, new());
        await Task.Delay(300);
        _service.HasActiveRun(1).Should().BeTrue();

        // Start second run — should kill first
        var code2 = """
            using System;
            Console.WriteLine("v2");
            """;
        await _service.StartRunAsync(1, "conn-1", 1, code2, new());

        await Task.Delay(2000);

        // Should have a RunFinished with -1 (killed) from the first run
        var finishedMessages = _sentMessages.Where(m => m.method == "RunFinished").ToList();
        finishedMessages.Should().HaveCountGreaterThanOrEqualTo(2);
        finishedMessages.Should().Contain(m => (int)m.args[0]! == -1);
    }

    public void Dispose() => _service.Dispose();
}
