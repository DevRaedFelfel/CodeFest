using CodeFest.Api.Services;

namespace CodeFest.Api.Tests.Helpers;

/// <summary>
/// Installs PerSessionConsole wrappers once for the entire test assembly.
/// Any test class that runs student code via InteractiveRunService should
/// inherit from this or call EnsureInstalled() in a static constructor.
/// </summary>
public static class PerSessionConsoleFixture
{
    private static int _installed;

    public static void EnsureInstalled()
    {
        if (Interlocked.Exchange(ref _installed, 1) != 0) return;

        Console.SetOut(new PerSessionConsoleOut(Console.Out));
        Console.SetIn(new PerSessionConsoleIn(Console.In));
    }
}
