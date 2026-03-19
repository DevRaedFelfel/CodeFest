using System.Text.Json;
using CodeFest.Api.Data;
using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Services;

public class ChallengeService
{
    private readonly CodeFestDbContext _db;
    private readonly CodeExecutionService _executor;

    public ChallengeService(CodeFestDbContext db, CodeExecutionService executor)
    {
        _db = db;
        _executor = executor;
    }

    public async Task<List<Challenge>> GetAllAsync()
    {
        return await _db.Challenges
            .Include(c => c.TestCases.OrderBy(t => t.Order))
            .Include(c => c.PatternChecks)
            .OrderBy(c => c.Order)
            .ToListAsync();
    }

    public async Task<Challenge?> GetByIdAsync(int id)
    {
        return await _db.Challenges
            .Include(c => c.TestCases.OrderBy(t => t.Order))
            .Include(c => c.PatternChecks)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<Challenge> CreateAsync(Challenge challenge)
    {
        _db.Challenges.Add(challenge);
        await _db.SaveChangesAsync();
        return challenge;
    }

    public async Task<Challenge?> UpdateAsync(int id, Challenge updated)
    {
        var challenge = await _db.Challenges.FindAsync(id);
        if (challenge == null) return null;

        challenge.Title = updated.Title;
        challenge.Description = updated.Description;
        challenge.StarterCode = updated.StarterCode;
        challenge.Order = updated.Order;
        challenge.Points = updated.Points;
        challenge.TimeLimitSeconds = updated.TimeLimitSeconds;
        challenge.Difficulty = updated.Difficulty;

        await _db.SaveChangesAsync();
        return challenge;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var challenge = await _db.Challenges.FindAsync(id);
        if (challenge == null) return false;

        _db.Challenges.Remove(challenge);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<SubmissionResult> RunTests(int challengeId, string code)
    {
        var challenge = await GetByIdAsync(challengeId);
        if (challenge == null)
        {
            return new SubmissionResult { CompileError = "Challenge not found." };
        }

        return _executor.Execute(code, challenge);
    }

    public async Task<int> SeedFromJsonAsync(string jsonPath)
    {
        if (!File.Exists(jsonPath))
            throw new FileNotFoundException("Seed file not found.", jsonPath);

        var json = await File.ReadAllTextAsync(jsonPath);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var seedData = JsonSerializer.Deserialize<List<SeedChallenge>>(json, options);

        if (seedData == null || seedData.Count == 0)
            return 0;

        // Clear existing challenges
        var existing = await _db.Challenges
            .Include(c => c.TestCases)
            .Include(c => c.PatternChecks)
            .ToListAsync();
        _db.Challenges.RemoveRange(existing);

        foreach (var seed in seedData)
        {
            var challenge = new Challenge
            {
                Title = seed.Title,
                Description = seed.Description,
                StarterCode = seed.StarterCode,
                Order = seed.Order,
                Points = seed.Points,
                TimeLimitSeconds = seed.TimeLimitSeconds,
                Difficulty = Enum.Parse<DifficultyLevel>(seed.Difficulty, true),
            };

            int testOrder = 1;
            foreach (var tc in seed.TestCases)
            {
                challenge.TestCases.Add(new TestCase
                {
                    Input = tc.Input,
                    ExpectedOutput = tc.ExpectedOutput,
                    IsHidden = tc.IsHidden,
                    Description = tc.Description,
                    Order = testOrder++,
                });
            }

            foreach (var pc in seed.PatternChecks)
            {
                challenge.PatternChecks.Add(new CodePatternCheck
                {
                    Type = Enum.Parse<PatternCheckType>(pc.Type, true),
                    Pattern = pc.Pattern,
                    IsRegex = pc.IsRegex,
                    FailureMessage = pc.FailureMessage,
                });
            }

            _db.Challenges.Add(challenge);
        }

        await _db.SaveChangesAsync();
        return seedData.Count;
    }

    // Seed DTOs
    private class SeedChallenge
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string StarterCode { get; set; } = string.Empty;
        public int Order { get; set; }
        public int Points { get; set; }
        public int TimeLimitSeconds { get; set; }
        public string Difficulty { get; set; } = string.Empty;
        public List<SeedTestCase> TestCases { get; set; } = new();
        public List<SeedPatternCheck> PatternChecks { get; set; } = new();
    }

    private class SeedTestCase
    {
        public string Input { get; set; } = string.Empty;
        public string ExpectedOutput { get; set; } = string.Empty;
        public bool IsHidden { get; set; }
        public string? Description { get; set; }
    }

    private class SeedPatternCheck
    {
        public string Type { get; set; } = string.Empty;
        public string Pattern { get; set; } = string.Empty;
        public bool IsRegex { get; set; }
        public string FailureMessage { get; set; } = string.Empty;
    }
}
