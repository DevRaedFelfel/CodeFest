using CodeFest.Api.Models;
using FluentAssertions;

namespace CodeFest.Api.Tests.Services;

public class RunSessionTests
{
    [Fact]
    public void NewSession_HasDefaultValues()
    {
        var session = new RunSession
        {
            SessionId = "test-123",
            StudentId = 1,
            ConnectionId = "conn-1",
            ChallengeId = 1,
            StartedAt = DateTime.UtcNow,
            State = RunSessionState.Running
        };

        session.Cts.Should().NotBeNull();
        session.Cts.IsCancellationRequested.Should().BeFalse();
        session.StdinWriter.Should().BeNull();
        session.ExecutionTask.Should().BeNull();
    }

    [Fact]
    public void Dispose_CancelsCancellationToken()
    {
        var session = new RunSession
        {
            SessionId = "test-123",
            StudentId = 1,
            ConnectionId = "conn-1",
            ChallengeId = 1,
            StartedAt = DateTime.UtcNow,
            State = RunSessionState.Running
        };

        session.Dispose();

        session.Cts.IsCancellationRequested.Should().BeTrue();
    }

    [Fact]
    public void AllStatesAreDefined()
    {
        var states = Enum.GetValues<RunSessionState>();
        states.Should().HaveCount(6);
        states.Should().Contain(RunSessionState.Compiling);
        states.Should().Contain(RunSessionState.Running);
        states.Should().Contain(RunSessionState.WaitingForInput);
        states.Should().Contain(RunSessionState.Finished);
        states.Should().Contain(RunSessionState.Error);
        states.Should().Contain(RunSessionState.Cancelled);
    }
}
