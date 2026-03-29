# CodeFest Interactive Console — Full Technical Specification

**Project:** CodeFest — Interactive Coding Challenge Platform  
**Scope:** Real-time interactive console for student code execution  
**Companion to:** `CODEFEST-SPEC.md` (§1.8 Mode 1), `CODEFEST-EDITOR-INTELLISENSE-SPEC.md`, `CODEFEST-EDITOR-DIAGNOSTICS-SPEC.md`  
**Status:** New feature specification  
**Stack:** .NET 8 (Roslyn + SignalR) ↔ Angular 17+ (Terminal UI component)

---

## 1. Problem Statement

Students currently have no way to run and interact with their programs before submitting for grading. The only execution path is "Run Tests" (Submit mode), which pipes predefined stdin, captures stdout, and compares against expected output. Students never see their own prompts, never type their own input, and never watch their program behave — they code blind until they submit.

This is especially painful for programs using `Console.ReadLine()`, where the student has no way to verify that prompts appear correctly, input is parsed properly, or the interactive flow makes sense. In a real development environment (Visual Studio, terminal, VS Code), the student would run the program, see "Enter your name:", type "Ali", and watch the output. CodeFest must provide this same experience.

### What This Spec Covers

This document specifies **Mode 1: Interactive Run** — the "[▶ Run]" button that opens a terminal panel in the student's browser. It covers the full vertical slice: backend execution engine, SignalR streaming protocol, Angular terminal component, teacher dashboard integration, security/sandboxing, and a complete testing strategy (unit, integration, E2E).

### What This Spec Does NOT Cover

- Mode 2 (Submit / test-case grading) — already specified in `CODEFEST-SPEC.md` §1.8
- Editor IntelliSense — specified in `CODEFEST-EDITOR-INTELLISENSE-SPEC.md`
- Editor Diagnostics — specified in `CODEFEST-EDITOR-DIAGNOSTICS-SPEC.md`

---

## 2. User Experience

### 2.1 Student Workflow

```
1. Student writes code in CodeMirror editor
2. Clicks [▶ Run] button in bottom bar
3. Terminal panel slides up from bottom (below editor, above test results)
4. Code compiles on server → compile errors shown in terminal if any
5. Program starts executing → stdout streams to terminal in real-time
6. When program calls Console.ReadLine(), terminal shows blinking cursor
7. Student types input, presses Enter → input sent to server → fed to stdin
8. Program continues → more output streams to terminal
9. Program ends → "Program ended (exit code 0)" message appears
10. Student reviews output, clicks [▶ Run] again to re-run, or [✓ Submit] to grade
```

### 2.2 Terminal Panel Layout

```
┌──────────────────────────────────────────────────────────┐
│ Terminal                                    [Clear] [■ Stop] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Enter your name: █                                      │
│                                                          │
│                                                          │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

After student types "Ali" and presses Enter:

```
┌──────────────────────────────────────────────────────────┐
│ Terminal                                    [Clear] [■ Stop] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Enter your name: Ali                                    │
│  Hello, Ali! Welcome to CodeFest!                        │
│                                                          │
│  --- Program ended (exit code 0) ---                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.3 Terminal Visual Styling

| Element | Color | Font |
|---------|-------|------|
| Program output (`Console.Write/WriteLine`) | `#E0E0E0` (light gray / white) | `JetBrains Mono`, `Consolas`, `monospace` |
| Student input (echoed after Enter) | `#4FC3F7` (light blue) | Same monospace |
| Input cursor / prompt indicator | `#4FC3F7` blinking | Same monospace |
| Compile errors | `#EF5350` (red) | Same monospace |
| Runtime errors / exceptions | `#FF7043` (orange-red) | Same monospace |
| "Program ended" message | `#9E9E9E` (dim gray) | Same monospace |
| Background | `#1E1E1E` (VS Code dark) | — |

### 2.4 Terminal Panel Behavior

- **Default state:** Hidden. No terminal visible until student clicks [▶ Run].
- **Open trigger:** Clicking [▶ Run] compiles + opens terminal panel simultaneously.
- **Panel size:** Occupies bottom 35% of the editor area (resizable via drag handle).
- **Persistence:** Terminal content persists across multiple runs within the same challenge. Each new run appends a separator: `────── Run #2 ──────`. Student can click [Clear] to wipe history.
- **Auto-scroll:** Terminal auto-scrolls to bottom on new output. If student scrolls up manually, auto-scroll pauses until they scroll back to bottom.
- **Copy:** Student can select and copy text from terminal output (right-click or Ctrl+C when text is selected).
- **Max buffer:** Terminal keeps last 500 lines. Older lines are trimmed from the top.
- **Mobile:** On mobile, terminal is a full-screen tab (alongside "Challenge" and "Code" tabs).

### 2.5 Button States

The bottom bar has three action buttons. Their states change based on execution state:

| State | [▶ Run] | [■ Stop] | [✓ Submit] |
|-------|---------|----------|------------|
| Idle (no run active) | Enabled, primary color | Hidden | Enabled |
| Compiling | Disabled, shows spinner | Hidden | Disabled |
| Running (program executing) | Disabled | Visible, danger color | Disabled |
| Waiting for input | Disabled | Visible, danger color | Disabled |
| Run finished | Enabled | Hidden | Enabled |
| Compile error | Enabled | Hidden | Enabled |

### 2.6 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `Cmd+Enter` | Run code (same as clicking [▶ Run]) |
| `Ctrl+Shift+Enter` | Submit code (same as clicking [✓ Submit]) |
| `Escape` (when terminal focused) | Return focus to code editor |
| `Enter` (when input field active) | Send current input to program |
| `Ctrl+C` (when no text selected, terminal focused) | Send stop signal (kill program) |

---

## 3. Architecture

### 3.1 System Overview

```
┌─────────────────────┐         ┌─────────────────────────────┐
│   Angular Client     │         │      .NET 8 API Server       │
│                      │         │                               │
│  ┌────────────────┐  │  HTTP   │  ┌───────────────────────┐   │
│  │ Code Editor     │  │◄──────►│  │  CodeFestHub (SignalR)  │   │
│  │ (CodeMirror 6)  │  │ WS     │  │                         │   │
│  └────────────────┘  │         │  │  RunCode()              │   │
│                      │         │  │  SendRunInput()          │   │
│  ┌────────────────┐  │         │  │  StopRun()              │   │
│  │ Terminal Panel   │  │◄──────►│  └──────────┬────────────┘   │
│  │ (xterm.js)      │  │ SignalR │             │                │
│  │                  │  │ events  │  ┌──────────▼────────────┐   │
│  │  Output stream  ◄──┤ RunOutput│  │ InteractiveRunService  │   │
│  │  Input field    ├──┤ RunInput │  │                         │   │
│  │  Status bar     ◄──┤ RunWait  │  │  ┌─────────────────┐   │   │
│  └────────────────┘  │         │  │  │ RunSession        │   │   │
│                      │         │  │  │  - CTS             │   │   │
│                      │         │  │  │  - StdinWriter     │   │   │
│                      │         │  │  │  - StdoutReader    │   │   │
│                      │         │  │  │  - CompledAssembly │   │   │
│                      │         │  │  └─────────────────┘   │   │
│                      │         │  │                         │   │
│                      │         │  │  Roslyn Compile         │   │
│                      │         │  │  + Sandboxed Execution   │   │
│                      │         │  └─────────────────────────┘   │
│                      │         │                               │
└─────────────────────┘         └───────────────────────────────┘
```

### 3.2 File Structure — Backend

```
CodeFest.Api/
├── Services/
│   ├── CodeExecutionService.cs          # Existing — shared compilation logic
│   ├── InteractiveRunService.cs         # NEW — manages active run sessions
│   └── PatternCheckService.cs           # Existing — pre-compilation checks
├── Models/
│   ├── RunSession.cs                    # NEW — state for one active run
│   ├── CompileResult.cs                 # NEW — compilation output model
│   └── ...existing models...
├── Hubs/
│   └── CodeFestHub.cs                   # MODIFIED — add Run/Input/Stop methods
└── DTOs/
    ├── RunStartRequest.cs               # NEW
    ├── RunOutputMessage.cs              # NEW
    └── CompileErrorDto.cs               # NEW
```

### 3.3 File Structure — Frontend

```
codefest-client/src/app/
├── features/
│   └── coding/
│       ├── coding.component.ts           # MODIFIED — orchestrate terminal panel
│       ├── terminal/
│       │   ├── terminal.component.ts     # NEW — terminal panel wrapper
│       │   ├── terminal.component.html   # NEW
│       │   ├── terminal.component.scss   # NEW
│       │   └── terminal.service.ts       # NEW — manages xterm.js + SignalR bridge
│       ├── editor/
│       │   └── code-editor.component.ts  # MODIFIED — keyboard shortcuts
│       └── ...existing components...
├── core/
│   ├── services/
│   │   ├── signalr.service.ts            # MODIFIED — add run event handlers
│   │   └── run-state.service.ts          # NEW — reactive state for run lifecycle
│   └── models/
│       ├── run-state.model.ts            # NEW — RunState enum + interfaces
│       └── ...existing models...
└── shared/
    └── ...existing shared code...
```

---

## 4. Backend Specification

### 4.1 RunSession Model

```csharp
// Models/RunSession.cs
public class RunSession : IDisposable
{
    public string SessionId { get; init; }          // Unique per run (GUID)
    public int StudentId { get; init; }
    public string ConnectionId { get; init; }        // SignalR connection to stream to
    public int ChallengeId { get; init; }
    
    public CancellationTokenSource Cts { get; } = new();
    public StreamWriter StdinWriter { get; set; }    // Write student input here
    public Task ExecutionTask { get; set; }           // The running program task
    public DateTime StartedAt { get; init; }
    public RunSessionState State { get; set; }
    
    public void Dispose()
    {
        Cts?.Cancel();
        Cts?.Dispose();
        StdinWriter?.Dispose();
    }
}

public enum RunSessionState
{
    Compiling,
    Running,
    WaitingForInput,
    Finished,
    Error,
    Cancelled
}
```

### 4.2 CompileResult Model

```csharp
// Models/CompileResult.cs
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
    public string Severity { get; set; } = "Error";  // Error, Warning
}
```

### 4.3 InteractiveRunService

This is the core service. It manages one active run per student, handles compilation, execution, stdin/stdout bridging, and cleanup.

```csharp
// Services/InteractiveRunService.cs
public class InteractiveRunService : IDisposable
{
    private readonly ConcurrentDictionary<int, RunSession> _activeSessions = new();
    private readonly IHubContext<CodeFestHub> _hubContext;
    private readonly ILogger<InteractiveRunService> _logger;
    private readonly CodeExecutionService _codeExecution;
    
    // Configuration
    private const int MaxRunTimeSeconds = 30;
    private const int MaxOutputBytes = 64 * 1024;  // 64KB max output
    private const int InputWaitDetectionMs = 100;   // Time to wait before assuming ReadLine block
    
    // ─── PUBLIC API ───────────────────────────────────────
    
    /// <summary>
    /// Start an interactive run for a student. Kills any existing run first.
    /// </summary>
    public async Task<string> StartRunAsync(
        int studentId, 
        string connectionId,
        int challengeId,
        string sourceCode,
        List<CodePatternCheck> patternChecks)
    {
        // 1. Kill existing run for this student (if any)
        await StopRunAsync(studentId);
        
        // 2. Pattern checks (pre-compilation)
        var patternResult = PatternCheckService.Check(sourceCode, patternChecks);
        if (!patternResult.Passed)
        {
            await _hubContext.Clients.Client(connectionId)
                .SendAsync("RunError", patternResult.FailureMessage);
            await _hubContext.Clients.Client(connectionId)
                .SendAsync("RunFinished", -1);
            return null;
        }
        
        // 3. Compile
        await _hubContext.Clients.Client(connectionId)
            .SendAsync("RunCompiling");
            
        var compileResult = _codeExecution.Compile(sourceCode);
        if (!compileResult.Success)
        {
            await _hubContext.Clients.Client(connectionId)
                .SendAsync("RunCompileError", compileResult.Errors);
            await _hubContext.Clients.Client(connectionId)
                .SendAsync("RunFinished", -1);
            return null;
        }
        
        // 4. Create run session
        var session = new RunSession
        {
            SessionId = Guid.NewGuid().ToString(),
            StudentId = studentId,
            ConnectionId = connectionId,
            ChallengeId = challengeId,
            StartedAt = DateTime.UtcNow,
            State = RunSessionState.Running
        };
        
        _activeSessions[studentId] = session;
        
        // 5. Start execution in background
        session.ExecutionTask = Task.Run(() => 
            ExecuteWithStreamingAsync(session, compileResult.CompiledAssembly));
        
        // 6. Notify client
        await _hubContext.Clients.Client(connectionId)
            .SendAsync("RunStarted", session.SessionId);
        
        return session.SessionId;
    }
    
    /// <summary>
    /// Feed a line of input to the student's running program.
    /// </summary>
    public async Task SendInputAsync(int studentId, string input)
    {
        if (!_activeSessions.TryGetValue(studentId, out var session))
            return;
            
        if (session.State != RunSessionState.WaitingForInput && 
            session.State != RunSessionState.Running)
            return;
        
        try
        {
            await session.StdinWriter.WriteLineAsync(input);
            await session.StdinWriter.FlushAsync();
            session.State = RunSessionState.Running;
            
            // Echo input back to client (so terminal shows what was typed)
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunInputEcho", input);
        }
        catch (ObjectDisposedException)
        {
            // Program already finished — ignore
        }
    }
    
    /// <summary>
    /// Kill the student's running program.
    /// </summary>
    public async Task StopRunAsync(int studentId)
    {
        if (_activeSessions.TryRemove(studentId, out var session))
        {
            session.State = RunSessionState.Cancelled;
            session.Cts.Cancel();
            
            // Wait briefly for clean shutdown
            try
            {
                await Task.WhenAny(
                    session.ExecutionTask ?? Task.CompletedTask,
                    Task.Delay(1000)
                );
            }
            catch { /* swallow */ }
            
            session.Dispose();
            
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunFinished", -1);
        }
    }
    
    /// <summary>
    /// Check if a student has an active run.
    /// </summary>
    public bool HasActiveRun(int studentId) 
        => _activeSessions.ContainsKey(studentId);
    
    /// <summary>
    /// Handle student disconnect — kill their run.
    /// </summary>
    public async Task OnStudentDisconnectedAsync(int studentId)
    {
        await StopRunAsync(studentId);
    }
    
    // ─── PRIVATE: EXECUTION ENGINE ────────────────────────
    
    private async Task ExecuteWithStreamingAsync(
        RunSession session, 
        Assembly compiledAssembly)
    {
        var stdinPipe = new Pipe();   // System.IO.Pipelines
        var stdinReader = new StreamReader(stdinPipe.Reader.AsStream());
        session.StdinWriter = new StreamWriter(stdinPipe.Writer.AsStream())
        {
            AutoFlush = true
        };
        
        var outputBuffer = new StringBuilder();
        var totalOutputBytes = 0;
        
        // Custom TextWriter that streams output to client via SignalR
        var signalrWriter = new SignalRTextWriter(
            text =>
            {
                totalOutputBytes += text.Length;
                if (totalOutputBytes > MaxOutputBytes)
                {
                    session.Cts.Cancel();
                    return;
                }
                
                // Fire-and-forget output to client
                _ = _hubContext.Clients.Client(session.ConnectionId)
                    .SendAsync("RunOutput", text, session.Cts.Token);
            });
        
        try
        {
            // Redirect Console streams
            var originalIn = Console.In;
            var originalOut = Console.Out;
            
            Console.SetIn(stdinReader);
            Console.SetOut(signalrWriter);
            
            try
            {
                // Set up "waiting for input" detection
                // We wrap Console.In with a notifying reader
                var notifyingReader = new NotifyingTextReader(
                    stdinReader,
                    onWaiting: () =>
                    {
                        session.State = RunSessionState.WaitingForInput;
                        _ = _hubContext.Clients.Client(session.ConnectionId)
                            .SendAsync("RunWaiting", session.Cts.Token);
                    },
                    waitDetectionMs: InputWaitDetectionMs
                );
                Console.SetIn(notifyingReader);
                
                // Find and invoke entry point
                var entryPoint = compiledAssembly.EntryPoint;
                if (entryPoint == null)
                {
                    await _hubContext.Clients.Client(session.ConnectionId)
                        .SendAsync("RunError", "No entry point found (Main method missing).");
                    return;
                }
                
                // Execute with timeout
                using var timeoutCts = CancellationTokenSource
                    .CreateLinkedTokenSource(session.Cts.Token);
                timeoutCts.CancelAfter(TimeSpan.FromSeconds(MaxRunTimeSeconds));
                
                var task = Task.Run(() =>
                {
                    var parameters = entryPoint.GetParameters();
                    var args = parameters.Length > 0 
                        ? new object[] { Array.Empty<string>() } 
                        : null;
                    entryPoint.Invoke(null, args);
                }, timeoutCts.Token);
                
                await task;
                
                session.State = RunSessionState.Finished;
                await _hubContext.Clients.Client(session.ConnectionId)
                    .SendAsync("RunFinished", 0);
            }
            finally
            {
                Console.SetIn(originalIn);
                Console.SetOut(originalOut);
            }
        }
        catch (OperationCanceledException)
        {
            if (session.State != RunSessionState.Cancelled)
            {
                // Timeout
                await _hubContext.Clients.Client(session.ConnectionId)
                    .SendAsync("RunError", 
                        $"Program timed out after {MaxRunTimeSeconds} seconds.");
                session.State = RunSessionState.Error;
            }
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunFinished", -1);
        }
        catch (TargetInvocationException ex)
        {
            // Runtime exception in student code
            var inner = ex.InnerException ?? ex;
            var message = $"{inner.GetType().Name}: {inner.Message}";
            
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunError", message);
            session.State = RunSessionState.Error;
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunFinished", 1);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in interactive run for student {StudentId}",
                session.StudentId);
                
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunError", "An unexpected error occurred.");
            session.State = RunSessionState.Error;
            await _hubContext.Clients.Client(session.ConnectionId)
                .SendAsync("RunFinished", 1);
        }
        finally
        {
            _activeSessions.TryRemove(session.StudentId, out _);
            session.Dispose();
        }
    }
}
```

### 4.4 SignalRTextWriter (Custom TextWriter)

Bridges `Console.Out` to SignalR. Buffers small writes and flushes on newline or after a short delay — so `Console.Write("Enter: ")` (no newline) still reaches the client promptly.

```csharp
// Services/SignalRTextWriter.cs
public class SignalRTextWriter : TextWriter
{
    private readonly Action<string> _onWrite;
    private readonly StringBuilder _buffer = new();
    private readonly Timer _flushTimer;
    private readonly object _lock = new();
    private const int FlushDelayMs = 50;  // Flush buffer after 50ms of silence
    
    public SignalRTextWriter(Action<string> onWrite)
    {
        _onWrite = onWrite;
        _flushTimer = new Timer(_ => FlushBuffer(), null, Timeout.Infinite, Timeout.Infinite);
    }
    
    public override Encoding Encoding => Encoding.UTF8;
    
    public override void Write(char value)
    {
        lock (_lock)
        {
            _buffer.Append(value);
            if (value == '\n')
                FlushBuffer();
            else
                _flushTimer.Change(FlushDelayMs, Timeout.Infinite);
        }
    }
    
    public override void Write(string? value)
    {
        if (value == null) return;
        lock (_lock)
        {
            _buffer.Append(value);
            if (value.Contains('\n'))
                FlushBuffer();
            else
                _flushTimer.Change(FlushDelayMs, Timeout.Infinite);
        }
    }
    
    public override void WriteLine(string? value)
    {
        lock (_lock)
        {
            _buffer.Append(value);
            _buffer.Append('\n');
            FlushBuffer();
        }
    }
    
    private void FlushBuffer()
    {
        string text;
        lock (_lock)
        {
            if (_buffer.Length == 0) return;
            text = _buffer.ToString();
            _buffer.Clear();
            _flushTimer.Change(Timeout.Infinite, Timeout.Infinite);
        }
        _onWrite(text);
    }
    
    protected override void Dispose(bool disposing)
    {
        FlushBuffer();
        _flushTimer.Dispose();
        base.Dispose(disposing);
    }
}
```

### 4.5 NotifyingTextReader (Input Wait Detection)

Wraps stdin to detect when `Console.ReadLine()` blocks, so we can notify the client to show an input prompt.

```csharp
// Services/NotifyingTextReader.cs
public class NotifyingTextReader : TextReader
{
    private readonly TextReader _inner;
    private readonly Action _onWaiting;
    private readonly int _waitDetectionMs;
    
    public NotifyingTextReader(TextReader inner, Action onWaiting, int waitDetectionMs = 100)
    {
        _inner = inner;
        _onWaiting = onWaiting;
        _waitDetectionMs = waitDetectionMs;
    }
    
    public override string? ReadLine()
    {
        // Start a timer — if ReadLine hasn't returned within _waitDetectionMs,
        // the program is blocked waiting for input
        var waitTimer = new Timer(_ => _onWaiting(), null, _waitDetectionMs, Timeout.Infinite);
        
        try
        {
            return _inner.ReadLine();
        }
        finally
        {
            waitTimer.Dispose();
        }
    }
    
    public override int Read()
    {
        var waitTimer = new Timer(_ => _onWaiting(), null, _waitDetectionMs, Timeout.Infinite);
        try { return _inner.Read(); }
        finally { waitTimer.Dispose(); }
    }
    
    // Override Read(char[], int, int) similarly for Console.Read() calls
    public override int Read(char[] buffer, int index, int count)
    {
        var waitTimer = new Timer(_ => _onWaiting(), null, _waitDetectionMs, Timeout.Infinite);
        try { return _inner.Read(buffer, index, count); }
        finally { waitTimer.Dispose(); }
    }
}
```

### 4.6 SignalR Hub Additions

Add these methods to the existing `CodeFestHub`:

```csharp
// Hubs/CodeFestHub.cs — additions to existing hub

// ─── Student → Server ───────────────────────────

/// <summary>
/// Student clicks [▶ Run]. Compiles code and starts interactive execution.
/// </summary>
public async Task RunCode(string sessionCode, int challengeId, string code)
{
    var student = await _sessionService.GetStudentByConnectionAsync(Context.ConnectionId);
    if (student == null) return;
    
    var challenge = await _challengeService.GetChallengeAsync(challengeId);
    if (challenge == null) return;
    
    // Log activity
    await _activityService.LogAsync(student.Id, student.SessionId, 
        ActivityType.InteractiveRun, new { challengeId, codeLength = code.Length });
    
    // Start the run
    await _interactiveRunService.StartRunAsync(
        student.Id,
        Context.ConnectionId,
        challengeId,
        code,
        challenge.PatternChecks
    );
    
    // Notify teacher dashboard
    await Clients.Group($"teacher-{sessionCode}")
        .SendAsync("StudentRunStarted", student.Id, challengeId);
}

/// <summary>
/// Student types input in terminal and presses Enter.
/// </summary>
public async Task SendRunInput(string sessionCode, string input)
{
    var student = await _sessionService.GetStudentByConnectionAsync(Context.ConnectionId);
    if (student == null) return;
    
    await _interactiveRunService.SendInputAsync(student.Id, input);
    
    // Log activity (optional — can be noisy)
    await _activityService.LogAsync(student.Id, student.SessionId,
        ActivityType.InteractiveRunInput, new { inputLength = input.Length });
}

/// <summary>
/// Student clicks [■ Stop] to kill their running program.
/// </summary>
public async Task StopRun(string sessionCode)
{
    var student = await _sessionService.GetStudentByConnectionAsync(Context.ConnectionId);
    if (student == null) return;
    
    await _interactiveRunService.StopRunAsync(student.Id);
    
    await Clients.Group($"teacher-{sessionCode}")
        .SendAsync("StudentRunStopped", student.Id);
}

// ─── Server → Student (events sent by InteractiveRunService) ──────
//
// "RunCompiling"               ()                   — compilation started
// "RunCompileError"            (List<CompileError>)  — compilation failed
// "RunStarted"                 (string runId)        — execution began
// "RunOutput"                  (string text)         — stdout chunk
// "RunWaiting"                 ()                    — blocked on ReadLine
// "RunInputEcho"               (string text)         — echo typed input
// "RunError"                   (string message)      — runtime exception
// "RunFinished"                (int exitCode)        — program ended
//
// ─── Server → Teacher (new events) ──────
//
// "StudentRunStarted"          (int studentId, int challengeId)
// "StudentRunStopped"          (int studentId)
// "StudentRunFinished"         (int studentId, int exitCode)
// "StudentRunError"            (int studentId, string error)


// ─── Disconnect handler update ──────

public override async Task OnDisconnectedAsync(Exception? exception)
{
    var student = await _sessionService.GetStudentByConnectionAsync(Context.ConnectionId);
    if (student != null)
    {
        // Kill any active interactive run
        await _interactiveRunService.OnStudentDisconnectedAsync(student.Id);
        
        // ...existing disconnect logic...
    }
    await base.OnDisconnectedAsync(exception);
}
```

### 4.7 ActivityType Additions

Add to the existing `ActivityType` enum:

```csharp
public enum ActivityType
{
    // ...existing values...
    
    InteractiveRun,         // Student clicked Run
    InteractiveRunInput,    // Student sent input during run
    InteractiveRunStop,     // Student clicked Stop
}
```

### 4.8 Concurrency & Thread Safety

**Critical constraint:** The server must handle 30+ students each running interactive sessions simultaneously. Key design decisions:

- **One active run per student.** If a student clicks Run while a previous run is active, the previous run is killed first (via `CancellationTokenSource`).
- **ConcurrentDictionary** for tracking active sessions. No lock contention on per-student lookups.
- **Background task execution.** Each student's program runs in its own `Task.Run()`. The main SignalR thread is never blocked.
- **Console stream isolation.** Each run creates its own `TextReader`/`TextWriter` pair. Console.In/Out are redirected per-thread. Note: if Roslyn's scripting API runs on a shared `SynchronizationContext`, we must use `AsyncLocal<TextWriter>` to prevent crosstalk between students. If direct Assembly invocation runs in isolated tasks, standard `Console.SetIn/SetOut` per task suffices (must test — see §10.2 Integration Tests).
- **Memory cap.** Output is capped at 64KB per run. Input lines are capped at 1KB each. These limits prevent a student's infinite-loop `Console.WriteLine()` from exhausting server memory.
- **Timeout.** Hard 30-second timeout per interactive run. Configurable per challenge if needed.

### 4.9 Sandbox Restrictions

Interactive runs use the same sandbox as Submit mode. Whitelisted assemblies only:

| Allowed | Blocked |
|---------|---------|
| `System` | `System.IO` (except Console) |
| `System.Linq` | `System.Net` |
| `System.Collections.Generic` | `System.Reflection` |
| `System.Text` | `System.Diagnostics` |
| `System.Console` (redirect-safe) | `System.Threading.Tasks` (no direct Task creation) |

Additionally for interactive runs:
- `Environment.Exit()` is intercepted — throws `OperationCanceledException` instead of killing the process.
- `Console.Clear()` sends a `RunClear` event to the client instead of actually clearing the server console.
- `Thread.Sleep()` and `Task.Delay()` are allowed but capped — any single sleep >5s triggers the timeout.

---

## 5. Frontend Specification

### 5.1 Dependencies

Add to `codefest-client`:

```bash
npm install xterm @xterm/addon-fit @xterm/addon-web-links
```

`xterm.js` is a real terminal emulator component used by VS Code's built-in terminal. It handles cursor positioning, ANSI colors, scrollback buffers, text selection, and copy — much better than a hand-rolled `<pre>` element.

### 5.2 RunState Service

Reactive state management for the run lifecycle. All components subscribe to this instead of wiring SignalR events directly.

```typescript
// core/services/run-state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export enum RunState {
  Idle = 'idle',
  Compiling = 'compiling',
  Running = 'running',
  WaitingForInput = 'waitingForInput',
  Finished = 'finished',
  Error = 'error'
}

export interface CompileError {
  message: string;
  line: number;
  column: number;
  severity: string;
}

export interface RunEvent {
  type: 'output' | 'inputEcho' | 'error' | 'compileError' | 'waiting' | 
        'finished' | 'started' | 'compiling' | 'clear';
  data?: string | CompileError[] | number;
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class RunStateService {
  private stateSubject = new BehaviorSubject<RunState>(RunState.Idle);
  private eventsSubject = new Subject<RunEvent>();
  private runCountSubject = new BehaviorSubject<number>(0);
  
  state$: Observable<RunState> = this.stateSubject.asObservable();
  events$: Observable<RunEvent> = this.eventsSubject.asObservable();
  runCount$: Observable<number> = this.runCountSubject.asObservable();
  
  get currentState(): RunState { return this.stateSubject.value; }
  
  // Called by SignalR service when events arrive
  handleRunCompiling(): void {
    this.stateSubject.next(RunState.Compiling);
    this.eventsSubject.next({ type: 'compiling', timestamp: new Date() });
  }
  
  handleRunStarted(runId: string): void {
    this.stateSubject.next(RunState.Running);
    this.runCountSubject.next(this.runCountSubject.value + 1);
    this.eventsSubject.next({ type: 'started', data: runId, timestamp: new Date() });
  }
  
  handleRunOutput(text: string): void {
    this.eventsSubject.next({ type: 'output', data: text, timestamp: new Date() });
  }
  
  handleRunWaiting(): void {
    this.stateSubject.next(RunState.WaitingForInput);
    this.eventsSubject.next({ type: 'waiting', timestamp: new Date() });
  }
  
  handleRunInputEcho(text: string): void {
    this.stateSubject.next(RunState.Running);
    this.eventsSubject.next({ type: 'inputEcho', data: text, timestamp: new Date() });
  }
  
  handleRunCompileError(errors: CompileError[]): void {
    this.stateSubject.next(RunState.Error);
    this.eventsSubject.next({ type: 'compileError', data: errors, timestamp: new Date() });
  }
  
  handleRunError(message: string): void {
    this.stateSubject.next(RunState.Error);
    this.eventsSubject.next({ type: 'error', data: message, timestamp: new Date() });
  }
  
  handleRunFinished(exitCode: number): void {
    this.stateSubject.next(RunState.Finished);
    this.eventsSubject.next({ type: 'finished', data: exitCode, timestamp: new Date() });
  }
  
  reset(): void {
    this.stateSubject.next(RunState.Idle);
  }
}
```

### 5.3 SignalR Service Additions

Add to the existing `signalr.service.ts`:

```typescript
// core/services/signalr.service.ts — additions

private registerRunHandlers(): void {
  this.connection.on('RunCompiling', () => 
    this.runState.handleRunCompiling());
    
  this.connection.on('RunStarted', (runId: string) => 
    this.runState.handleRunStarted(runId));
    
  this.connection.on('RunOutput', (text: string) => 
    this.runState.handleRunOutput(text));
    
  this.connection.on('RunWaiting', () => 
    this.runState.handleRunWaiting());
    
  this.connection.on('RunInputEcho', (text: string) => 
    this.runState.handleRunInputEcho(text));
    
  this.connection.on('RunCompileError', (errors: CompileError[]) => 
    this.runState.handleRunCompileError(errors));
    
  this.connection.on('RunError', (message: string) => 
    this.runState.handleRunError(message));
    
  this.connection.on('RunFinished', (exitCode: number) => 
    this.runState.handleRunFinished(exitCode));
}

// Invoke methods
async runCode(sessionCode: string, challengeId: number, code: string): Promise<void> {
  await this.connection.invoke('RunCode', sessionCode, challengeId, code);
}

async sendRunInput(sessionCode: string, input: string): Promise<void> {
  await this.connection.invoke('SendRunInput', sessionCode, input);
}

async stopRun(sessionCode: string): Promise<void> {
  await this.connection.invoke('StopRun', sessionCode);
}
```

### 5.4 Terminal Component

```typescript
// features/coding/terminal/terminal.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { RunStateService, RunState, RunEvent } from '../../../core/services/run-state.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { SessionService } from '../../../core/services/session.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-terminal',
  template: `
    <div class="terminal-container" [class.visible]="isVisible">
      <div class="terminal-header">
        <span class="terminal-title">Terminal</span>
        <div class="terminal-actions">
          <button class="btn-terminal" (click)="clear()" title="Clear">Clear</button>
          <button class="btn-terminal btn-danger" 
                  *ngIf="isRunning" 
                  (click)="stop()" 
                  title="Stop">
            ■ Stop
          </button>
        </div>
      </div>
      <div class="terminal-body" #terminalContainer></div>
    </div>
  `,
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements OnInit, OnDestroy {
  @ViewChild('terminalContainer', { static: true }) 
  terminalContainer!: ElementRef<HTMLDivElement>;
  
  private terminal!: Terminal;
  private fitAddon!: FitAddon;
  private subscriptions = new Subscription();
  private inputBuffer = '';
  private isInputMode = false;
  private runCount = 0;
  
  isVisible = false;
  isRunning = false;
  
  constructor(
    private runState: RunStateService,
    private signalr: SignalRService,
    private session: SessionService
  ) {}
  
  ngOnInit(): void {
    this.initTerminal();
    this.subscribeToEvents();
  }
  
  private initTerminal(): void {
    this.terminal = new Terminal({
      theme: {
        background: '#1E1E1E',
        foreground: '#E0E0E0',
        cursor: '#4FC3F7',
        selectionBackground: '#264F78'
      },
      fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 500,
      convertEol: true,
      disableStdin: true  // We manage input ourselves
    });
    
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    
    this.terminal.open(this.terminalContainer.nativeElement);
    this.fitAddon.fit();
    
    // Handle keyboard input when in input mode
    this.terminal.onKey(({ key, domEvent }) => {
      if (!this.isInputMode) return;
      
      if (domEvent.key === 'Enter') {
        this.submitInput();
      } else if (domEvent.key === 'Backspace') {
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.terminal.write('\b \b');  // Erase character
        }
      } else if (domEvent.key === 'c' && domEvent.ctrlKey) {
        this.stop();
      } else if (key.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
        this.inputBuffer += key;
        this.terminal.write(key);  // Echo typed character
      }
    });
    
    // Resize handling
    const resizeObserver = new ResizeObserver(() => this.fitAddon.fit());
    resizeObserver.observe(this.terminalContainer.nativeElement);
  }
  
  private subscribeToEvents(): void {
    this.subscriptions.add(
      this.runState.events$.subscribe(event => this.handleRunEvent(event))
    );
    
    this.subscriptions.add(
      this.runState.state$.subscribe(state => {
        this.isRunning = state === RunState.Running || 
                         state === RunState.WaitingForInput ||
                         state === RunState.Compiling;
      })
    );
  }
  
  private handleRunEvent(event: RunEvent): void {
    switch (event.type) {
      case 'compiling':
        this.show();
        if (this.runCount > 0) {
          this.terminal.writeln('');
          this.terminal.writeln(`\x1b[90m────── Run #${this.runCount + 1} ──────\x1b[0m`);
        }
        this.terminal.writeln('\x1b[90mCompiling...\x1b[0m');
        break;
        
      case 'started':
        this.runCount++;
        break;
        
      case 'output':
        this.terminal.write(event.data as string);
        break;
        
      case 'waiting':
        this.enableInputMode();
        break;
        
      case 'inputEcho':
        // Input was already echoed character-by-character during typing
        // Just add a newline to move to the next line
        this.terminal.writeln('');
        this.disableInputMode();
        break;
        
      case 'compileError':
        this.renderCompileErrors(event.data as CompileError[]);
        break;
        
      case 'error':
        this.terminal.writeln(`\x1b[31m${event.data}\x1b[0m`);
        this.disableInputMode();
        break;
        
      case 'finished':
        const exitCode = event.data as number;
        const color = exitCode === 0 ? '90' : '31';  // gray or red
        this.terminal.writeln('');
        this.terminal.writeln(
          `\x1b[${color}m--- Program ended (exit code ${exitCode}) ---\x1b[0m`
        );
        this.disableInputMode();
        break;
    }
  }
  
  private enableInputMode(): void {
    this.isInputMode = true;
    this.inputBuffer = '';
    this.terminal.options.cursorBlink = true;
    this.terminal.focus();
  }
  
  private disableInputMode(): void {
    this.isInputMode = false;
    this.inputBuffer = '';
  }
  
  private submitInput(): void {
    const input = this.inputBuffer;
    this.inputBuffer = '';
    this.isInputMode = false;
    
    // Send to server
    this.signalr.sendRunInput(this.session.currentSessionCode, input);
    
    // Note: the server echoes back via RunInputEcho,
    // which adds the newline. Character echo was done during typing.
  }
  
  private renderCompileErrors(errors: CompileError[]): void {
    this.terminal.writeln('\x1b[31m╔══ Compile Errors ══╗\x1b[0m');
    for (const err of errors) {
      this.terminal.writeln(
        `\x1b[31m  Line ${err.line}, Col ${err.column}: ${err.message}\x1b[0m`
      );
    }
    this.terminal.writeln('\x1b[31m╚════════════════════╝\x1b[0m');
  }
  
  show(): void {
    this.isVisible = true;
  }
  
  clear(): void {
    this.terminal.clear();
    this.runCount = 0;
  }
  
  stop(): void {
    this.signalr.stopRun(this.session.currentSessionCode);
    this.disableInputMode();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.terminal.dispose();
  }
}
```

### 5.5 Terminal Styles

```scss
// features/coding/terminal/terminal.component.scss
.terminal-container {
  display: none;
  flex-direction: column;
  border-top: 2px solid #333;
  background: #1E1E1E;
  min-height: 150px;
  max-height: 50vh;
  resize: vertical;
  overflow: hidden;
  
  &.visible {
    display: flex;
  }
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 12px;
  background: #252526;
  border-bottom: 1px solid #333;
  
  .terminal-title {
    font-size: 12px;
    font-weight: 600;
    color: #CCCCCC;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .terminal-actions {
    display: flex;
    gap: 8px;
  }
}

.btn-terminal {
  padding: 2px 10px;
  font-size: 12px;
  border: 1px solid #555;
  border-radius: 3px;
  background: transparent;
  color: #CCC;
  cursor: pointer;
  
  &:hover {
    background: #333;
  }
  
  &.btn-danger {
    border-color: #EF5350;
    color: #EF5350;
    
    &:hover {
      background: rgba(239, 83, 80, 0.15);
    }
  }
}

.terminal-body {
  flex: 1;
  padding: 4px;
  overflow: hidden;
  
  // xterm.js fills this container
  :host ::ng-deep .xterm {
    height: 100%;
  }
}
```

### 5.6 Coding Component Layout Update

The coding view (`/code`) layout changes to accommodate the terminal:

```
┌─────────────────────────────────────────────────────────────┐
│  Timer: 04:32  │  Challenge 2/5: Sum Machine  │  150 pts    │
├─────────────────────┬───────────────────────────────────────┤
│                     │                                       │
│  Challenge          │  Code Editor (CodeMirror 6)           │
│  Description        │                                       │
│  (40%)              │  (60%)                                │
│                     │                                       │
│                     ├───────────────────────────────────────┤
│                     │  Terminal Panel (35% of editor area)   │
│                     │  (hidden until first Run)              │
│                     │                                       │
├─────────────────────┴───────────────────────────────────────┤
│  [▶ Run]  [■ Stop]                           [✓ Submit]     │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Teacher Dashboard Integration

### 6.1 Teacher Sees Student Runs

The teacher dashboard already shows real-time activity. Interactive runs add these events to the activity feed:

| Event | Feed Display | Color |
|-------|-------------|-------|
| `StudentRunStarted` | "Ali started running Challenge 2" | Yellow (info) |
| `StudentRunStopped` | "Ali stopped their run" | Yellow (info) |
| `StudentRunFinished` (exit 0) | "Ali's program finished successfully" | Green |
| `StudentRunFinished` (exit ≠ 0) | "Ali's program crashed" | Red |
| `StudentRunError` | "Ali: RuntimeError — NullReferenceException" | Red |

### 6.2 Student Card Run Indicator

Each student card in the grid shows a small animated indicator when the student has an active interactive run:

- **Compiling:** Yellow spinning gear icon
- **Running:** Green pulsing dot with "Running..." label
- **Waiting for input:** Blue pulsing dot with "Awaiting input..." label
- **Error:** Red X icon (for 3 seconds, then clears)

### 6.3 Live Code Viewer Enhancement

When the teacher clicks on a student card to view their live code, a small terminal preview panel appears below the code showing the last 10 lines of the student's terminal output. This is view-only — the teacher cannot type input. This uses the same `RunOutput` events streamed to the teacher group.

---

## 7. Edge Cases & Error Handling

### 7.1 Infinite Loops

**Problem:** Student writes `while(true) Console.WriteLine("hi");`  
**Solution:** 30-second timeout + 64KB output cap. If either limit is hit, the run is killed and the student sees "Program timed out" or "Too much output — program stopped."

### 7.2 Infinite ReadLine Without Input

**Problem:** Student's program calls `Console.ReadLine()` but the student walks away.  
**Solution:** The 30-second timeout still applies to the entire run, not just execution time. If the program is waiting for input and the total run time exceeds 30 seconds, it's killed.

### 7.3 Student Disconnects Mid-Run

**Problem:** Browser tab closes, WiFi drops, or student navigates away.  
**Solution:** `OnDisconnectedAsync` fires on the hub → `InteractiveRunService.OnStudentDisconnectedAsync()` kills the run and cleans up resources. If the student reconnects, they see a fresh idle state (no attempt to resume the previous run).

### 7.4 Rapid Run-Run-Run Clicking

**Problem:** Student clicks Run 5 times in 1 second.  
**Solution:** Each `StartRunAsync` call kills the previous run first. The client also disables the Run button during Compiling/Running states (§2.5). Server-side, `ConcurrentDictionary` ensures only one session per student exists.

### 7.5 Console.ReadKey() / Console.Read()

**Problem:** `Console.ReadKey()` reads a single character without waiting for Enter.  
**Solution:** The `NotifyingTextReader` wraps `Read()` as well. On the client side, when in input mode, each keystroke could be sent individually. **However**, for simplicity in v1, we do NOT support `Console.ReadKey()` — only `Console.ReadLine()`. If a student uses `ReadKey()`, it will block until a full line is sent. This is an acceptable limitation for an intro C# course where `ReadKey()` is rarely used. Document this limitation in the terminal panel with a small info tooltip.

### 7.6 Console.Clear()

**Problem:** Student calls `Console.Clear()` — this tries to clear the server console, not the browser terminal.  
**Solution:** Intercept `Console.Clear()` calls. Replace the system Console's `Clear()` behavior in the sandboxed context by sending a `RunClear` event to the client. The client calls `terminal.clear()`. Implementation: set `Console.Out` to a custom writer that intercepts ANSI clear-screen sequences, or override `Console.Clear()` at the Roslyn compilation level by injecting a shim.

### 7.7 Session Paused During Run

**Problem:** Teacher pauses the session while a student has an active run.  
**Solution:** When session is paused, kill all active runs for all students in that session. Send `RunFinished(-1)` to each. The student sees "Session paused — run stopped." On resume, the student can click Run again.

### 7.8 Multiple Console.ReadLine() Calls

**Problem:** Program calls `ReadLine()` three times (reading n, then n numbers).  
**Solution:** Each `ReadLine()` triggers a `RunWaiting` event. The client enters input mode each time. After the student submits input and the server echoes it back, the program continues until the next `ReadLine()` or until it finishes. This is the expected flow — no special handling needed.

---

## 8. Performance Considerations

### 8.1 Memory Budget

| Resource | Per Student | 30 Students |
|----------|-----------|-------------|
| Compiled assembly (in-memory) | ~50KB | ~1.5MB |
| Stdin/Stdout streams | ~8KB | ~240KB |
| SignalR connection | ~2KB | ~60KB |
| Output buffer (max) | 64KB | ~2MB |
| **Total peak** | **~124KB** | **~3.8MB** |

Well within the server's capacity. The compiled assembly is the heaviest part, and it's short-lived (disposed when the run ends).

### 8.2 SignalR Message Rate

`Console.WriteLine()` in a tight loop can generate hundreds of messages per second. The `SignalRTextWriter` buffers and flushes on newline or after 50ms, which batches rapid writes. Additionally, the 64KB output cap stops runaway output before it saturates the WebSocket.

**Worst case:** 30 students all doing `while(true) Console.WriteLine("x")` simultaneously = 30 × ~1000 messages/sec = 30K messages/sec. The server will be under load but the 64KB cap kicks in within ~100ms per student, killing each run quickly.

### 8.3 Compilation Caching

If the student clicks Run with identical code, we could skip recompilation. **Decision: skip this optimization in v1.** Roslyn compilation for small single-file programs takes <200ms. The complexity of cache invalidation isn't worth it for the time saved.

---

## 9. Security

### 9.1 Code Sandbox (Same as Submit Mode)

All restrictions from `CODEFEST-SPEC.md` §1.8 apply:
- Whitelisted assemblies only
- No file system access (except Console I/O redirection)
- No network access
- No reflection
- No process spawning

### 9.2 Additional Interactive-Mode Risks

| Risk | Mitigation |
|------|-----------|
| Denial of service via infinite output | 64KB output cap per run |
| Denial of service via infinite loop | 30-second timeout per run |
| Memory exhaustion via large allocations | .NET `MemoryLimit` on the execution context (128MB per run) |
| Fork bomb / process spawning | `System.Diagnostics.Process` is blocked at compile time |
| stdin injection attacks | Input is plain text, fed via `StreamWriter.WriteLine()`. No shell interpretation. |
| Cross-student interference | Each run has isolated Console.In/Out streams. `ConcurrentDictionary` keyed by `studentId`. |
| SignalR flooding | Rate limit: max 10 `SendRunInput` calls per second per student. Server-side middleware. |

### 9.3 Resource Limits Summary

| Limit | Value | Configurable |
|-------|-------|-------------|
| Max run time | 30 seconds | Per challenge (`InteractiveTimeLimitSeconds`) |
| Max output size | 64 KB | Global config |
| Max input line length | 1 KB | Global config |
| Max concurrent runs (total) | 50 | Global config |
| Max memory per run | 128 MB | Global config |
| Input rate limit | 10 lines/sec | Global config |

---

## 10. Testing Strategy

### 10.1 Unit Tests — Backend

All backend unit tests use xUnit + Moq. Tests run without Docker, database, or SignalR connections.

#### 10.1.1 SignalRTextWriter Tests

```csharp
// Tests/Unit/SignalRTextWriterTests.cs

[Fact]
public void Write_WithNewline_FlushesImmediately()
{
    var captured = new List<string>();
    var writer = new SignalRTextWriter(text => captured.Add(text));
    
    writer.WriteLine("Hello, World!");
    
    Assert.Single(captured);
    Assert.Equal("Hello, World!\n", captured[0]);
}

[Fact]
public async Task Write_WithoutNewline_FlushesAfterDelay()
{
    var captured = new List<string>();
    var writer = new SignalRTextWriter(text => captured.Add(text));
    
    writer.Write("Enter name: ");
    Assert.Empty(captured);  // Not flushed yet
    
    await Task.Delay(100);   // Wait for flush timer
    
    Assert.Single(captured);
    Assert.Equal("Enter name: ", captured[0]);
}

[Fact]
public void Write_MultipleSmallWrites_BatchesBeforeNewline()
{
    var captured = new List<string>();
    var writer = new SignalRTextWriter(text => captured.Add(text));
    
    writer.Write("a");
    writer.Write("b");
    writer.Write("c");
    writer.WriteLine("");  // Just newline
    
    // Should be batched into one flush: "abc\n"
    Assert.Single(captured);
    Assert.Equal("abc\n", captured[0]);
}

[Fact]
public void Dispose_FlushesRemainingBuffer()
{
    var captured = new List<string>();
    var writer = new SignalRTextWriter(text => captured.Add(text));
    
    writer.Write("unflushed");
    writer.Dispose();
    
    Assert.Single(captured);
    Assert.Equal("unflushed", captured[0]);
}
```

#### 10.1.2 NotifyingTextReader Tests

```csharp
// Tests/Unit/NotifyingTextReaderTests.cs

[Fact]
public void ReadLine_WhenDataAvailable_ReturnsWithoutNotifying()
{
    var innerReader = new StringReader("hello\n");
    var notified = false;
    var reader = new NotifyingTextReader(innerReader, 
        onWaiting: () => notified = true, 
        waitDetectionMs: 50);
    
    var result = reader.ReadLine();
    
    Assert.Equal("hello", result);
    Assert.False(notified);  // Data was immediately available
}

[Fact]
public async Task ReadLine_WhenBlocked_NotifiesAfterDelay()
{
    // Use a pipe where nothing is written yet
    var pipe = new Pipe();
    var streamReader = new StreamReader(pipe.Reader.AsStream());
    var notified = false;
    var reader = new NotifyingTextReader(streamReader,
        onWaiting: () => notified = true,
        waitDetectionMs: 50);
    
    // Start ReadLine on background thread
    var readTask = Task.Run(() => reader.ReadLine());
    
    // Wait for notification
    await Task.Delay(100);
    Assert.True(notified);
    
    // Feed data to unblock
    var writer = new StreamWriter(pipe.Writer.AsStream()) { AutoFlush = true };
    await writer.WriteLineAsync("world");
    
    var result = await readTask;
    Assert.Equal("world", result);
}

[Fact]
public void ReadLine_ReturnsNull_WhenStreamEnds()
{
    var innerReader = new StringReader("");
    var reader = new NotifyingTextReader(innerReader, 
        onWaiting: () => { }, 
        waitDetectionMs: 50);
    
    var result = reader.ReadLine();
    
    Assert.Null(result);
}
```

#### 10.1.3 InteractiveRunService Tests

```csharp
// Tests/Unit/InteractiveRunServiceTests.cs

public class InteractiveRunServiceTests : IDisposable
{
    private readonly Mock<IHubContext<CodeFestHub>> _hubContextMock;
    private readonly Mock<ISingleClientProxy> _clientProxyMock;
    private readonly Mock<IHubClients> _hubClientsMock;
    private readonly Mock<CodeExecutionService> _codeExecMock;
    private readonly InteractiveRunService _service;
    private readonly List<(string method, object[] args)> _sentMessages = new();
    
    public InteractiveRunServiceTests()
    {
        _clientProxyMock = new Mock<ISingleClientProxy>();
        _clientProxyMock
            .Setup(x => x.SendCoreAsync(It.IsAny<string>(), It.IsAny<object[]>(), default))
            .Callback<string, object[], CancellationToken>((method, args, _) => 
                _sentMessages.Add((method, args)))
            .Returns(Task.CompletedTask);
        
        _hubClientsMock = new Mock<IHubClients>();
        _hubClientsMock.Setup(x => x.Client(It.IsAny<string>()))
            .Returns(_clientProxyMock.Object);
            
        _hubContextMock = new Mock<IHubContext<CodeFestHub>>();
        _hubContextMock.Setup(x => x.Clients).Returns(_hubClientsMock.Object);
        
        _codeExecMock = new Mock<CodeExecutionService>();
        
        _service = new InteractiveRunService(
            _hubContextMock.Object, 
            Mock.Of<ILogger<InteractiveRunService>>(),
            _codeExecMock.Object);
    }
    
    [Fact]
    public async Task StartRun_CompileError_SendsCompileErrorAndFinished()
    {
        _codeExecMock.Setup(x => x.Compile(It.IsAny<string>()))
            .Returns(new CompileResult 
            { 
                Success = false, 
                Errors = new() { new CompileError { Message = "CS1002: ; expected", Line = 3 } }
            });
        
        await _service.StartRunAsync(1, "conn-1", 1, "bad code {", new());
        
        Assert.Contains(_sentMessages, m => m.method == "RunCompileError");
        Assert.Contains(_sentMessages, m => m.method == "RunFinished");
        Assert.False(_service.HasActiveRun(1));
    }
    
    [Fact]
    public async Task StartRun_PatternCheckFails_SendsErrorImmediately()
    {
        var patterns = new List<CodePatternCheck>
        {
            new() { Type = PatternCheckType.MustContain, Pattern = "for", 
                     FailureMessage = "Must use for loop" }
        };
        
        await _service.StartRunAsync(1, "conn-1", 1, 
            "Console.WriteLine(\"hello\");", patterns);
        
        Assert.Contains(_sentMessages, m => m.method == "RunError");
        Assert.False(_service.HasActiveRun(1));
    }
    
    [Fact]
    public async Task StartRun_SimpleProgram_SendsOutputAndFinished()
    {
        _codeExecMock.Setup(x => x.Compile(It.IsAny<string>()))
            .Returns(CompileResult_ForCode("Console.WriteLine(\"hello\");"));
        
        await _service.StartRunAsync(1, "conn-1", 1, 
            "Console.WriteLine(\"hello\");", new());
        
        // Wait for execution to complete
        await Task.Delay(500);
        
        Assert.Contains(_sentMessages, m => m.method == "RunOutput");
        Assert.Contains(_sentMessages, m => m.method == "RunFinished" && 
            (int)m.args[0] == 0);
    }
    
    [Fact]
    public async Task StartRun_KillsPreviousRun()
    {
        _codeExecMock.Setup(x => x.Compile(It.IsAny<string>()))
            .Returns(CompileResult_ForCode("while(true) { }"));
        
        // Start first run (infinite loop)
        await _service.StartRunAsync(1, "conn-1", 1, "while(true) { }", new());
        Assert.True(_service.HasActiveRun(1));
        
        // Start second run — should kill first
        _codeExecMock.Setup(x => x.Compile(It.IsAny<string>()))
            .Returns(CompileResult_ForCode("Console.WriteLine(\"v2\");"));
        
        await _service.StartRunAsync(1, "conn-1", 1, 
            "Console.WriteLine(\"v2\");", new());
        
        await Task.Delay(500);
        
        // Should have a RunFinished for the killed run
        Assert.Contains(_sentMessages, m => m.method == "RunFinished" && 
            (int)m.args[0] == -1);
    }
    
    [Fact]
    public async Task StopRun_CancelsExecution()
    {
        _codeExecMock.Setup(x => x.Compile(It.IsAny<string>()))
            .Returns(CompileResult_ForCode("Thread.Sleep(10000);"));
        
        await _service.StartRunAsync(1, "conn-1", 1, "Thread.Sleep(10000);", new());
        Assert.True(_service.HasActiveRun(1));
        
        await _service.StopRunAsync(1);
        
        await Task.Delay(200);
        Assert.False(_service.HasActiveRun(1));
        Assert.Contains(_sentMessages, m => m.method == "RunFinished");
    }
    
    [Fact]
    public async Task SendInput_DeliversToRunningProgram()
    {
        _codeExecMock.Setup(x => x.Compile(It.IsAny<string>()))
            .Returns(CompileResult_ForCode(
                "var name = Console.ReadLine(); Console.WriteLine($\"Hi {name}\");"));
        
        await _service.StartRunAsync(1, "conn-1", 1,
            "var name = Console.ReadLine(); Console.WriteLine($\"Hi {name}\");", new());
        
        // Wait for RunWaiting
        await Task.Delay(300);
        Assert.Contains(_sentMessages, m => m.method == "RunWaiting");
        
        // Send input
        await _service.SendInputAsync(1, "Ali");
        
        // Wait for program to finish
        await Task.Delay(500);
        
        Assert.Contains(_sentMessages, m => m.method == "RunInputEcho");
        Assert.Contains(_sentMessages, m => m.method == "RunOutput" && 
            ((string)m.args[0]).Contains("Hi Ali"));
    }
    
    [Fact]
    public async Task SendInput_NoActiveRun_DoesNothing()
    {
        // No run started
        await _service.SendInputAsync(1, "orphan input");
        
        // No crash, no messages sent
        Assert.Empty(_sentMessages);
    }
    
    [Fact]
    public async Task HasActiveRun_ReturnsFalse_WhenNoRun()
    {
        Assert.False(_service.HasActiveRun(999));
    }
    
    [Fact]
    public async Task Timeout_KillsLongRunningProgram()
    {
        // This test requires the actual timeout to fire.
        // In production, timeout is 30s. For tests, configure to 2s.
        _codeExecMock.Setup(x => x.Compile(It.IsAny<string>()))
            .Returns(CompileResult_ForCode("Thread.Sleep(60000);"));
        
        // Use a test-configured service with 2s timeout
        var shortTimeoutService = CreateServiceWithTimeout(2);
        
        await shortTimeoutService.StartRunAsync(1, "conn-1", 1, 
            "Thread.Sleep(60000);", new());
        
        await Task.Delay(3000);
        
        Assert.Contains(_sentMessages, m => m.method == "RunError" && 
            ((string)m.args[0]).Contains("timed out"));
    }
    
    [Fact]
    public async Task RuntimeException_ReportsToClient()
    {
        _codeExecMock.Setup(x => x.Compile(It.IsAny<string>()))
            .Returns(CompileResult_ForCode(
                "int x = 0; Console.WriteLine(5 / x);"));
        
        await _service.StartRunAsync(1, "conn-1", 1,
            "int x = 0; Console.WriteLine(5 / x);", new());
        
        await Task.Delay(500);
        
        Assert.Contains(_sentMessages, m => m.method == "RunError" && 
            ((string)m.args[0]).Contains("DivideByZeroException"));
    }
    
    [Fact]
    public async Task OutputCap_KillsExcessiveOutput()
    {
        _codeExecMock.Setup(x => x.Compile(It.IsAny<string>()))
            .Returns(CompileResult_ForCode(
                "while(true) Console.WriteLine(new string('x', 1000));"));
        
        await _service.StartRunAsync(1, "conn-1", 1,
            "while(true) Console.WriteLine(new string('x', 1000));", new());
        
        await Task.Delay(2000);
        
        Assert.False(_service.HasActiveRun(1));
    }
    
    public void Dispose() => _service.Dispose();
}
```

#### 10.1.4 RunStateService Tests (Frontend)

```typescript
// core/services/run-state.service.spec.ts

describe('RunStateService', () => {
  let service: RunStateService;
  
  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RunStateService);
  });
  
  it('should start in Idle state', () => {
    expect(service.currentState).toBe(RunState.Idle);
  });
  
  it('should transition to Compiling on handleRunCompiling', () => {
    service.handleRunCompiling();
    expect(service.currentState).toBe(RunState.Compiling);
  });
  
  it('should transition to Running on handleRunStarted', () => {
    service.handleRunStarted('run-123');
    expect(service.currentState).toBe(RunState.Running);
  });
  
  it('should transition to WaitingForInput on handleRunWaiting', () => {
    service.handleRunStarted('run-123');
    service.handleRunWaiting();
    expect(service.currentState).toBe(RunState.WaitingForInput);
  });
  
  it('should return to Running on handleRunInputEcho', () => {
    service.handleRunStarted('run-123');
    service.handleRunWaiting();
    service.handleRunInputEcho('Ali');
    expect(service.currentState).toBe(RunState.Running);
  });
  
  it('should transition to Error on handleRunCompileError', () => {
    service.handleRunCompileError([
      { message: '; expected', line: 3, column: 1, severity: 'Error' }
    ]);
    expect(service.currentState).toBe(RunState.Error);
  });
  
  it('should transition to Finished on handleRunFinished', () => {
    service.handleRunStarted('run-123');
    service.handleRunFinished(0);
    expect(service.currentState).toBe(RunState.Finished);
  });
  
  it('should emit events in order', (done) => {
    const events: RunEvent[] = [];
    service.events$.subscribe(e => {
      events.push(e);
      if (events.length === 3) {
        expect(events[0].type).toBe('compiling');
        expect(events[1].type).toBe('started');
        expect(events[2].type).toBe('output');
        done();
      }
    });
    
    service.handleRunCompiling();
    service.handleRunStarted('run-1');
    service.handleRunOutput('Hello');
  });
  
  it('should increment run count on each start', () => {
    const counts: number[] = [];
    service.runCount$.subscribe(c => counts.push(c));
    
    service.handleRunStarted('run-1');
    service.handleRunStarted('run-2');
    
    expect(counts).toContain(1);
    expect(counts).toContain(2);
  });
  
  it('should reset to Idle', () => {
    service.handleRunStarted('run-1');
    service.reset();
    expect(service.currentState).toBe(RunState.Idle);
  });
});
```

#### 10.1.5 Terminal Component Tests

```typescript
// features/coding/terminal/terminal.component.spec.ts

describe('TerminalComponent', () => {
  let component: TerminalComponent;
  let fixture: ComponentFixture<TerminalComponent>;
  let runStateService: RunStateService;
  let signalrService: jasmine.SpyObj<SignalRService>;
  let sessionService: jasmine.SpyObj<SessionService>;
  
  beforeEach(async () => {
    signalrService = jasmine.createSpyObj('SignalRService', [
      'sendRunInput', 'stopRun'
    ]);
    sessionService = jasmine.createSpyObj('SessionService', [], {
      currentSessionCode: 'ABC123'
    });
    
    await TestBed.configureTestingModule({
      declarations: [TerminalComponent],
      providers: [
        RunStateService,
        { provide: SignalRService, useValue: signalrService },
        { provide: SessionService, useValue: sessionService }
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(TerminalComponent);
    component = fixture.componentInstance;
    runStateService = TestBed.inject(RunStateService);
    fixture.detectChanges();
  });
  
  it('should be hidden initially', () => {
    expect(component.isVisible).toBeFalse();
  });
  
  it('should become visible on compiling event', () => {
    runStateService.handleRunCompiling();
    expect(component.isVisible).toBeTrue();
  });
  
  it('should show Stop button when running', () => {
    runStateService.handleRunStarted('run-1');
    fixture.detectChanges();
    
    const stopBtn = fixture.nativeElement.querySelector('.btn-danger');
    expect(stopBtn).toBeTruthy();
  });
  
  it('should hide Stop button when idle', () => {
    fixture.detectChanges();
    const stopBtn = fixture.nativeElement.querySelector('.btn-danger');
    expect(stopBtn).toBeFalsy();
  });
  
  it('should call signalr.stopRun on stop()', () => {
    runStateService.handleRunStarted('run-1');
    component.stop();
    expect(signalrService.stopRun).toHaveBeenCalledWith('ABC123');
  });
  
  it('should call signalr.sendRunInput on input submit', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    
    // Simulate typing and submitting
    (component as any).inputBuffer = 'Ali';
    (component as any).submitInput();
    
    expect(signalrService.sendRunInput).toHaveBeenCalledWith('ABC123', 'Ali');
  });
  
  it('should clear terminal on clear()', () => {
    runStateService.handleRunCompiling();
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunOutput('some output');
    
    component.clear();
    
    // runCount resets
    expect((component as any).runCount).toBe(0);
  });
  
  it('should render compile errors with red formatting', () => {
    runStateService.handleRunCompileError([
      { message: '; expected', line: 3, column: 10, severity: 'Error' },
      { message: 'Unexpected token', line: 5, column: 1, severity: 'Error' }
    ]);
    
    // Verify terminal contains error text (xterm.js buffer check)
    // This is a visual regression test candidate — see E2E tests
    expect(component.isVisible).toBeTrue();
  });
});
```

### 10.2 Integration Tests — Backend

Integration tests verify the full pipeline: SignalR hub → InteractiveRunService → Roslyn execution → SignalR events back to client. These use `Microsoft.AspNetCore.SignalR.Client` to connect as a real client.

```csharp
// Tests/Integration/InteractiveRunIntegrationTests.cs

public class InteractiveRunIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    
    public InteractiveRunIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Use in-memory database for tests
                services.AddDbContext<CodeFestDbContext>(options =>
                    options.UseInMemoryDatabase("TestDb"));
            });
        });
    }
    
    private async Task<HubConnection> CreateSignalRConnection()
    {
        var server = _factory.Server;
        var connection = new HubConnectionBuilder()
            .WithUrl($"{server.BaseAddress}hubs/codefest", options =>
            {
                options.HttpMessageHandlerFactory = _ => server.CreateHandler();
            })
            .Build();
        
        await connection.StartAsync();
        return connection;
    }
    
    [Fact]
    public async Task RunCode_HelloWorld_StreamsOutputAndFinishes()
    {
        var connection = await CreateSignalRConnection();
        var events = new ConcurrentQueue<(string type, object data)>();
        
        connection.On<string>("RunOutput", text => events.Enqueue(("output", text)));
        connection.On<int>("RunFinished", code => events.Enqueue(("finished", code)));
        connection.On("RunCompiling", () => events.Enqueue(("compiling", null)));
        connection.On<string>("RunStarted", id => events.Enqueue(("started", id)));
        
        // Seed a session and join as student
        var sessionCode = await SeedSessionAndJoin(connection, "TestStudent");
        
        var code = @"
            using System;
            Console.WriteLine(""Hello from interactive run!"");
        ";
        
        await connection.InvokeAsync("RunCode", sessionCode, 1, code);
        
        // Wait for completion
        await WaitForEvent(events, "finished", timeout: TimeSpan.FromSeconds(10));
        
        Assert.Contains(events, e => e.type == "compiling");
        Assert.Contains(events, e => e.type == "started");
        Assert.Contains(events, e => e.type == "output" && 
            ((string)e.data).Contains("Hello from interactive run!"));
        Assert.Contains(events, e => e.type == "finished" && (int)e.data == 0);
    }
    
    [Fact]
    public async Task RunCode_WithReadLine_WaitsForInputThenContinues()
    {
        var connection = await CreateSignalRConnection();
        var events = new ConcurrentQueue<(string type, object data)>();
        
        connection.On<string>("RunOutput", text => events.Enqueue(("output", text)));
        connection.On("RunWaiting", () => events.Enqueue(("waiting", null)));
        connection.On<string>("RunInputEcho", text => events.Enqueue(("echo", text)));
        connection.On<int>("RunFinished", code => events.Enqueue(("finished", code)));
        
        var sessionCode = await SeedSessionAndJoin(connection, "TestStudent");
        
        var code = @"
            using System;
            Console.Write(""Enter name: "");
            var name = Console.ReadLine();
            Console.WriteLine($""Hello, {name}!"");
        ";
        
        await connection.InvokeAsync("RunCode", sessionCode, 1, code);
        
        // Wait for input prompt
        await WaitForEvent(events, "waiting", timeout: TimeSpan.FromSeconds(5));
        
        // Verify "Enter name: " was output
        Assert.Contains(events, e => e.type == "output" && 
            ((string)e.data).Contains("Enter name: "));
        
        // Send input
        await connection.InvokeAsync("SendRunInput", sessionCode, "Ali");
        
        // Wait for finish
        await WaitForEvent(events, "finished", timeout: TimeSpan.FromSeconds(5));
        
        Assert.Contains(events, e => e.type == "echo" && (string)e.data == "Ali");
        Assert.Contains(events, e => e.type == "output" && 
            ((string)e.data).Contains("Hello, Ali!"));
    }
    
    [Fact]
    public async Task RunCode_MultipleReadLines_HandlesSequentialInput()
    {
        var connection = await CreateSignalRConnection();
        var events = new ConcurrentQueue<(string type, object data)>();
        
        connection.On<string>("RunOutput", text => events.Enqueue(("output", text)));
        connection.On("RunWaiting", () => events.Enqueue(("waiting", null)));
        connection.On<int>("RunFinished", code => events.Enqueue(("finished", code)));
        
        var sessionCode = await SeedSessionAndJoin(connection, "TestStudent");
        
        var code = @"
            using System;
            Console.Write(""First: "");
            var a = Console.ReadLine();
            Console.Write(""Second: "");
            var b = Console.ReadLine();
            Console.WriteLine($""{a} + {b}"");
        ";
        
        await connection.InvokeAsync("RunCode", sessionCode, 1, code);
        
        // First input
        await WaitForEvent(events, "waiting", timeout: TimeSpan.FromSeconds(5));
        await connection.InvokeAsync("SendRunInput", sessionCode, "Hello");
        
        // Second input — wait for next "waiting" event
        // Clear previous waiting events first
        await WaitForNthEvent(events, "waiting", 2, timeout: TimeSpan.FromSeconds(5));
        await connection.InvokeAsync("SendRunInput", sessionCode, "World");
        
        await WaitForEvent(events, "finished", timeout: TimeSpan.FromSeconds(5));
        
        Assert.Contains(events, e => e.type == "output" && 
            ((string)e.data).Contains("Hello + World"));
    }
    
    [Fact]
    public async Task RunCode_CompileError_ReturnsErrors()
    {
        var connection = await CreateSignalRConnection();
        var events = new ConcurrentQueue<(string type, object data)>();
        
        connection.On<List<CompileError>>("RunCompileError", errors => 
            events.Enqueue(("compileError", errors)));
        connection.On<int>("RunFinished", code => events.Enqueue(("finished", code)));
        
        var sessionCode = await SeedSessionAndJoin(connection, "TestStudent");
        
        await connection.InvokeAsync("RunCode", sessionCode, 1, 
            "Console.WritLine(\"typo\")");  // Intentional typo
        
        await WaitForEvent(events, "compileError", timeout: TimeSpan.FromSeconds(5));
        
        var errorEvent = events.First(e => e.type == "compileError");
        var errors = (List<CompileError>)errorEvent.data;
        Assert.NotEmpty(errors);
    }
    
    [Fact]
    public async Task RunCode_RuntimeException_ReportsError()
    {
        var connection = await CreateSignalRConnection();
        var events = new ConcurrentQueue<(string type, object data)>();
        
        connection.On<string>("RunError", msg => events.Enqueue(("error", msg)));
        connection.On<int>("RunFinished", code => events.Enqueue(("finished", code)));
        
        var sessionCode = await SeedSessionAndJoin(connection, "TestStudent");
        
        await connection.InvokeAsync("RunCode", sessionCode, 1, @"
            using System;
            int[] arr = new int[3];
            Console.WriteLine(arr[10]);  // IndexOutOfRange
        ");
        
        await WaitForEvent(events, "error", timeout: TimeSpan.FromSeconds(5));
        
        Assert.Contains(events, e => e.type == "error" && 
            ((string)e.data).Contains("IndexOutOfRangeException"));
    }
    
    [Fact]
    public async Task StopRun_KillsActiveExecution()
    {
        var connection = await CreateSignalRConnection();
        var events = new ConcurrentQueue<(string type, object data)>();
        
        connection.On<int>("RunFinished", code => events.Enqueue(("finished", code)));
        connection.On<string>("RunStarted", id => events.Enqueue(("started", id)));
        
        var sessionCode = await SeedSessionAndJoin(connection, "TestStudent");
        
        // Start an infinite loop
        await connection.InvokeAsync("RunCode", sessionCode, 1, @"
            while(true) { System.Threading.Thread.Sleep(100); }
        ");
        
        await WaitForEvent(events, "started", timeout: TimeSpan.FromSeconds(5));
        
        // Stop it
        await connection.InvokeAsync("StopRun", sessionCode);
        
        await WaitForEvent(events, "finished", timeout: TimeSpan.FromSeconds(5));
        Assert.Contains(events, e => e.type == "finished" && (int)e.data == -1);
    }
    
    [Fact]
    public async Task ConcurrentRuns_TwoStudents_Isolated()
    {
        var conn1 = await CreateSignalRConnection();
        var conn2 = await CreateSignalRConnection();
        
        var events1 = new ConcurrentQueue<(string, object)>();
        var events2 = new ConcurrentQueue<(string, object)>();
        
        conn1.On<string>("RunOutput", t => events1.Enqueue(("output", t)));
        conn1.On<int>("RunFinished", c => events1.Enqueue(("finished", c)));
        conn2.On<string>("RunOutput", t => events2.Enqueue(("output", t)));
        conn2.On<int>("RunFinished", c => events2.Enqueue(("finished", c)));
        
        var sessionCode = await SeedSession();
        await JoinSession(conn1, sessionCode, "Student1");
        await JoinSession(conn2, sessionCode, "Student2");
        
        // Both run simultaneously with different output
        await Task.WhenAll(
            conn1.InvokeAsync("RunCode", sessionCode, 1,
                "Console.WriteLine(\"I am Student1\");"),
            conn2.InvokeAsync("RunCode", sessionCode, 1,
                "Console.WriteLine(\"I am Student2\");")
        );
        
        await Task.WhenAll(
            WaitForEvent(events1, "finished", TimeSpan.FromSeconds(10)),
            WaitForEvent(events2, "finished", TimeSpan.FromSeconds(10))
        );
        
        // Verify no cross-contamination
        Assert.Contains(events1, e => e.Item1 == "output" && 
            ((string)e.Item2).Contains("Student1"));
        Assert.DoesNotContain(events1, e => e.Item1 == "output" && 
            ((string)e.Item2).Contains("Student2"));
        
        Assert.Contains(events2, e => e.Item1 == "output" && 
            ((string)e.Item2).Contains("Student2"));
        Assert.DoesNotContain(events2, e => e.Item1 == "output" && 
            ((string)e.Item2).Contains("Student1"));
    }
    
    [Fact]
    public async Task NewRun_KillsPreviousRun_SameStudent()
    {
        var connection = await CreateSignalRConnection();
        var events = new ConcurrentQueue<(string, object)>();
        
        connection.On<int>("RunFinished", c => events.Enqueue(("finished", c)));
        connection.On<string>("RunOutput", t => events.Enqueue(("output", t)));
        
        var sessionCode = await SeedSessionAndJoin(connection, "TestStudent");
        
        // Start infinite loop
        await connection.InvokeAsync("RunCode", sessionCode, 1,
            "while(true) { System.Threading.Thread.Sleep(100); }");
        
        await Task.Delay(500);
        
        // Start new run — should kill the first
        await connection.InvokeAsync("RunCode", sessionCode, 1,
            "Console.WriteLine(\"second run\");");
        
        await Task.Delay(2000);
        
        // Should have at least one finished with -1 (killed) and one with 0 (success)
        var finishedEvents = events.Where(e => e.Item1 == "finished").ToList();
        Assert.True(finishedEvents.Count >= 2);
        Assert.Contains(finishedEvents, e => (int)e.Item2 == -1);
        Assert.Contains(finishedEvents, e => (int)e.Item2 == 0);
    }
    
    // Helper methods
    private async Task WaitForEvent(
        ConcurrentQueue<(string type, object data)> events, 
        string eventType, 
        TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (events.Any(e => e.type == eventType)) return;
            await Task.Delay(50);
        }
        throw new TimeoutException($"Event '{eventType}' not received within {timeout}");
    }
}
```

### 10.3 End-to-End Tests

E2E tests run against the full Docker Compose stack (API + MySQL + Angular client) using Playwright for browser automation.

```typescript
// e2e/interactive-console.spec.ts  (Playwright)

import { test, expect } from '@playwright/test';

test.describe('Interactive Console', () => {
  
  let sessionCode: string;
  
  test.beforeAll(async ({ request }) => {
    // Create a session via API
    const res = await request.post('/api/teacher/sessions', {
      data: { name: 'E2E Test Session', challengeIds: [1, 2, 3] }
    });
    const session = await res.json();
    sessionCode = session.code;
    
    // Start the session
    await request.put(`/api/teacher/sessions/${sessionCode}/status`, {
      data: { status: 'Active' }
    });
  });
  
  test.beforeEach(async ({ page }) => {
    // Join as student
    await page.goto('/join');
    await page.fill('[data-testid="session-code"]', sessionCode);
    await page.fill('[data-testid="display-name"]', 'E2E Student');
    await page.click('[data-testid="join-button"]');
    
    // Wait for coding view
    await page.waitForSelector('[data-testid="code-editor"]');
  });
  
  test('Run button opens terminal and shows output', async ({ page }) => {
    // Type code in editor
    await page.click('[data-testid="code-editor"]');
    await page.keyboard.type('Console.WriteLine("Hello E2E!");');
    
    // Click Run
    await page.click('[data-testid="run-button"]');
    
    // Terminal should appear
    await expect(page.locator('[data-testid="terminal-panel"]')).toBeVisible();
    
    // Wait for output
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Hello E2E!', { timeout: 10000 });
    
    // Wait for "Program ended"
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Program ended (exit code 0)', { timeout: 5000 });
  });
  
  test('Interactive input: student types name and sees greeting', async ({ page }) => {
    const code = [
      'using System;',
      'Console.Write("Enter name: ");',
      'var name = Console.ReadLine();',
      'Console.WriteLine($"Hello, {name}!");'
    ].join('\n');
    
    await setEditorContent(page, code);
    await page.click('[data-testid="run-button"]');
    
    // Wait for prompt
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Enter name:', { timeout: 10000 });
    
    // Terminal should be in input mode — type input
    await page.locator('[data-testid="terminal-panel"]').click();
    await page.keyboard.type('Playwright');
    await page.keyboard.press('Enter');
    
    // Wait for greeting
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Hello, Playwright!', { timeout: 5000 });
  });
  
  test('Compile error shown in terminal', async ({ page }) => {
    await setEditorContent(page, 'Console.WritLine("typo");');
    await page.click('[data-testid="run-button"]');
    
    // Should show compile error
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Compile Error', { timeout: 10000 });
  });
  
  test('Stop button kills running program', async ({ page }) => {
    await setEditorContent(page, 
      'while(true) { Console.WriteLine("loop"); System.Threading.Thread.Sleep(500); }');
    
    await page.click('[data-testid="run-button"]');
    
    // Wait for some output
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('loop', { timeout: 10000 });
    
    // Click stop
    await page.click('[data-testid="stop-button"]');
    
    // Should show "Program ended"
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Program ended', { timeout: 5000 });
    
    // Run button should be enabled again
    await expect(page.locator('[data-testid="run-button"]')).toBeEnabled();
  });
  
  test('Ctrl+Enter triggers run', async ({ page }) => {
    await setEditorContent(page, 'Console.WriteLine("shortcut!");');
    
    await page.click('[data-testid="code-editor"]');
    await page.keyboard.press('Control+Enter');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('shortcut!', { timeout: 10000 });
  });
  
  test('Multiple runs show separator and preserve history', async ({ page }) => {
    await setEditorContent(page, 'Console.WriteLine("run 1");');
    await page.click('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('run 1', { timeout: 10000 });
    
    // Change code and run again
    await setEditorContent(page, 'Console.WriteLine("run 2");');
    await page.click('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Run #2', { timeout: 10000 });
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('run 2', { timeout: 5000 });
  });
  
  test('Clear button wipes terminal history', async ({ page }) => {
    await setEditorContent(page, 'Console.WriteLine("will be cleared");');
    await page.click('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('will be cleared', { timeout: 10000 });
    
    await page.click('[data-testid="clear-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .not.toContainText('will be cleared');
  });
  
  test('Runtime exception shown in red', async ({ page }) => {
    await setEditorContent(page, 
      'int[] a = new int[1]; Console.WriteLine(a[5]);');
    
    await page.click('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('IndexOutOfRangeException', { timeout: 10000 });
  });
  
  test('Run disabled during execution, Submit disabled during run', async ({ page }) => {
    await setEditorContent(page, 
      'System.Threading.Thread.Sleep(3000); Console.WriteLine("done");');
    
    await page.click('[data-testid="run-button"]');
    
    // During execution, both Run and Submit should be disabled
    await expect(page.locator('[data-testid="run-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="submit-button"]')).toBeDisabled();
    
    // Stop button should be visible
    await expect(page.locator('[data-testid="stop-button"]')).toBeVisible();
    
    // Wait for program to finish
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('done', { timeout: 10000 });
    
    // Run and Submit should be enabled again
    await expect(page.locator('[data-testid="run-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="submit-button"]')).toBeEnabled();
  });
  
  test('Multiple ReadLine inputs work sequentially', async ({ page }) => {
    const code = [
      'using System;',
      'Console.Write("First: ");',
      'var a = Console.ReadLine();',
      'Console.Write("Second: ");',
      'var b = Console.ReadLine();',
      'Console.WriteLine($"{a} and {b}");'
    ].join('\n');
    
    await setEditorContent(page, code);
    await page.click('[data-testid="run-button"]');
    
    // First input
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('First:', { timeout: 10000 });
    
    await page.locator('[data-testid="terminal-panel"]').click();
    await page.keyboard.type('Hello');
    await page.keyboard.press('Enter');
    
    // Second input
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Second:', { timeout: 5000 });
    
    await page.keyboard.type('World');
    await page.keyboard.press('Enter');
    
    // Final output
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Hello and World', { timeout: 5000 });
  });
  
  test('Mobile: terminal appears as tab', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await setEditorContent(page, 'Console.WriteLine("mobile!");');
    await page.click('[data-testid="run-button"]');
    
    // On mobile, terminal should be a tab
    await expect(page.locator('[data-testid="terminal-tab"]')).toBeVisible();
    
    // Click terminal tab
    await page.click('[data-testid="terminal-tab"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('mobile!', { timeout: 10000 });
  });
  
  // Helper to set editor content (clears existing and types new code)
  async function setEditorContent(page, code: string) {
    await page.click('[data-testid="code-editor"]');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    
    // Use clipboard for reliability
    await page.evaluate((c) => navigator.clipboard.writeText(c), code);
    await page.keyboard.press('Control+V');
  }
});
```

### 10.4 Teacher Dashboard E2E Tests

```typescript
// e2e/teacher-interactive-console.spec.ts  (Playwright)

import { test, expect } from '@playwright/test';

test.describe('Teacher Dashboard — Interactive Run Monitoring', () => {
  
  test('Teacher sees student run activity in feed', async ({ browser }) => {
    // Create two browser contexts: teacher + student
    const teacherContext = await browser.newContext();
    const studentContext = await browser.newContext();
    
    const teacherPage = await teacherContext.newPage();
    const studentPage = await studentContext.newPage();
    
    // Teacher creates session
    await teacherPage.goto('/teacher');
    await teacherPage.click('[data-testid="create-session"]');
    const sessionCode = await teacherPage.textContent('[data-testid="session-code"]');
    await teacherPage.click('[data-testid="start-session"]');
    
    // Student joins
    await studentPage.goto('/join');
    await studentPage.fill('[data-testid="session-code"]', sessionCode!);
    await studentPage.fill('[data-testid="display-name"]', 'TestStudent');
    await studentPage.click('[data-testid="join-button"]');
    await studentPage.waitForSelector('[data-testid="code-editor"]');
    
    // Student runs code
    await studentPage.click('[data-testid="code-editor"]');
    await studentPage.keyboard.type('Console.WriteLine("teacher can see this");');
    await studentPage.click('[data-testid="run-button"]');
    
    // Teacher should see activity in feed
    await expect(teacherPage.locator('[data-testid="activity-feed"]'))
      .toContainText('TestStudent started running', { timeout: 10000 });
    
    // Wait for program to finish
    await expect(teacherPage.locator('[data-testid="activity-feed"]'))
      .toContainText('finished successfully', { timeout: 10000 });
    
    // Cleanup
    await teacherContext.close();
    await studentContext.close();
  });
  
  test('Student card shows running indicator', async ({ browser }) => {
    const teacherContext = await browser.newContext();
    const studentContext = await browser.newContext();
    
    const teacherPage = await teacherContext.newPage();
    const studentPage = await studentContext.newPage();
    
    // Setup session (abbreviated)
    const sessionCode = await setupSession(teacherPage, studentPage, 'RunIndicator');
    
    // Student starts a long-running program
    await studentPage.click('[data-testid="code-editor"]');
    await studentPage.keyboard.type(
      'System.Threading.Thread.Sleep(5000); Console.WriteLine("done");');
    await studentPage.click('[data-testid="run-button"]');
    
    // Teacher should see running indicator on student card
    await expect(teacherPage.locator('[data-testid="student-card-RunIndicator"]'))
      .toContainText('Running', { timeout: 5000 });
    
    // Wait for it to finish
    await expect(teacherPage.locator('[data-testid="student-card-RunIndicator"]'))
      .not.toContainText('Running', { timeout: 10000 });
    
    await teacherContext.close();
    await studentContext.close();
  });
});
```

### 10.5 Test Summary Matrix

| Test Category | Framework | Count | What It Verifies |
|---------------|-----------|-------|------------------|
| **Unit: SignalRTextWriter** | xUnit | 4 | Buffer flushing on newline, delay flush, batching, dispose |
| **Unit: NotifyingTextReader** | xUnit | 3 | Immediate read, blocking detection, EOF |
| **Unit: InteractiveRunService** | xUnit + Moq | 9 | Compile errors, pattern checks, output, kill previous, stop, input delivery, timeout, exceptions, output cap |
| **Unit: RunStateService** | Jasmine/Karma | 7 | State transitions, event ordering, run count, reset |
| **Unit: TerminalComponent** | Jasmine/Karma | 7 | Visibility, stop button, input submit, clear, error rendering |
| **Integration: SignalR Pipeline** | xUnit + WebApplicationFactory | 7 | Hello world, ReadLine, multiple inputs, compile error, runtime error, stop, concurrent students, new run kills previous |
| **E2E: Student Console** | Playwright | 10 | Run + output, interactive input, compile error, stop, Ctrl+Enter, multiple runs, clear, runtime error, button states, sequential ReadLine, mobile tab |
| **E2E: Teacher Dashboard** | Playwright | 2 | Activity feed, student card indicator |
| **Total** | — | **49** | — |

---

## 11. Implementation Order

### Phase A — Backend Core (Days 1–3)

1. `CompileResult` model
2. `RunSession` model
3. `SignalRTextWriter`
4. `NotifyingTextReader`
5. `InteractiveRunService` (compile + execute + streaming)
6. Unit tests for all of the above

### Phase B — SignalR Integration (Days 4–5)

7. Add `RunCode`, `SendRunInput`, `StopRun` to `CodeFestHub`
8. Add `InteractiveRun`, `InteractiveRunInput` to `ActivityType` enum
9. Wire `OnDisconnectedAsync` to kill active runs
10. Integration tests (SignalR client tests)

### Phase C — Frontend Terminal (Days 6–9)

11. Install `xterm.js` + addons
12. `RunStateService` + unit tests
13. `TerminalComponent` (xterm.js wrapper + SignalR event handling)
14. Update `coding.component.ts` layout for terminal panel
15. Update bottom bar buttons (Run / Stop / Submit state management)
16. Keyboard shortcuts (`Ctrl+Enter`, `Escape`)
17. Mobile layout (terminal as tab)
18. Unit tests for all components

### Phase D — Teacher Dashboard (Days 10–11)

19. Add activity feed events for interactive runs
20. Add running indicator to student cards
21. Add terminal preview in live code viewer

### Phase E — E2E Tests & Polish (Days 12–14)

22. Playwright E2E test suite
23. Edge case handling (infinite loops, rapid clicks, disconnect)
24. Performance testing with 30 concurrent students
25. Documentation update

---

## 12. Configuration

All configurable values in `appsettings.json`:

```json
{
  "InteractiveRun": {
    "MaxRunTimeSeconds": 30,
    "MaxOutputBytes": 65536,
    "MaxInputLineBytes": 1024,
    "MaxConcurrentRuns": 50,
    "MaxMemoryPerRunMB": 128,
    "InputRateLimitPerSecond": 10,
    "InputWaitDetectionMs": 100,
    "OutputFlushDelayMs": 50
  }
}
```

---

## 13. Open Questions

1. **Console.ReadKey() support:** Should we support single-character input in v2? Would require WebSocket per-keystroke streaming. Deferred for now.
2. **ANSI color support:** Should student programs be able to use `Console.ForegroundColor = ConsoleColor.Red`? The xterm.js terminal supports ANSI codes natively. If we pass ANSI sequences through the SignalR stream, it would work automatically. Decision: allow it — no extra work needed if the SignalRTextWriter passes raw bytes.
3. **Console.Beep():** Ignore silently, or emit a browser audio beep? Decision: ignore silently. No sound from student code.
4. **Run history logging:** Should we persist interactive run stdout/stdin to the database for teacher review after the session? Decision: defer to v2. The activity log already records that a run happened; full I/O capture can come later.
