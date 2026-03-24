using System.Reflection;

namespace CodeFest.Api.Models;

public class CompileResult
{
    public bool Success { get; set; }
    public Assembly? CompiledAssembly { get; set; }
    public List<CompileError> Errors { get; set; } = new();
    public long CompileTimeMs { get; set; }
}

public class CompileError
{
    public string Message { get; set; } = string.Empty;
    public int Line { get; set; }
    public int Column { get; set; }
    public string Severity { get; set; } = "Error";
}
