using CodeFest.Api.Data;
using CodeFest.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Services;

public class SessionService
{
    private readonly CodeFestDbContext _db;

    public SessionService(CodeFestDbContext db)
    {
        _db = db;
    }

    public async Task<Session> CreateAsync(string name, List<int> challengeIds, string teacherConnectionId)
    {
        var session = new Session
        {
            Code = GenerateSessionCode(),
            Name = name,
            Status = SessionStatus.Lobby,
            CreatedAt = DateTime.UtcNow,
            TeacherConnectionId = teacherConnectionId,
            ChallengeIds = challengeIds
        };

        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();
        return session;
    }

    public async Task<Session?> GetByCodeAsync(string code)
    {
        return await _db.Sessions
            .Include(s => s.Students)
            .FirstOrDefaultAsync(s => s.Code == code);
    }

    public async Task<List<Session>> GetAllAsync()
    {
        return await _db.Sessions
            .Include(s => s.Students)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
    }

    public async Task<Session?> StartAsync(string code)
    {
        var session = await GetByCodeAsync(code);
        if (session == null || session.Status != SessionStatus.Lobby) return null;

        session.Status = SessionStatus.Active;
        session.StartedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return session;
    }

    public async Task<Session?> PauseAsync(string code)
    {
        var session = await GetByCodeAsync(code);
        if (session == null || session.Status != SessionStatus.Active) return null;

        session.Status = SessionStatus.Paused;
        await _db.SaveChangesAsync();
        return session;
    }

    public async Task<Session?> ResumeAsync(string code)
    {
        var session = await GetByCodeAsync(code);
        if (session == null || session.Status != SessionStatus.Paused) return null;

        session.Status = SessionStatus.Active;
        await _db.SaveChangesAsync();
        return session;
    }

    public async Task<Session?> EndAsync(string code)
    {
        var session = await GetByCodeAsync(code);
        if (session == null) return null;

        session.Status = SessionStatus.Ended;
        session.EndedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return session;
    }

    public async Task<Student> JoinStudentAsync(string sessionCode, string displayName, string connectionId, StudentClientType clientType)
    {
        var session = await GetByCodeAsync(sessionCode);
        if (session == null) throw new InvalidOperationException("Session not found.");
        if (session.Status == SessionStatus.Ended) throw new InvalidOperationException("Session has ended.");

        // Check if student is reconnecting
        var existing = session.Students.FirstOrDefault(s => s.DisplayName == displayName);
        if (existing != null)
        {
            existing.ConnectionId = connectionId;
            existing.IsConnected = true;
            await _db.SaveChangesAsync();
            return existing;
        }

        var student = new Student
        {
            SessionId = session.Id,
            DisplayName = displayName,
            ConnectionId = connectionId,
            CurrentChallengeIndex = 0,
            TotalPoints = 0,
            JoinedAt = DateTime.UtcNow,
            IsConnected = true,
            ClientType = clientType
        };

        _db.Students.Add(student);
        await _db.SaveChangesAsync();
        return student;
    }

    public async Task DisconnectStudentAsync(string connectionId)
    {
        var student = await _db.Students.FirstOrDefaultAsync(s => s.ConnectionId == connectionId);
        if (student != null)
        {
            student.IsConnected = false;
            await _db.SaveChangesAsync();
        }
    }

    public async Task<Student?> GetStudentByConnectionIdAsync(string connectionId)
    {
        return await _db.Students.FirstOrDefaultAsync(s => s.ConnectionId == connectionId);
    }

    public async Task<Student?> GetStudentByIdAsync(int id)
    {
        return await _db.Students.FindAsync(id);
    }

    public async Task UpdateStudentPointsAsync(int studentId, int points, int challengeIndex)
    {
        var student = await _db.Students.FindAsync(studentId);
        if (student != null)
        {
            student.TotalPoints += points;
            student.CurrentChallengeIndex = challengeIndex;
            await _db.SaveChangesAsync();
        }
    }

    public async Task<List<LeaderboardEntry>> GetLeaderboardAsync(string sessionCode)
    {
        var session = await GetByCodeAsync(sessionCode);
        if (session == null) return new List<LeaderboardEntry>();

        var students = session.Students
            .OrderByDescending(s => s.TotalPoints)
            .ThenBy(s => s.JoinedAt)
            .ToList();

        var entries = new List<LeaderboardEntry>();
        for (int i = 0; i < students.Count; i++)
        {
            entries.Add(new LeaderboardEntry
            {
                StudentId = students[i].Id,
                DisplayName = students[i].DisplayName,
                TotalPoints = students[i].TotalPoints,
                ChallengesCompleted = students[i].CurrentChallengeIndex,
                Rank = i + 1
            });
        }

        return entries;
    }

    public async Task UpdateTeacherConnectionAsync(string sessionCode, string connectionId)
    {
        var session = await _db.Sessions.FirstOrDefaultAsync(s => s.Code == sessionCode);
        if (session != null)
        {
            session.TeacherConnectionId = connectionId;
            await _db.SaveChangesAsync();
        }
    }

    private static string GenerateSessionCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = Random.Shared;
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }
}
