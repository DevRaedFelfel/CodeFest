using CodeFest.Api.Models;
using CodeFest.Api.Services;
using CodeFest.Api.Tests.Helpers;
using FluentAssertions;

namespace CodeFest.Api.Tests.Services;

public class ChallengeServiceTests
{
    private ChallengeService CreateService(string? dbName = null)
    {
        var db = TestDbContextFactory.Create(dbName);
        var executor = new CodeExecutionService();
        return new ChallengeService(db, executor);
    }

    private Challenge CreateSampleChallenge(string title = "Hello World", int order = 1)
    {
        return new Challenge
        {
            Title = title,
            Description = "Print Hello World",
            StarterCode = "using System;\nConsole.WriteLine(\"Hello World\");",
            Order = order,
            Points = 100,
            TimeLimitSeconds = 300,
            Difficulty = DifficultyLevel.Easy,
            TestCases = new List<TestCase>
            {
                new TestCase
                {
                    Input = "",
                    ExpectedOutput = "Hello World",
                    IsHidden = false,
                    Order = 1,
                    Description = "Basic test"
                }
            },
            PatternChecks = new List<CodePatternCheck>
            {
                new CodePatternCheck
                {
                    Type = PatternCheckType.MustContain,
                    Pattern = "Console.WriteLine",
                    IsRegex = false,
                    FailureMessage = "Must use Console.WriteLine"
                }
            }
        };
    }

    // --- GetAllAsync ---

    [Fact]
    public async Task GetAllAsync_ShouldReturnEmptyWhenNoChallenges()
    {
        var service = CreateService();

        var result = await service.GetAllAsync();

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAllAsync_ShouldReturnAllChallengesOrderedByOrder()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);

        await service.CreateAsync(CreateSampleChallenge("Second", 2));
        await service.CreateAsync(CreateSampleChallenge("First", 1));

        var result = await service.GetAllAsync();

        result.Should().HaveCount(2);
        result[0].Title.Should().Be("First");
        result[1].Title.Should().Be("Second");
    }

    [Fact]
    public async Task GetAllAsync_ShouldIncludeTestCasesAndPatternChecks()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);

        await service.CreateAsync(CreateSampleChallenge());

        var result = await service.GetAllAsync();

        result[0].TestCases.Should().HaveCount(1);
        result[0].PatternChecks.Should().HaveCount(1);
    }

    // --- GetByIdAsync ---

    [Fact]
    public async Task GetByIdAsync_ShouldReturnChallengeById()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);

        var created = await service.CreateAsync(CreateSampleChallenge());

        var result = await service.GetByIdAsync(created.Id);

        result.Should().NotBeNull();
        result!.Title.Should().Be("Hello World");
        result.TestCases.Should().HaveCount(1);
        result.PatternChecks.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetByIdAsync_ShouldReturnNullForNonexistentId()
    {
        var service = CreateService();

        var result = await service.GetByIdAsync(999);

        result.Should().BeNull();
    }

    // --- CreateAsync ---

    [Fact]
    public async Task CreateAsync_ShouldPersistChallenge()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);

        var challenge = CreateSampleChallenge();
        var created = await service.CreateAsync(challenge);

        created.Id.Should().BeGreaterThan(0);
        created.Title.Should().Be("Hello World");
        created.Points.Should().Be(100);
    }

    [Fact]
    public async Task CreateAsync_ShouldPersistTestCases()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);

        var challenge = CreateSampleChallenge();
        var created = await service.CreateAsync(challenge);

        var fetched = await service.GetByIdAsync(created.Id);
        fetched!.TestCases.Should().HaveCount(1);
        fetched.TestCases[0].ExpectedOutput.Should().Be("Hello World");
    }

    // --- UpdateAsync ---

    [Fact]
    public async Task UpdateAsync_ShouldUpdateFields()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var created = await service.CreateAsync(CreateSampleChallenge());

        var updated = new Challenge
        {
            Title = "Updated Title",
            Description = "Updated Desc",
            StarterCode = "updated code",
            Order = 5,
            Points = 250,
            TimeLimitSeconds = 600,
            Difficulty = DifficultyLevel.Hard
        };

        var result = await service.UpdateAsync(created.Id, updated);

        result.Should().NotBeNull();
        result!.Title.Should().Be("Updated Title");
        result.Points.Should().Be(250);
        result.Difficulty.Should().Be(DifficultyLevel.Hard);
    }

    [Fact]
    public async Task UpdateAsync_ShouldReturnNullForNonexistentId()
    {
        var service = CreateService();

        var result = await service.UpdateAsync(999, new Challenge { Title = "X" });

        result.Should().BeNull();
    }

    // --- DeleteAsync ---

    [Fact]
    public async Task DeleteAsync_ShouldRemoveChallenge()
    {
        var dbName = Guid.NewGuid().ToString();
        var service = CreateService(dbName);
        var created = await service.CreateAsync(CreateSampleChallenge());

        var result = await service.DeleteAsync(created.Id);

        result.Should().BeTrue();
        (await service.GetByIdAsync(created.Id)).Should().BeNull();
    }

    [Fact]
    public async Task DeleteAsync_ShouldReturnFalseForNonexistentId()
    {
        var service = CreateService();

        var result = await service.DeleteAsync(999);

        result.Should().BeFalse();
    }
}
