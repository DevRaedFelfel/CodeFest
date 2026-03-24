using CodeFest.Api.Services;
using FluentAssertions;

namespace CodeFest.Api.Tests.Services;

public class CodeExecutionServiceCompileTests
{
    private readonly CodeExecutionService _service = new();

    [Fact]
    public void Compile_ValidCode_ReturnsSuccessWithAssembly()
    {
        var code = """
            using System;
            Console.WriteLine("Hello");
            """;

        var result = _service.Compile(code);

        result.Success.Should().BeTrue();
        result.CompiledAssembly.Should().NotBeNull();
        result.Errors.Should().BeEmpty();
        result.CompileTimeMs.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public void Compile_InvalidCode_ReturnsErrors()
    {
        var code = """
            using System;
            Console.WritLine("typo");
            """;

        var result = _service.Compile(code);

        result.Success.Should().BeFalse();
        result.CompiledAssembly.Should().BeNull();
        result.Errors.Should().NotBeEmpty();
        result.Errors[0].Message.Should().Contain("WritLine");
    }

    [Fact]
    public void Compile_BlockedNamespace_ReturnsError()
    {
        var code = """
            using System;
            System.IO.File.ReadAllText("secret.txt");
            """;

        var result = _service.Compile(code);

        result.Success.Should().BeFalse();
        result.Errors.Should().ContainSingle();
        result.Errors[0].Message.Should().Contain("Blocked");
    }

    [Fact]
    public void Compile_ErrorsHaveLineAndColumn()
    {
        var code = """
            using System;
            int x = ;
            """;

        var result = _service.Compile(code);

        result.Success.Should().BeFalse();
        result.Errors.Should().NotBeEmpty();
        result.Errors[0].Line.Should().BeGreaterThan(0);
        result.Errors[0].Column.Should().BeGreaterThan(0);
    }

    [Fact]
    public void Compile_ValidCode_HasEntryPoint()
    {
        var code = """
            using System;
            Console.WriteLine("test");
            """;

        var result = _service.Compile(code);

        result.Success.Should().BeTrue();
        result.CompiledAssembly!.EntryPoint.Should().NotBeNull();
    }

    [Fact]
    public void Compile_EmptyCode_ReturnsErrors()
    {
        var result = _service.Compile("");

        result.Success.Should().BeFalse();
        result.Errors.Should().NotBeEmpty();
    }

    [Fact]
    public void Compile_MultipleSyntaxErrors_ReportsAll()
    {
        var code = """
            int x = ;
            int y = ;
            """;

        var result = _service.Compile(code);

        result.Success.Should().BeFalse();
        result.Errors.Count.Should().BeGreaterThanOrEqualTo(2);
    }
}
