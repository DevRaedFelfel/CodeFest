using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CodeFest.Api.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<CodeFestDbContext>
{
    public CodeFestDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<CodeFestDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=codefest;Username=postgres;Password=dummy");

        return new CodeFestDbContext(optionsBuilder.Options);
    }
}
