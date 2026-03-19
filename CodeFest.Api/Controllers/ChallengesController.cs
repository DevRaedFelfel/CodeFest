using CodeFest.Api.Models;
using CodeFest.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CodeFest.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChallengesController : ControllerBase
{
    private readonly ChallengeService _challengeService;
    private readonly IWebHostEnvironment _env;

    public ChallengesController(ChallengeService challengeService, IWebHostEnvironment env)
    {
        _challengeService = challengeService;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<List<Challenge>>> GetAll()
    {
        var challenges = await _challengeService.GetAllAsync();
        return Ok(challenges);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Challenge>> GetById(int id)
    {
        var challenge = await _challengeService.GetByIdAsync(id);
        if (challenge == null) return NotFound();
        return Ok(challenge);
    }

    [HttpPost]
    public async Task<ActionResult<Challenge>> Create([FromBody] Challenge challenge)
    {
        var created = await _challengeService.CreateAsync(challenge);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Challenge>> Update(int id, [FromBody] Challenge challenge)
    {
        var updated = await _challengeService.UpdateAsync(id, challenge);
        if (updated == null) return NotFound();
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _challengeService.DeleteAsync(id);
        if (!deleted) return NotFound();
        return NoContent();
    }

    [HttpPost("seed")]
    public async Task<IActionResult> Seed()
    {
        // In Docker, seed-data is copied alongside the app
        var seedPath = Path.Combine(_env.ContentRootPath, "seed-data", "challenges.json");
        if (!System.IO.File.Exists(seedPath))
        {
            // Try relative path for local development
            seedPath = Path.Combine(_env.ContentRootPath, "..", "seed-data", "challenges.json");
        }

        try
        {
            var count = await _challengeService.SeedFromJsonAsync(seedPath);
            return Ok(new { message = $"Seeded {count} challenges." });
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { message = "Seed file not found.", path = seedPath });
        }
    }
}
