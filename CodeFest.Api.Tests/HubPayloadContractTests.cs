using System.Text.Json;
using CodeFest.Api.Models;
using FluentAssertions;

namespace CodeFest.Api.Tests;

/// <summary>
/// Contract tests that verify the SignalR hub payloads match the Angular client's
/// expected TypeScript interfaces (Challenge, TestCase, CodePatternCheck).
/// These tests serialize anonymous objects the same way the hub does and assert
/// that all fields the client expects are present with the correct JSON types.
/// </summary>
public class HubPayloadContractTests
{
    private static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>
    /// Creates a fully-populated Challenge matching the server model.
    /// </summary>
    private static Challenge CreateTestChallenge() => new()
    {
        Id = 1,
        Title = "Hello World",
        Description = "Print hello world",
        StarterCode = "Console.WriteLine();",
        Order = 1,
        Points = 100,
        TimeLimitSeconds = 300,
        Difficulty = DifficultyLevel.Medium,
        TestCases = new List<TestCase>
        {
            new()
            {
                Id = 10,
                ChallengeId = 1,
                Description = "Basic test",
                Input = "hello",
                ExpectedOutput = "Hello World",
                IsHidden = false,
                Order = 1
            },
            new()
            {
                Id = 11,
                ChallengeId = 1,
                Description = "Hidden test",
                Input = "secret",
                ExpectedOutput = "Secret World",
                IsHidden = true,
                Order = 2
            }
        },
        PatternChecks = new List<CodePatternCheck>
        {
            new()
            {
                Id = 20,
                ChallengeId = 1,
                Type = PatternCheckType.MustContain,
                Pattern = "Console.WriteLine",
                IsRegex = false,
                FailureMessage = "Must use Console.WriteLine"
            }
        }
    };

    /// <summary>
    /// Builds the anonymous object exactly as StartSession does in CodeFestHub.
    /// </summary>
    private static object BuildStartSessionPayload(Challenge challenge) => new
    {
        challenge.Id,
        challenge.Title,
        challenge.Description,
        challenge.StarterCode,
        challenge.Order,
        challenge.Points,
        challenge.TimeLimitSeconds,
        challenge.Difficulty,
        TestCases = challenge.TestCases
            .Where(t => !t.IsHidden)
            .Select(t => new { t.Id, t.ChallengeId, t.Description, t.Input, t.ExpectedOutput, t.IsHidden, t.Order }),
        challenge.PatternChecks
    };

    /// <summary>
    /// Builds the anonymous object exactly as NextChallenge does in CodeFestHub (SubmitCode method).
    /// </summary>
    private static object BuildNextChallengePayload(Challenge challenge) => new
    {
        challenge.Id,
        challenge.Title,
        challenge.Description,
        challenge.StarterCode,
        challenge.Order,
        challenge.Points,
        challenge.TimeLimitSeconds,
        challenge.Difficulty,
        TestCases = challenge.TestCases
            .Where(t => !t.IsHidden)
            .Select(t => new { t.Id, t.ChallengeId, t.Description, t.Input, t.ExpectedOutput, t.IsHidden, t.Order }),
        challenge.PatternChecks
    };

    /// <summary>
    /// Builds the anonymous object exactly as JoinSession does in CodeFestHub.
    /// </summary>
    private static object BuildJoinSessionPayload(Challenge challenge) => new
    {
        challenge.Id,
        challenge.Title,
        challenge.Description,
        challenge.StarterCode,
        challenge.Order,
        challenge.Points,
        challenge.TimeLimitSeconds,
        Difficulty = challenge.Difficulty.ToString(),
        TestCases = challenge.TestCases
            .Where(t => !t.IsHidden)
            .Select(t => new { t.Id, t.ChallengeId, t.Input, t.ExpectedOutput, t.IsHidden, t.Order, t.Description }),
        challenge.PatternChecks
    };

    /// <summary>
    /// Helper: serialize payload with camelCase (same as SignalR default) and parse into JsonDocument.
    /// </summary>
    private static JsonElement SerializeAndParse(object payload)
    {
        var json = JsonSerializer.Serialize(payload, CamelCase);
        return JsonDocument.Parse(json).RootElement;
    }

    /// <summary>
    /// Asserts that a JSON element has all the fields the client Challenge interface expects,
    /// including nested testCases and patternChecks arrays.
    /// </summary>
    private static void AssertChallengeShape(JsonElement root)
    {
        // Top-level Challenge fields from challenge.model.ts
        root.TryGetProperty("id", out var id).Should().BeTrue("Challenge must have 'id'");
        id.ValueKind.Should().Be(JsonValueKind.Number);

        root.TryGetProperty("title", out var title).Should().BeTrue("Challenge must have 'title'");
        title.ValueKind.Should().Be(JsonValueKind.String);

        root.TryGetProperty("description", out var desc).Should().BeTrue("Challenge must have 'description'");
        desc.ValueKind.Should().Be(JsonValueKind.String);

        root.TryGetProperty("starterCode", out var starter).Should().BeTrue("Challenge must have 'starterCode'");
        starter.ValueKind.Should().Be(JsonValueKind.String);

        root.TryGetProperty("order", out var order).Should().BeTrue("Challenge must have 'order'");
        order.ValueKind.Should().Be(JsonValueKind.Number);

        root.TryGetProperty("points", out var points).Should().BeTrue("Challenge must have 'points'");
        points.ValueKind.Should().Be(JsonValueKind.Number);

        root.TryGetProperty("timeLimitSeconds", out var timeLimit).Should().BeTrue("Challenge must have 'timeLimitSeconds'");
        timeLimit.ValueKind.Should().Be(JsonValueKind.Number);

        root.TryGetProperty("difficulty", out _).Should().BeTrue("Challenge must have 'difficulty'");

        // testCases array
        root.TryGetProperty("testCases", out var testCases).Should().BeTrue("Challenge must have 'testCases'");
        testCases.ValueKind.Should().Be(JsonValueKind.Array);
        testCases.GetArrayLength().Should().BeGreaterThan(0, "testCases should not be empty for this test");

        var firstTestCase = testCases[0];
        AssertTestCaseShape(firstTestCase);

        // patternChecks array
        root.TryGetProperty("patternChecks", out var patternChecks).Should().BeTrue("Challenge must have 'patternChecks'");
        patternChecks.ValueKind.Should().Be(JsonValueKind.Array);
        patternChecks.GetArrayLength().Should().BeGreaterThan(0, "patternChecks should not be empty for this test");

        var firstPatternCheck = patternChecks[0];
        AssertPatternCheckShape(firstPatternCheck);
    }

    /// <summary>
    /// Asserts that a JSON element has all fields the client TestCase interface expects.
    /// </summary>
    private static void AssertTestCaseShape(JsonElement tc)
    {
        tc.TryGetProperty("id", out var id).Should().BeTrue("TestCase must have 'id'");
        id.ValueKind.Should().Be(JsonValueKind.Number);

        tc.TryGetProperty("challengeId", out var challengeId).Should().BeTrue("TestCase must have 'challengeId'");
        challengeId.ValueKind.Should().Be(JsonValueKind.Number);

        tc.TryGetProperty("input", out var input).Should().BeTrue("TestCase must have 'input'");
        input.ValueKind.Should().Be(JsonValueKind.String);

        tc.TryGetProperty("expectedOutput", out var expectedOutput).Should().BeTrue("TestCase must have 'expectedOutput'");
        expectedOutput.ValueKind.Should().Be(JsonValueKind.String);

        tc.TryGetProperty("isHidden", out var isHidden).Should().BeTrue("TestCase must have 'isHidden'");
        isHidden.ValueKind.Should().BeOneOf(JsonValueKind.True, JsonValueKind.False);

        tc.TryGetProperty("order", out var order).Should().BeTrue("TestCase must have 'order'");
        order.ValueKind.Should().Be(JsonValueKind.Number);

        // description is optional (string?) in the client, but should still be present in the payload
        tc.TryGetProperty("description", out _).Should().BeTrue("TestCase must have 'description'");
    }

    /// <summary>
    /// Asserts that a JSON element has all fields the client CodePatternCheck interface expects.
    /// </summary>
    private static void AssertPatternCheckShape(JsonElement pc)
    {
        pc.TryGetProperty("id", out var id).Should().BeTrue("CodePatternCheck must have 'id'");
        id.ValueKind.Should().Be(JsonValueKind.Number);

        pc.TryGetProperty("challengeId", out var challengeId).Should().BeTrue("CodePatternCheck must have 'challengeId'");
        challengeId.ValueKind.Should().Be(JsonValueKind.Number);

        pc.TryGetProperty("type", out _).Should().BeTrue("CodePatternCheck must have 'type'");

        pc.TryGetProperty("pattern", out var pattern).Should().BeTrue("CodePatternCheck must have 'pattern'");
        pattern.ValueKind.Should().Be(JsonValueKind.String);

        pc.TryGetProperty("isRegex", out var isRegex).Should().BeTrue("CodePatternCheck must have 'isRegex'");
        isRegex.ValueKind.Should().BeOneOf(JsonValueKind.True, JsonValueKind.False);

        pc.TryGetProperty("failureMessage", out var failureMessage).Should().BeTrue("CodePatternCheck must have 'failureMessage'");
        failureMessage.ValueKind.Should().Be(JsonValueKind.String);
    }

    [Fact]
    public void SessionStarted_Payload_ContainsAllClientFields()
    {
        var challenge = CreateTestChallenge();
        var payload = BuildStartSessionPayload(challenge);
        var root = SerializeAndParse(payload);

        AssertChallengeShape(root);

        // Verify hidden test cases are filtered out
        var testCases = root.GetProperty("testCases");
        testCases.GetArrayLength().Should().Be(1, "hidden test cases should be excluded");
    }

    [Fact]
    public void NextChallenge_Payload_ContainsAllClientFields()
    {
        var challenge = CreateTestChallenge();
        var payload = BuildNextChallengePayload(challenge);
        var root = SerializeAndParse(payload);

        AssertChallengeShape(root);

        // Verify hidden test cases are filtered out
        var testCases = root.GetProperty("testCases");
        testCases.GetArrayLength().Should().Be(1, "hidden test cases should be excluded");
    }

    [Fact]
    public void JoinSession_CurrentChallenge_ContainsAllClientFields()
    {
        var challenge = CreateTestChallenge();
        var payload = BuildJoinSessionPayload(challenge);
        var root = SerializeAndParse(payload);

        AssertChallengeShape(root);

        // Verify hidden test cases are filtered out
        var testCases = root.GetProperty("testCases");
        testCases.GetArrayLength().Should().Be(1, "hidden test cases should be excluded");
    }

    [Fact]
    public void AllPayloads_HaveConsistentShape()
    {
        var challenge = CreateTestChallenge();

        var startPayload = SerializeAndParse(BuildStartSessionPayload(challenge));
        var nextPayload = SerializeAndParse(BuildNextChallengePayload(challenge));
        var joinPayload = SerializeAndParse(BuildJoinSessionPayload(challenge));

        // All three payloads should have the same set of top-level property names
        var startProps = GetPropertyNames(startPayload);
        var nextProps = GetPropertyNames(nextPayload);
        var joinProps = GetPropertyNames(joinPayload);

        startProps.Should().BeEquivalentTo(nextProps,
            "StartSession and NextChallenge payloads should have the same challenge properties");
        startProps.Should().BeEquivalentTo(joinProps,
            "StartSession and JoinSession payloads should have the same challenge properties");

        // All three should have the same testCase property names
        var startTcProps = GetPropertyNames(startPayload.GetProperty("testCases")[0]);
        var nextTcProps = GetPropertyNames(nextPayload.GetProperty("testCases")[0]);
        var joinTcProps = GetPropertyNames(joinPayload.GetProperty("testCases")[0]);

        startTcProps.Should().BeEquivalentTo(nextTcProps,
            "TestCase fields should be consistent between StartSession and NextChallenge");
        startTcProps.Should().BeEquivalentTo(joinTcProps,
            "TestCase fields should be consistent between StartSession and JoinSession");

        // All three should have the same patternCheck property names
        var startPcProps = GetPropertyNames(startPayload.GetProperty("patternChecks")[0]);
        var nextPcProps = GetPropertyNames(nextPayload.GetProperty("patternChecks")[0]);
        var joinPcProps = GetPropertyNames(joinPayload.GetProperty("patternChecks")[0]);

        startPcProps.Should().BeEquivalentTo(nextPcProps,
            "PatternCheck fields should be consistent between StartSession and NextChallenge");
        startPcProps.Should().BeEquivalentTo(joinPcProps,
            "PatternCheck fields should be consistent between StartSession and JoinSession");
    }

    private static HashSet<string> GetPropertyNames(JsonElement element)
    {
        return element.EnumerateObject().Select(p => p.Name).ToHashSet();
    }
}
