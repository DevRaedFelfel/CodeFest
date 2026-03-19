# CodeFest — Celebrative Coding Session Platform

## Full Technical Specification & Implementation Guide

---

## Overview

CodeFest is a real-time, gamified C# coding challenge platform for classroom use. Students write and test C# code in a locked-down kiosk environment (web + Android), while the teacher monitors every action on a live dashboard. The server logs all activity, executes code in a sandboxed environment, and streams results via SignalR.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Backend API | .NET 8 Web API (full controllers) |
| Real-time | SignalR |
| Database | PostgreSQL (EF Core + Npgsql) |
| Code Execution | Roslyn Scripting API (sandboxed) |
| Student Frontend | Angular 17+ / CodeMirror 6 |
| Teacher Dashboard | Angular 17+ (same app, `/teacher` route) |
| Android Kiosk | Capacitor + Android Screen Pinning |
| Infrastructure | Docker Compose on WSL → Hetzner Linux |

### Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                  Docker Compose                      │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  .NET 8 API  │  │ PostgreSQL   │  │  Angular   │ │
│  │  + SignalR    │──│              │  │  (nginx)   │ │
│  │  + Roslyn     │  │              │  │            │ │
│  │  Port: 5050   │  │  Port: 5432  │  │ Port: 80   │ │
│  └──────┬───────┘  └──────────────┘  └─────┬─────┘ │
│         │          SignalR WebSocket         │       │
│         └───────────────┬───────────────────┘       │
└─────────────────────────┼───────────────────────────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
      ┌─────┴─────┐ ┌────┴────┐ ┌─────┴──────┐
      │ Student    │ │ Student │ │  Teacher    │
      │ Web Kiosk  │ │ Android │ │  Dashboard  │
      │ (browser)  │ │ (app)   │ │  (browser)  │
      └────────────┘ └─────────┘ └─────────────┘
```

---

## Phase 1: Backend API + Docker Infrastructure

### Goal

A fully containerized .NET 8 Web API with SignalR, MySQL, Roslyn code execution, and Docker Compose — running on WSL.

### 1.1 — WSL Prerequisites

```bash
# Ensure Docker is running in WSL
docker --version
docker compose version

# If not installed:
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and back in for group to take effect

# Verify
docker run hello-world
```

### 1.2 — Project Scaffolding

```bash
# Create project root
mkdir -p ~/codefest && cd ~/codefest

# Create .NET Web API project
dotnet new webapi -n CodeFest.Api --use-controllers
cd CodeFest.Api

# Add required NuGet packages
dotnet add package Microsoft.AspNetCore.SignalR
dotnet add package Microsoft.EntityFrameworkCore
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Microsoft.CodeAnalysis.CSharp

# Back to root
cd ~/codefest
```

### 1.3 — Project Structure

```
~/codefest/
├── docker-compose.yml
├── .env
├── CodeFest.Api/
│   ├── Dockerfile
│   ├── Program.cs
│   ├── appsettings.json
│   ├── Controllers/
│   │   ├── ChallengesController.cs      # CRUD for coding challenges
│   │   ├── SessionsController.cs        # Session management (start/end)
│   │   ├── SubmissionsController.cs      # Code submissions + test results
│   │   └── TeacherController.cs         # Dashboard data endpoints
│   ├── Hubs/
│   │   └── CodeFestHub.cs              # SignalR hub
│   ├── Services/
│   │   ├── CodeExecutionService.cs      # Roslyn sandbox
│   │   ├── ChallengeService.cs          # Challenge logic + test runner
│   │   ├── SessionService.cs            # Session state management
│   │   └── ActivityLogService.cs        # Action logging
│   ├── Models/
│   │   ├── Challenge.cs
│   │   ├── TestCase.cs
│   │   ├── Session.cs
│   │   ├── Student.cs
│   │   ├── Submission.cs
│   │   ├── ActivityLog.cs
│   │   └── Leaderboard.cs
│   ├── Data/
│   │   └── CodeFestDbContext.cs
│   └── DTOs/
│       ├── SubmissionRequest.cs
│       ├── SubmissionResult.cs
│       ├── StudentActivity.cs
│       └── LeaderboardEntry.cs
├── codefest-client/                     # Angular app (Phase 2)
└── seed-data/
    └── challenges.json                  # Pre-built C# challenges
```

### 1.4 — Docker Compose

```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .
      dockerfile: CodeFest.Api/Dockerfile
    ports:
      - "5050:8080"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ConnectionStrings__DefaultConnection=Host=postgres;Port=5432;Database=codefest;Username=postgres;Password=${POSTGRES_PASSWORD}
      - ASPNETCORE_URLS=http://+:8080
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - codefest-net

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: codefest
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d codefest"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - codefest-net

  client:
    build:
      context: ./codefest-client
      dockerfile: Dockerfile
    ports:
      - "4200:80"
    depends_on:
      - api
    networks:
      - codefest-net

volumes:
  pg-data:

networks:
  codefest-net:
    driver: bridge
```

> **Note:** If you already have a PostgreSQL image cached locally (e.g. from another project), you can replace `postgres:16-alpine` with that image to avoid downloading a new one.

```bash
# .env file
POSTGRES_PASSWORD=codefest_pass_2024
```

### 1.5 — API Dockerfile

```dockerfile
# CodeFest.Api/Dockerfile
# Uses alpine variants for smaller image size
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src
COPY CodeFest.Api/*.csproj ./CodeFest.Api/
RUN dotnet restore CodeFest.Api/CodeFest.Api.csproj
COPY CodeFest.Api/ ./CodeFest.Api/
RUN dotnet publish CodeFest.Api/CodeFest.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app
COPY --from=build /app/publish .
COPY seed-data/ ./seed-data/
EXPOSE 8080
ENTRYPOINT ["dotnet", "CodeFest.Api.dll"]
```

### 1.6 — Data Models

```csharp
// Models/Challenge.cs
public class Challenge
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;       // Markdown
    public string StarterCode { get; set; } = string.Empty;        // Pre-filled in editor (full console app)
    public int Order { get; set; }                                  // Sequence in session
    public int Points { get; set; } = 100;
    public int TimeLimitSeconds { get; set; } = 300;                // 5 min default
    public DifficultyLevel Difficulty { get; set; }
    public List<TestCase> TestCases { get; set; } = new();
    public List<CodePatternCheck> PatternChecks { get; set; } = new();
}

public enum DifficultyLevel { Easy, Medium, Hard, Boss }

// Models/TestCase.cs
// Simple stdin → stdout comparison.
// The server compiles the student's console app,
// feeds Input as stdin, captures stdout,
// and compares line-by-line against ExpectedOutput.
public class TestCase
{
    public int Id { get; set; }
    public int ChallengeId { get; set; }
    public string Input { get; set; } = string.Empty;              // Piped to stdin (one value per line)
    public string ExpectedOutput { get; set; } = string.Empty;      // Expected stdout (line-by-line match)
    public bool IsHidden { get; set; }                              // Hidden tests not shown to student
    public int Order { get; set; }
    public string? Description { get; set; }                        // e.g., "When input is 5, should print 120"
}

// Models/CodePatternCheck.cs
// Checks source code for required or forbidden patterns.
// Runs BEFORE compilation — fast fail if student didn't follow instructions.
public class CodePatternCheck
{
    public int Id { get; set; }
    public int ChallengeId { get; set; }
    public PatternCheckType Type { get; set; }
    public string Pattern { get; set; } = string.Empty;            // Plain text or regex
    public bool IsRegex { get; set; }                               // false = simple Contains() check
    public string FailureMessage { get; set; } = string.Empty;     // Shown to student on failure
}

public enum PatternCheckType
{
    MustContain,      // Code MUST contain this pattern (e.g., "for (", "class ")
    MustNotContain    // Code must NOT contain this pattern (e.g., ".Reverse()", "System.IO")
}

// Models/Session.cs
public class Session
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;           // 6-char join code (e.g., "ABC123")
    public string Name { get; set; } = string.Empty;
    public SessionStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string TeacherConnectionId { get; set; } = string.Empty;
    public List<int> ChallengeIds { get; set; } = new();       // Ordered challenges
}

public enum SessionStatus { Lobby, Active, Paused, Ended }

// Models/Student.cs
public class Student
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public int CurrentChallengeIndex { get; set; }
    public int TotalPoints { get; set; }
    public DateTime JoinedAt { get; set; }
    public bool IsConnected { get; set; }
    public StudentClientType ClientType { get; set; }
}

public enum StudentClientType { Web, Android }

// Models/Submission.cs
public class Submission
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public int ChallengeId { get; set; }
    public int SessionId { get; set; }
    public string Code { get; set; } = string.Empty;
    public int TestsPassed { get; set; }
    public int TestsTotal { get; set; }
    public bool AllPassed { get; set; }
    public int PointsAwarded { get; set; }
    public string? CompileError { get; set; }
    public string? RuntimeError { get; set; }
    public string? Output { get; set; }
    public long ExecutionTimeMs { get; set; }
    public DateTime SubmittedAt { get; set; }
}

// Models/ActivityLog.cs
public class ActivityLog
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public int SessionId { get; set; }
    public ActivityType Type { get; set; }
    public string? Data { get; set; }                          // JSON payload
    public DateTime Timestamp { get; set; }
}

public enum ActivityType
{
    Joined,
    Disconnected,
    Reconnected,
    CodeChanged,            // Periodic snapshot (every 30s)
    SubmissionAttempt,
    TestPassed,
    TestFailed,
    ChallengeCompleted,
    TabSwitched,            // SUSPICIOUS - left the app
    TabReturned,
    CopyPaste,              // SUSPICIOUS - pasted external code
    FullscreenExited,       // SUSPICIOUS - left kiosk mode
    FullscreenResumed,
    HintRequested,
    ChatMessage
}
```

### 1.7 — SignalR Hub

```csharp
// Hubs/CodeFestHub.cs
public class CodeFestHub : Hub
{
    // --- Teacher Actions ---
    // CreateSession(sessionName) → returns join code
    // StartSession(sessionCode)
    // PauseSession(sessionCode)
    // EndSession(sessionCode)
    // PushHint(sessionCode, challengeId, hint)
    // BroadcastMessage(sessionCode, message)
    // UnlockNextChallenge(sessionCode)

    // --- Student Actions ---
    // JoinSession(sessionCode, displayName, clientType)
    // SubmitCode(sessionCode, challengeId, code)
    // LogActivity(sessionCode, activityType, data)
    // RequestHint(sessionCode, challengeId)

    // --- Server → Teacher (real-time) ---
    // StudentJoined(student)
    // StudentDisconnected(studentId)
    // ActivityLogged(activityLog)         ← every action streams here
    // SubmissionResult(studentId, result)
    // LeaderboardUpdated(leaderboard)

    // --- Server → Student ---
    // SessionStarted(challenge)
    // NextChallenge(challenge)
    // TestResults(results)
    // HintReceived(hint)
    // SessionEnded(finalScores)
    // Celebration(type)                   ← confetti, sound triggers

    // --- Groups ---
    // Teacher joins group: "teacher-{sessionCode}"
    // Students join group: "session-{sessionCode}"
    // Individual: connectionId for targeted messages
}
```

### 1.8 — Code Execution Service (Console App Model)

```csharp
// Services/CodeExecutionService.cs
//
// EXECUTION FLOW:
//
// 1. PATTERN CHECKS (pre-compilation)
//    - Run all CodePatternCheck rules against source code
//    - MustContain: source.Contains(pattern) or Regex.IsMatch(source, pattern)
//    - MustNotContain: !source.Contains(pattern) or !Regex.IsMatch(source, pattern)
//    - If any fail → return immediately with failure message, skip compilation
//
// 2. COMPILE
//    - Use Roslyn to compile the student's FULL console app code
//    - Student writes complete program: using statements, Main method, everything
//    - Roslyn compiles to in-memory assembly
//    - Whitelisted references only: System, System.Linq, System.Collections.Generic, System.Text
//    - NO System.IO (except Console), System.Net, System.Reflection, System.Diagnostics
//    - If compile fails → return compile errors to student
//
// 3. RUN EACH TEST CASE
//    - For each TestCase:
//      a. Create a new StringReader from testCase.Input → set as Console.In
//      b. Create a new StringWriter → set as Console.Out
//      c. Invoke the compiled assembly's Main() with CancellationToken (5s timeout)
//      d. Capture the StringWriter output
//      e. Compare output lines to testCase.ExpectedOutput (trimmed, line-by-line)
//      f. Record pass/fail
//
// 4. RESULT
//    - Return: compile errors, test results (pass/fail per case), stdout output,
//      execution time, pattern check results
//
// EXAMPLE:
//
// Student code:
//   using System;
//   Console.Write("Hello " + Console.ReadLine());
//
// TestCase { Input: "Gaza", ExpectedOutput: "Hello Gaza" }
//
// Server does:
//   Console.In ← "Gaza"
//   Run student code
//   Console.Out → "Hello Gaza"
//   Compare "Hello Gaza" == "Hello Gaza" → PASS ✅
```

### 1.9 — Seed Challenges (Console App Style)

```json
// seed-data/challenges.json
[
  {
    "title": "Hello CodeFest!",
    "description": "Write a console app that reads a name from input and prints:\n`Hello, {name}! Welcome to CodeFest!`",
    "starterCode": "using System;\n\nConsole.Write(\"Enter your name: \");\nstring name = Console.ReadLine();\n// Print the greeting here\n",
    "order": 1,
    "points": 50,
    "timeLimitSeconds": 120,
    "difficulty": "Easy",
    "testCases": [
      {
        "input": "Ali",
        "expectedOutput": "Hello, Ali! Welcome to CodeFest!",
        "isHidden": false,
        "description": "Basic name input"
      },
      {
        "input": "Gaza Developer",
        "expectedOutput": "Hello, Gaza Developer! Welcome to CodeFest!",
        "isHidden": true,
        "description": "Name with space"
      }
    ],
    "patternChecks": []
  },
  {
    "title": "Sum Machine",
    "description": "Read an integer `n` from input, then read `n` numbers (one per line), and print their sum.\n\nExample input:\n```\n3\n10\n20\n30\n```\nExpected output: `60`",
    "starterCode": "using System;\n\nint n = int.Parse(Console.ReadLine());\n// Read n numbers and print their sum\n",
    "order": 2,
    "points": 100,
    "timeLimitSeconds": 180,
    "difficulty": "Easy",
    "testCases": [
      {
        "input": "3\n10\n20\n30",
        "expectedOutput": "60",
        "isHidden": false,
        "description": "Three positive numbers"
      },
      {
        "input": "1\n42",
        "expectedOutput": "42",
        "isHidden": false,
        "description": "Single number"
      },
      {
        "input": "4\n-5\n10\n-3\n8",
        "expectedOutput": "10",
        "isHidden": true,
        "description": "Mix of positive and negative"
      },
      {
        "input": "0",
        "expectedOutput": "0",
        "isHidden": true,
        "description": "Zero numbers"
      }
    ],
    "patternChecks": [
      {
        "type": "MustContain",
        "pattern": "for",
        "isRegex": false,
        "failureMessage": "You must use a for loop to read the numbers."
      }
    ]
  },
  {
    "title": "Reverse Engineer",
    "description": "Read a string from input and print it reversed.\n\n**Rules:** You must NOT use `.Reverse()` or `Array.Reverse()`. Build the reversed string yourself using a loop.\n\nExample input: `hello` → Output: `olleh`",
    "starterCode": "using System;\n\nstring input = Console.ReadLine();\n// Reverse it without using .Reverse() and print\n",
    "order": 3,
    "points": 150,
    "timeLimitSeconds": 300,
    "difficulty": "Medium",
    "testCases": [
      {
        "input": "hello",
        "expectedOutput": "olleh",
        "isHidden": false,
        "description": "Simple word"
      },
      {
        "input": "Gaza",
        "expectedOutput": "azaG",
        "isHidden": false,
        "description": "Mixed case"
      },
      {
        "input": "a",
        "expectedOutput": "a",
        "isHidden": true,
        "description": "Single character"
      },
      {
        "input": "12345",
        "expectedOutput": "54321",
        "isHidden": true,
        "description": "Digits"
      }
    ],
    "patternChecks": [
      {
        "type": "MustNotContain",
        "pattern": ".Reverse()",
        "isRegex": false,
        "failureMessage": "You cannot use .Reverse() — build the reversed string yourself!"
      },
      {
        "type": "MustNotContain",
        "pattern": "Array.Reverse",
        "isRegex": false,
        "failureMessage": "You cannot use Array.Reverse() — build the reversed string yourself!"
      },
      {
        "type": "MustContain",
        "pattern": "for",
        "isRegex": false,
        "failureMessage": "You must use a loop to reverse the string."
      }
    ]
  },
  {
    "title": "FizzBuzz Champion",
    "description": "Read an integer `n` from input. For each number from 1 to `n`, print:\n- `FizzBuzz` if divisible by both 3 and 5\n- `Fizz` if divisible by 3 only\n- `Buzz` if divisible by 5 only\n- The number itself otherwise\n\nEach value on its own line.",
    "starterCode": "using System;\n\nint n = int.Parse(Console.ReadLine());\n// Print FizzBuzz from 1 to n\n",
    "order": 4,
    "points": 200,
    "timeLimitSeconds": 300,
    "difficulty": "Medium",
    "testCases": [
      {
        "input": "5",
        "expectedOutput": "1\n2\nFizz\n4\nBuzz",
        "isHidden": false,
        "description": "First 5 numbers"
      },
      {
        "input": "15",
        "expectedOutput": "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
        "isHidden": true,
        "description": "Up to 15 — includes FizzBuzz"
      },
      {
        "input": "1",
        "expectedOutput": "1",
        "isHidden": true,
        "description": "Edge case: single number"
      }
    ],
    "patternChecks": [
      {
        "type": "MustContain",
        "pattern": "if",
        "isRegex": false,
        "failureMessage": "You need to use conditional statements (if/else)."
      },
      {
        "type": "MustContain",
        "pattern": "%",
        "isRegex": false,
        "failureMessage": "Hint: use the modulo operator (%) to check divisibility."
      }
    ]
  },
  {
    "title": "Star Pyramid (Boss Level)",
    "description": "Read an integer `n` from input and print a centered pyramid of stars with `n` rows.\n\nExample for `n = 4`:\n```\n   *\n  ***\n *****\n*******\n```\n\n**Rules:** You must use nested loops. Each row has `(2 * row - 1)` stars, preceded by `(n - row)` spaces. No trailing spaces.",
    "starterCode": "using System;\n\nint n = int.Parse(Console.ReadLine());\n// Print a centered star pyramid with n rows\n",
    "order": 5,
    "points": 300,
    "timeLimitSeconds": 600,
    "difficulty": "Boss",
    "testCases": [
      {
        "input": "3",
        "expectedOutput": "  *\n ***\n*****",
        "isHidden": false,
        "description": "3-row pyramid"
      },
      {
        "input": "1",
        "expectedOutput": "*",
        "isHidden": false,
        "description": "Single row"
      },
      {
        "input": "5",
        "expectedOutput": "    *\n   ***\n  *****\n *******\n*********",
        "isHidden": true,
        "description": "5-row pyramid"
      }
    ],
    "patternChecks": [
      {
        "type": "MustContain",
        "pattern": "for.*for",
        "isRegex": true,
        "failureMessage": "You must use nested loops (a for loop inside another for loop)."
      },
      {
        "type": "MustNotContain",
        "pattern": "PadLeft",
        "isRegex": false,
        "failureMessage": "Build the spacing yourself using a loop — don't use PadLeft()."
      },
      {
        "type": "MustNotContain",
        "pattern": "PadRight",
        "isRegex": false,
        "failureMessage": "Build the output yourself using loops — don't use PadRight()."
      }
    ]
  }
]
```

### 1.10 — Build & Run Commands

```bash
cd ~/codefest

# Create the .env file
cat > .env << 'EOF'
POSTGRES_PASSWORD=codefest_pass_2024
EOF

# Build and start everything
docker compose up -d --build

# Check logs
docker compose logs -f api

# Migrations are applied automatically on startup.
# To run manually from host (if dotnet-ef is installed):
cd CodeFest.Api
dotnet ef migrations add InitialCreate
dotnet ef database update
cd ..

# Seed challenges
curl -X POST http://localhost:5050/api/challenges/seed

# Verify API is running
curl http://localhost:5050/api/health

# Full restart
docker compose down && docker compose up -d --build
```

---

## Phase 2: Student Web Client (Angular + CodeMirror 6)

### Goal

A responsive Angular app with a code editor, challenge display, timer, test results, and kiosk lockdown — connecting to the backend via SignalR.

### 2.1 — Angular Project Setup

```bash
cd ~/codefest

# Create Angular app
npx @angular/cli new codefest-client \
  --routing \
  --style=scss \
  --ssr=false \
  --skip-tests

cd codefest-client

# Install dependencies
npm install @microsoft/signalr
npm install codemirror @codemirror/lang-javascript  # JS mode covers C# syntax basics
npm install @codemirror/theme-one-dark
npm install @codemirror/autocomplete @codemirror/lint
npm install canvas-confetti                          # Celebration effects
npm install howler                                   # Sound effects

# Back to root
cd ~/codefest
```

### 2.2 — Angular Project Structure

```
codefest-client/src/app/
├── app.routes.ts
├── app.component.ts
├── core/
│   ├── services/
│   │   ├── signalr.service.ts           # SignalR connection management
│   │   ├── session.service.ts           # Session state
│   │   ├── activity-tracker.service.ts  # Logs all student actions
│   │   └── kiosk.service.ts             # Fullscreen + exit detection
│   ├── guards/
│   │   ├── session.guard.ts             # Must be in session to access editor
│   │   └── teacher.guard.ts             # Teacher route protection
│   └── models/
│       ├── challenge.model.ts
│       ├── submission.model.ts
│       └── session.model.ts
├── features/
│   ├── join/
│   │   └── join.component.ts            # Enter session code + name
│   ├── coding/
│   │   ├── coding.component.ts          # Main student view
│   │   ├── editor/
│   │   │   └── code-editor.component.ts # CodeMirror 6 wrapper
│   │   ├── challenge-panel/
│   │   │   └── challenge-panel.component.ts
│   │   ├── test-results/
│   │   │   └── test-results.component.ts
│   │   ├── timer/
│   │   │   └── timer.component.ts
│   │   └── leaderboard/
│   │       └── leaderboard.component.ts
│   └── teacher/                          # Phase 3
│       └── ...
└── shared/
    ├── components/
    │   ├── celebration.component.ts      # Confetti + sound
    │   └── status-badge.component.ts
    └── pipes/
        └── time-ago.pipe.ts
```

### 2.3 — Key Component Specs

**Join Screen (`/join`)**

- Input: 6-character session code + display name
- On join: connect SignalR → enter kiosk mode → navigate to `/code`
- Responsive: works on phone screens too

**Coding View (`/code`) — the main student experience**

- Layout (desktop): left panel = challenge description (40%), right panel = code editor (60%)
- Layout (mobile): tabbed — swipe between challenge and editor
- Top bar: timer countdown, challenge title, points, progress dots (● ● ○ ○ ○)
- Bottom bar: "Run Tests" button (primary), "Submit" button (success, appears after all tests pass)
- Test results panel: slides up from bottom showing pass/fail per test case with expected vs actual output
- On all tests pass: confetti animation + sound + auto-unlock next challenge after 3s

**Activity Tracker Service**

This service runs silently and reports everything to the server:

```typescript
// Tracked events:
// - document.visibilitychange → TabSwitched / TabReturned
// - document.fullscreenchange → FullscreenExited / FullscreenResumed
// - paste event on editor → CopyPaste (with pasted text length)
// - Code snapshots every 30 seconds → CodeChanged
// - Every submission attempt → SubmissionAttempt
// - Test results → TestPassed / TestFailed
```

**Kiosk Service**

```typescript
// On session join:
// 1. Request Fullscreen API (document.documentElement.requestFullscreen())
// 2. Listen for fullscreenchange — if exited, log + show warning overlay
// 3. Listen for visibilitychange — if hidden, log + start timer
// 4. On return from tab switch: show "Welcome back" with time-away logged
// 5. Disable right-click context menu
// 6. Disable common shortcuts: Ctrl+T, Ctrl+N, Ctrl+W (best-effort)
//
// IMPORTANT: Web browsers cannot truly prevent exit.
// The kiosk is "soft" — it detects and reports, not prevents.
// True lockdown requires the Android app (Phase 4).
```

### 2.4 — Angular Client Dockerfile

```dockerfile
# codefest-client/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/codefest-client/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# codefest-client/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Angular routing — all paths to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy SignalR to API
    location /hubs/ {
        proxy_pass http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Proxy API calls
    location /api/ {
        proxy_pass http://api:8080;
        proxy_set_header Host $host;
    }
}
```

### 2.5 — Build & Run Commands

```bash
cd ~/codefest

# Build everything (API + MySQL + Client)
docker compose up -d --build

# Access the app
# Student UI:  http://localhost:4200
# API:         http://localhost:5050
# SignalR Hub: http://localhost:5050/hubs/codefest

# Watch client logs
docker compose logs -f client

# Rebuild just the client after changes
docker compose up -d --build client

# Access from other devices on same network:
# Find WSL IP:
hostname -I
# Students connect to: http://<WSL_IP>:4200
```

---

## Phase 3: Teacher Dashboard

### Goal

A real-time monitoring dashboard in the same Angular app, accessible at `/teacher`. Shows all students, their activity, code, submissions, and controls for managing the session.

### 3.1 — Dashboard Route & Components

```
features/teacher/
├── teacher.component.ts                  # Main dashboard layout
├── session-control/
│   └── session-control.component.ts      # Create/Start/Pause/End session
├── student-grid/
│   └── student-grid.component.ts         # Grid of all connected students
├── student-card/
│   └── student-card.component.ts         # Individual student status card
├── activity-feed/
│   └── activity-feed.component.ts        # Real-time scrolling log
├── live-code-viewer/
│   └── live-code-viewer.component.ts     # View student's current code
├── leaderboard-panel/
│   └── leaderboard-panel.component.ts    # Ranked scores
└── broadcast-panel/
    └── broadcast-panel.component.ts      # Send hints/messages
```

### 3.2 — Dashboard Layout Spec

```
┌─────────────────────────────────────────────────────────────┐
│  CodeFest Dashboard        Session: ABC123  [Pause] [End]   │
├───────────────────────────────────┬─────────────────────────┤
│                                   │                         │
│   Student Grid (2-4 columns)      │   Activity Feed         │
│                                   │                         │
│  ┌──────────┐ ┌──────────┐       │   09:15 Ali: submitted  │
│  │ Ali ★     │ │ Sara      │       │   09:14 Sara: tab switch│
│  │ Ch.3/5    │ │ Ch.2/5    │       │   09:14 Ali: test pass  │
│  │ 350 pts   │ │ 150 pts   │       │   09:13 Omar: joined    │
│  │ ● online  │ │ ● online  │       │   ...                   │
│  └──────────┘ └──────────┘       │                         │
│  ┌──────────┐ ┌──────────┐       │                         │
│  │ Omar      │ │ Noor ⚠   │       │                         │
│  │ Ch.1/5    │ │ Ch.2/5    │       │                         │
│  │ 50 pts    │ │ 100 pts   │       │                         │
│  │ ● online  │ │ ⚠ tabbed  │       │                         │
│  └──────────┘ └──────────┘       │                         │
│                                   │                         │
├───────────────────────────────────┴─────────────────────────┤
│  Leaderboard: 1. Ali (350) | 2. Sara (150) | 3. Noor (100) │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 — Student Card Features

Each student card in the grid shows:

- Display name + rank badge (★ for #1)
- Current challenge progress (e.g., "Challenge 3 of 5")
- Total points
- Connection status (online/offline/reconnecting)
- Warning flags: ⚠ if tab switched, 📋 if paste detected
- Click to expand: shows their live code (streamed via CodeChanged events)
- Quick actions: send hint, view submission history

### 3.4 — Activity Feed

- Real-time scrolling list of ALL ActivityLog events from ALL students
- Color coded: green = positive (test pass, challenge complete), yellow = info (joined, code change), red = suspicious (tab switch, paste, fullscreen exit)
- Filterable by student, by event type, by severity
- Click any event to jump to that student's card

### 3.5 — Session Management Flow

```
Teacher opens /teacher
    → "Create Session" button
    → Enters session name, selects challenges
    → Gets a 6-character join code (displayed large, shareable)
    → Students scan QR or type code at /join
    → Teacher sees students appearing in the grid
    → Teacher clicks "Start Session"
    → All students simultaneously receive first challenge
    → Timer starts
    → Teacher monitors in real-time
    → Teacher can: Pause (freezes all timers), Push hint, Broadcast message
    → Session ends: Teacher clicks "End" or all challenges complete
    → Final leaderboard shown to everyone with celebration
```

### 3.6 — Teacher API Endpoints

```
GET    /api/teacher/sessions                    # List teacher's sessions
POST   /api/teacher/sessions                    # Create new session
GET    /api/teacher/sessions/{code}             # Session details + students
GET    /api/teacher/sessions/{code}/activity    # Paginated activity log
GET    /api/teacher/sessions/{code}/leaderboard # Current rankings
GET    /api/teacher/students/{id}/code          # Student's latest code snapshot
GET    /api/teacher/students/{id}/submissions   # Student's submission history
POST   /api/teacher/sessions/{code}/hint        # Push hint to session
POST   /api/teacher/sessions/{code}/broadcast   # Broadcast message
PUT    /api/teacher/sessions/{code}/status       # Start/Pause/End
```

### 3.7 — Run Commands

```bash
# No extra containers needed — same Angular app, different route
# Access dashboard at:
# http://localhost:4200/teacher

# For remote access during session:
# Teacher: http://<WSL_IP>:4200/teacher
# Students: http://<WSL_IP>:4200/join
```

---

## Phase 4: Android Kiosk App (Capacitor)

### Goal

Wrap the Angular app in a native Android shell with true screen pinning — students cannot exit the app without the teacher's PIN.

### 4.1 — Capacitor Setup

```bash
cd ~/codefest/codefest-client

# Add Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init "CodeFest" "com.codefest.app" --web-dir dist/codefest-client/browser

# Add Android platform
npm install @capacitor/android
npx cap add android

# Build Angular and sync
npx ng build --configuration production
npx cap sync android
```

### 4.2 — Screen Pinning Strategy

Android provides two levels of app pinning:

**Level 1: Screen Pinning (simple, no root/provisioning needed)**

- Uses `Activity.startLockTask()` with user confirmation
- Student sees a system prompt "Pin this app?" → taps OK
- To unpin: long-press Back + Overview buttons simultaneously
- Good enough for honest students, not tamper-proof

**Level 2: Device Owner Lock Task (enterprise-grade, requires setup)**

- Set the app as Device Owner via ADB:
  ```bash
  adb shell dpm set-device-owner com.codefest.app/.AdminReceiver
  ```
- Then `startLockTask()` works WITHOUT user confirmation
- Student literally cannot exit — no buttons work
- Only the app can call `stopLockTask()` (teacher enters PIN in-app)
- This is how commercial kiosk apps work

### 4.3 — Capacitor Plugin for Lock Task

```
codefest-client/android/app/src/main/java/com/codefest/app/
├── MainActivity.java          # Override with lock task on launch
├── AdminReceiver.java         # Device admin receiver for Level 2
└── LockTaskPlugin.java        # Capacitor plugin bridge
```

**Plugin methods exposed to JS:**

```typescript
// In Angular:
import { Plugins } from '@capacitor/core';
const { LockTask } = Plugins;

// Start kiosk mode
await LockTask.startLockTask();

// Stop kiosk mode (teacher PIN required)
await LockTask.stopLockTask({ pin: '1234' });

// Check if in lock task mode
const { isLocked } = await LockTask.isInLockTaskMode();
```

### 4.4 — Build & Deploy to Devices

```bash
cd ~/codefest/codefest-client

# Build Angular
npx ng build --configuration production

# Sync with Android
npx cap sync android

# Open in Android Studio (if installed)
npx cap open android

# Or build APK directly via command line:
cd android
./gradlew assembleDebug

# APK location:
# android/app/build/outputs/apk/debug/app-debug.apk

# Install on connected device via ADB:
adb install app/build/outputs/apk/debug/app-debug.apk

# For Device Owner kiosk mode (one-time per device):
# First, factory reset the device or remove all accounts
adb shell dpm set-device-owner com.codefest.app/.AdminReceiver

# Verify:
adb shell dpm list-owners
```

### 4.5 — APK Distribution

For a classroom of students without Play Store:

```bash
# Option A: ADB install on each device (if you have USB access)
adb install app-debug.apk

# Option B: Host APK on your server for download
cp app-debug.apk ~/codefest/codefest-client/src/assets/
# Students navigate to http://<IP>:4200/assets/app-debug.apk

# Option C: Share via local WiFi (if internet is limited)
# Use Python simple server:
cd android/app/build/outputs/apk/debug/
python3 -m http.server 8888
# Students download from http://<IP>:8888/app-debug.apk
```

---

## Deployment to Hetzner (Production)

When ready to move from WSL to your Hetzner VM:

```bash
# On your local machine: push to Git
cd ~/codefest
git init && git add -A && git commit -m "CodeFest v1"
git remote add origin <your-repo-url>
git push -u origin main

# On Hetzner VM:
git clone <your-repo-url> ~/codefest
cd ~/codefest

# Update .env with production passwords
nano .env

# Build and run
docker compose up -d --build

# Verify
curl http://localhost:5050/api/health

# If using a domain (e.g., codefest.yourdomain.com):
# Add nginx reverse proxy or Caddy for HTTPS
# Caddy is simplest:
sudo apt install caddy
echo 'codefest.yourdomain.com { reverse_proxy localhost:4200 }' | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

---

## Session Day Checklist

### Before the session

- [ ] Test Docker Compose is running: `docker compose ps`
- [ ] Verify API health: `curl http://localhost:5050/api/health`
- [ ] Open teacher dashboard, create a session
- [ ] Note the session join code
- [ ] Write join URL + code on the board / project it
- [ ] If using Android kiosk: pre-install APK on all devices
- [ ] If using web kiosk: instruct students to use Chrome fullscreen
- [ ] Test from a student device — join, submit, see results

### During the session

- [ ] Monitor dashboard for red flags (tab switches, pastes)
- [ ] Push hints if students are stuck (via broadcast panel)
- [ ] Watch the leaderboard for engagement
- [ ] Pause if needed for group discussion

### After the session

- [ ] End session from dashboard — triggers final leaderboard + celebration
- [ ] Export activity logs: `GET /api/teacher/sessions/{code}/activity?format=csv`
- [ ] Review submissions: `GET /api/teacher/sessions/{code}/submissions`
- [ ] `docker compose down` to stop everything (data persists in PostgreSQL volume)

---

## Quick Reference — All CLI Commands

```bash
# === SETUP (one-time) ===
mkdir -p ~/codefest && cd ~/codefest
dotnet new webapi -n CodeFest.Api --use-controllers
cd CodeFest.Api
dotnet add package Microsoft.AspNetCore.SignalR
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Microsoft.CodeAnalysis.CSharp
cd ..
npx @angular/cli new codefest-client --routing --style=scss --ssr=false --skip-tests
cd codefest-client
npm install @microsoft/signalr codemirror @codemirror/lang-javascript @codemirror/theme-one-dark canvas-confetti howler
cd ..

# === DOCKER (daily) ===
docker compose up -d --build          # Start everything
docker compose ps                      # Check status
docker compose logs -f api             # Watch API logs
docker compose logs -f client          # Watch client logs
docker compose down                    # Stop everything
docker compose down -v                 # Stop + delete all data

# === DATABASE ===
docker compose exec api dotnet ef migrations add <Name>
docker compose exec api dotnet ef database update
docker compose exec postgres psql -U postgres -d codefest  # PostgreSQL shell

# === ANGULAR DEV (outside Docker for hot reload) ===
cd codefest-client
ng serve --host 0.0.0.0 --port 4200   # Dev server with LAN access
ng build --configuration production     # Production build

# === ANDROID ===
cd codefest-client
npx cap sync android                   # Sync web → Android
npx cap open android                   # Open Android Studio
cd android && ./gradlew assembleDebug  # Build APK
adb install app/build/outputs/apk/debug/app-debug.apk

# === DEPLOY TO HETZNER ===
git push origin main
ssh hetzner "cd ~/codefest && git pull && docker compose up -d --build"
```
