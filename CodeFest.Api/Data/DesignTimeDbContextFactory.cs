using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CodeFest.Api.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<CodeFestDbContext>
{
    public CodeFestDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<CodeFestDbContext>();
        // Use a dummy connection string for migration generation only
        optionsBuilder.UseMySql(
            "Server=localhost;Database=codefest;User=root;Password=dummy",
            new MySqlServerVersion(new Version(8, 0, 0)));

        return new CodeFestDbContext(optionsBuilder.Options);
    }
}
