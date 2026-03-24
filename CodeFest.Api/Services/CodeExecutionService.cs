using System.Diagnostics;
using System.Reflection;
using System.Text.RegularExpressions;
using CodeFest.Api.DTOs;
using CodeFest.Api.Models;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace CodeFest.Api.Services;

public class CodeExecutionService
{
    private static readonly string[] AllowedNamespaces =
    [
        "System",
        "System.Linq",
        "System.Collections.Generic",
        "System.Text",
        "System.Collections",
    ];

    private static readonly string[] BlockedPatterns =
    [
        "System.IO.File",
        "System.IO.Directory",
        "System.IO.Path",
        "System.Net",
        "System.Reflection",
        "System.Diagnostics.Process",
        "System.Runtime.InteropServices",
        "System.Threading.Thread",
    ];

    private static readonly MetadataReference[] References = GetMetadataReferences();

    private static MetadataReference[] GetMetadataReferences()
    {
        var assemblyPath = Path.GetDirectoryName(typeof(object).Assembly.Location)!;
        return
        [
            MetadataReference.CreateFromFile(typeof(object).Assembly.Location),
            MetadataReference.CreateFromFile(typeof(Console).Assembly.Location),
            MetadataReference.CreateFromFile(typeof(Enumerable).Assembly.Location),
            MetadataReference.CreateFromFile(Path.Combine(assemblyPath, "System.Runtime.dll")),
            MetadataReference.CreateFromFile(Path.Combine(assemblyPath, "System.Collections.dll")),
            MetadataReference.CreateFromFile(Path.Combine(assemblyPath, "System.Linq.dll")),
            MetadataReference.CreateFromFile(Path.Combine(assemblyPath, "System.Console.dll")),
        ];
    }

    public List<PatternCheckResult> RunPatternChecks(string code, List<CodePatternCheck> patternChecks)
    {
        var results = new List<PatternCheckResult>();

        foreach (var check in patternChecks)
        {
            bool matches;
            if (check.IsRegex)
            {
                matches = Regex.IsMatch(code, check.Pattern, RegexOptions.Singleline);
            }
            else
            {
                matches = code.Contains(check.Pattern, StringComparison.Ordinal);
            }

            bool passed = check.Type switch
            {
                PatternCheckType.MustContain => matches,
                PatternCheckType.MustNotContain => !matches,
                _ => true
            };

            results.Add(new PatternCheckResult
            {
                Passed = passed,
                FailureMessage = passed ? string.Empty : check.FailureMessage
            });
        }

        return results;
    }

    public CompileResult Compile(string sourceCode)
    {
        var sw = Stopwatch.StartNew();

        // Security check
        foreach (var blocked in BlockedPatterns)
        {
            if (sourceCode.Contains(blocked))
            {
                sw.Stop();
                return new CompileResult
                {
                    Success = false,
                    CompileTimeMs = sw.ElapsedMilliseconds,
                    Errors = new List<CompileError>
                    {
                        new() { Message = $"Blocked: use of '{blocked}' is not allowed.", Line = 0, Column = 0 }
                    }
                };
            }
        }

        var syntaxTree = CSharpSyntaxTree.ParseText(sourceCode);
        var compilation = CSharpCompilation.Create(
            assemblyName: "StudentRun_" + Guid.NewGuid().ToString("N"),
            syntaxTrees: [syntaxTree],
            references: References,
            options: new CSharpCompilationOptions(OutputKind.ConsoleApplication)
                .WithOptimizationLevel(OptimizationLevel.Release)
                .WithAllowUnsafe(false));

        using var ms = new MemoryStream();
        var emitResult = compilation.Emit(ms);

        if (!emitResult.Success)
        {
            sw.Stop();
            var errors = emitResult.Diagnostics
                .Where(d => d.Severity == DiagnosticSeverity.Error)
                .Select(d =>
                {
                    var lineSpan = d.Location.GetLineSpan();
                    return new CompileError
                    {
                        Message = d.GetMessage(),
                        Line = lineSpan.StartLinePosition.Line + 1,
                        Column = lineSpan.StartLinePosition.Character + 1,
                        Severity = d.Severity.ToString()
                    };
                })
                .ToList();

            return new CompileResult
            {
                Success = false,
                CompileTimeMs = sw.ElapsedMilliseconds,
                Errors = errors
            };
        }

        ms.Seek(0, SeekOrigin.Begin);
        var assembly = Assembly.Load(ms.ToArray());

        sw.Stop();
        return new CompileResult
        {
            Success = true,
            CompiledAssembly = assembly,
            CompileTimeMs = sw.ElapsedMilliseconds
        };
    }

    public SubmissionResult Execute(string code, Challenge challenge)
    {
        var result = new SubmissionResult();
        var sw = System.Diagnostics.Stopwatch.StartNew();

        // 1. Pattern checks
        result.PatternResults = RunPatternChecks(code, challenge.PatternChecks);
        if (result.PatternResults.Any(p => !p.Passed))
        {
            sw.Stop();
            result.ExecutionTimeMs = sw.ElapsedMilliseconds;
            result.TestsTotal = challenge.TestCases.Count;
            return result;
        }

        // 2. Security check — block dangerous namespaces
        foreach (var blocked in BlockedPatterns)
        {
            if (code.Contains(blocked))
            {
                result.CompileError = $"Blocked: use of '{blocked}' is not allowed.";
                sw.Stop();
                result.ExecutionTimeMs = sw.ElapsedMilliseconds;
                return result;
            }
        }

        // 3. Compile
        var syntaxTree = CSharpSyntaxTree.ParseText(code);
        var compilation = CSharpCompilation.Create(
            assemblyName: "StudentSubmission_" + Guid.NewGuid().ToString("N"),
            syntaxTrees: [syntaxTree],
            references: References,
            options: new CSharpCompilationOptions(OutputKind.ConsoleApplication)
                .WithOptimizationLevel(OptimizationLevel.Release)
                .WithAllowUnsafe(false));

        using var ms = new MemoryStream();
        var emitResult = compilation.Emit(ms);

        if (!emitResult.Success)
        {
            var errors = emitResult.Diagnostics
                .Where(d => d.Severity == DiagnosticSeverity.Error)
                .Select(d => d.GetMessage())
                .ToList();

            result.CompileError = string.Join("\n", errors);
            sw.Stop();
            result.ExecutionTimeMs = sw.ElapsedMilliseconds;
            return result;
        }

        ms.Seek(0, SeekOrigin.Begin);
        var assembly = Assembly.Load(ms.ToArray());
        var entryPoint = assembly.EntryPoint;

        if (entryPoint == null)
        {
            result.CompileError = "No entry point found. Make sure your code has a Main method or uses top-level statements.";
            sw.Stop();
            result.ExecutionTimeMs = sw.ElapsedMilliseconds;
            return result;
        }

        // 4. Run each test case
        result.TestsTotal = challenge.TestCases.Count;
        foreach (var testCase in challenge.TestCases.OrderBy(t => t.Order))
        {
            var testResult = RunTestCase(entryPoint, testCase);
            result.TestResults.Add(testResult);
            if (testResult.Passed)
                result.TestsPassed++;
        }

        result.AllPassed = result.TestsPassed == result.TestsTotal;
        if (result.AllPassed)
            result.PointsAwarded = challenge.Points;

        result.Success = true;
        sw.Stop();
        result.ExecutionTimeMs = sw.ElapsedMilliseconds;
        return result;
    }

    private TestCaseResult RunTestCase(MethodInfo entryPoint, TestCase testCase)
    {
        var tcResult = new TestCaseResult
        {
            TestCaseId = testCase.Id,
            Description = testCase.Description,
            IsHidden = testCase.IsHidden
        };

        var originalIn = Console.In;
        var originalOut = Console.Out;

        try
        {
            using var reader = new StringReader(testCase.Input);
            using var writer = new StringWriter();

            Console.SetIn(reader);
            Console.SetOut(writer);

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

            var task = Task.Run(() =>
            {
                var parameters = entryPoint.GetParameters();
                var args = parameters.Length > 0 ? new object?[] { Array.Empty<string>() } : null;
                entryPoint.Invoke(null, args);
            }, cts.Token);

            if (!task.Wait(TimeSpan.FromSeconds(5)))
            {
                tcResult.Error = "Time limit exceeded (5 seconds).";
                return tcResult;
            }

            if (task.IsFaulted && task.Exception != null)
            {
                var innerEx = task.Exception.InnerExceptions.FirstOrDefault() ?? task.Exception;
                if (innerEx is TargetInvocationException tie)
                    innerEx = tie.InnerException ?? tie;
                tcResult.Error = innerEx.Message;
                return tcResult;
            }

            var actualOutput = writer.ToString().TrimEnd();
            var expectedOutput = testCase.ExpectedOutput.TrimEnd();

            tcResult.ActualOutput = actualOutput;
            if (!testCase.IsHidden)
                tcResult.ExpectedOutput = expectedOutput;

            tcResult.Passed = string.Equals(actualOutput, expectedOutput, StringComparison.Ordinal);
        }
        catch (Exception ex)
        {
            var inner = ex is TargetInvocationException tie ? (tie.InnerException ?? tie) : ex;
            tcResult.Error = inner.Message;
        }
        finally
        {
            Console.SetIn(originalIn);
            Console.SetOut(originalOut);
        }

        return tcResult;
    }
}
