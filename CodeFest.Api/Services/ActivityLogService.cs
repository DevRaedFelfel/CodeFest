using CodeFest.Api.Data;
using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Services;

public class ActivityLogService
{
    private readonly CodeFestDbContext _db;

    public ActivityLogService(CodeFestDbContext db)
    {
        _db = db;
    }

    public async Task<ActivityLog> LogAsync(int studentId, int sessionId, ActivityType type, string? data = null)
    {
        var log = new ActivityLog
        {
            StudentId = studentId,
            SessionId = sessionId,
            Type = type,
            Data = data,
            Timestamp = DateTime.UtcNow
        };

        _db.ActivityLogs.Add(log);
        await _db.SaveChangesAsync();
        return log;
    }

    public async Task<List<StudentActivity>> GetBySessionAsync(string sessionCode, int page = 1, int pageSize = 50, ActivityType? typeFilter = null)
    {
        var query = _db.ActivityLogs
            .Include(a => a.Student)
            .Include(a => a.Session)
            .Where(a => a.Session.Code == sessionCode);

        if (typeFilter.HasValue)
            query = query.Where(a => a.Type == typeFilter.Value);

        return await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new StudentActivity
            {
                StudentId = a.StudentId,
                DisplayName = a.Student.DisplayName,
                ActivityType = a.Type.ToString(),
                Data = a.Data,
                Timestamp = a.Timestamp
            })
            .ToListAsync();
    }

    public async Task<List<StudentActivity>> GetByStudentAsync(int studentId, int page = 1, int pageSize = 50)
    {
        return await _db.ActivityLogs
            .Include(a => a.Student)
            .Where(a => a.StudentId == studentId)
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new StudentActivity
            {
                StudentId = a.StudentId,
                DisplayName = a.Student.DisplayName,
                ActivityType = a.Type.ToString(),
                Data = a.Data,
                Timestamp = a.Timestamp
            })
            .ToListAsync();
    }
}
