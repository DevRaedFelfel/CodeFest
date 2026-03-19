using CodeFest.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace CodeFest.Api.Tests.Helpers;

public static class TestDbContextFactory
{
    public static CodeFestDbContext Create(string? dbName = null)
    {
        dbName ??= Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<CodeFestDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        var db = new CodeFestDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }
}
