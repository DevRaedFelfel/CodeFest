using System.Text.Json;
using CodeFest.Api.DTOs;

namespace CodeFest.Api.Services;

public class FileImportService
{
    public async Task<List<T>> ParseFileAsync<T>(IFormFile file) where T : class
    {
        using var reader = new StreamReader(file.OpenReadStream());
        var content = await reader.ReadToEndAsync();

        if (file.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
        {
            return JsonSerializer.Deserialize<List<T>>(content, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new List<T>();
        }

        if (file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        {
            return ParseCsv<T>(content);
        }

        throw new ArgumentException("Unsupported file format. Use CSV or JSON.");
    }

    private static List<T> ParseCsv<T>(string content) where T : class
    {
        var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => l.Trim('\r'))
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .ToList();

        if (lines.Count < 2)
            return new List<T>();

        var headers = lines[0].Split(',').Select(h => h.Trim().ToLowerInvariant()).ToArray();
        var properties = typeof(T).GetProperties()
            .ToDictionary(p => p.Name.ToLowerInvariant(), p => p);

        var results = new List<T>();

        for (int i = 1; i < lines.Count; i++)
        {
            var values = SplitCsvLine(lines[i]);
            if (values.Length != headers.Length) continue;

            var obj = Activator.CreateInstance<T>();
            for (int j = 0; j < headers.Length; j++)
            {
                if (properties.TryGetValue(headers[j], out var prop) && prop.CanWrite)
                {
                    prop.SetValue(obj, values[j].Trim());
                }
            }
            results.Add(obj);
        }

        return results;
    }

    private static string[] SplitCsvLine(string line)
    {
        var values = new List<string>();
        var current = "";
        var inQuotes = false;

        foreach (var ch in line)
        {
            if (ch == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (ch == ',' && !inQuotes)
            {
                values.Add(current);
                current = "";
            }
            else
            {
                current += ch;
            }
        }
        values.Add(current);
        return values.ToArray();
    }
}

// CSV import DTOs
public class UserImportRow
{
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public class CourseImportRow
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string InstructorEmail { get; set; } = string.Empty;
}

public class EnrollmentImportRow
{
    public string StudentEmail { get; set; } = string.Empty;
    public string CourseCode { get; set; } = string.Empty;
}
