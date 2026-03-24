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

public class InteractiveRunGracePeriodTests : IDisposable
{
    static InteractiveRunGracePeriodTests() => PerSessionConsoleFixture.EnsureInstalled();
    private readonly ConcurrentQueue<(string method, object?[] args)> _sentMessages = new();
    private readonly InteractiveRunService _service;

    public InteractiveRunGracePeriodTests()
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
    public async Task GracePeriod_StudentReconnectsInTime_RunContinues()
    {
        var code = """
            using System;
            Console.ReadLine();
            """;
        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await Task.Delay(500);
        _service.HasActiveRun(1).Should().BeTrue();

        // Simulate disconnect — start short grace period
        _ = _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 3);

        // Student reconnects after 1 second
        await Task.Delay(1000);
        _service.OnStudentReconnected(1, "conn-2");

        // Run should still be active
        _service.HasActiveRun(1).Should().BeTrue();

        // Wait past grace period to confirm it was cancelled
        await Task.Delay(3000);
        _service.HasActiveRun(1).Should().BeTrue();
    }

    [Fact]
    public async Task GracePeriod_StudentDoesNotReconnect_RunKilled()
    {
        var code = """
            using System;
            Console.ReadLine();
            """;
        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await Task.Delay(500);

        // Simulate disconnect — 2 second grace
        await _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 2);

        // Grace period expired
        _service.HasActiveRun(1).Should().BeFalse();
    }

    [Fact]
    public async Task GracePeriod_ReconnectUpdatesConnectionId()
    {
        var code = """
            using System;
            Console.ReadLine();
            """;
        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await Task.Delay(500);

        _ = _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 10);
        await Task.Delay(200);

        _service.OnStudentReconnected(1, "conn-2");

        // Should send RunResumed to new connection
        _sentMessages.Should().Contain(m => m.method == "RunResumed");
    }

    [Fact]
    public async Task GracePeriod_MultipleDisconnects_OnlyLatestTimerActive()
    {
        var code = """
            using System;
            Console.ReadLine();
            """;
        await _service.StartRunAsync(1, "conn-1", 1, code, new());
        await Task.Delay(500);

        // First disconnect
        _ = _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 10);
        await Task.Delay(200);

        // Reconnect
        _service.OnStudentReconnected(1, "conn-2");

        // Second disconnect with short grace
        _ = _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 2);

        // Wait for second grace period to expire
        await Task.Delay(3000);

        // Run should be killed (second timer expired)
        _service.HasActiveRun(1).Should().BeFalse();
    }

    public void Dispose() => _service.Dispose();
}
