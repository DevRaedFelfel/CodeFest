# CodeFest — Authentication, Roles, Course Management & Multi-Platform Spec

**Project:** CodeFest — Interactive Coding Challenge Platform  
**Scope:** Google OAuth authentication, role-based access, course/enrollment management, session–course binding, QR/link sharing, super admin dashboard, and multi-platform updates (Web, Android, iOS, Windows Electron)  
**Companion to:** `CODEFEST-SPEC.md` (core platform), `CODEFEST-EDITOR-INTELLISENSE-SPEC.md`, `CODEFEST-EDITOR-DIAGNOSTICS-SPEC.md`  
**Status:** New feature specification — requires changes across backend, all frontends, and mobile/desktop apps

---

## 1. Summary of Changes

This specification replaces the anonymous session-join model (session code + display name) with a Google-authenticated, course-based enrollment system. It introduces three roles (Super Admin, Instructor, Student), persistent user accounts, course management, and session–course binding. It also extends the platform to iOS (Capacitor) and Windows (Electron kiosk wrapper).

### What Changes from the Existing Spec

| Area | Before (CODEFEST-SPEC.md) | After (this spec) |
|------|---------------------------|-------------------|
| Authentication | None — students type a display name | Google OAuth 2.0 for all users |
| Roles | Implicit teacher vs student by route | Explicit: Super Admin, Instructor, Student |
| Student identity | Session-scoped, ephemeral | Persistent account (Gmail, name, ID) |
| Session creation | Teacher creates standalone session | Instructor creates session tied to a course |
| Session join | Anyone with the 6-char code | Only students enrolled in the session's course |
| Challenges | Standalone, selected per session | Belong to a course; instructor creates per course |
| Platforms | Web + Android (Capacitor) | Web + Android + iOS (Capacitor) + Windows (Electron) |
| Admin | None | Super Admin dashboard for courses, students, enrollments, academic loads |

### What Does NOT Change

The following systems remain exactly as specified in `CODEFEST-SPEC.md` and companion specs:

- Code execution engine (Roslyn dual-mode: Interactive Run + Submit)
- Challenge structure (test cases, pattern checks, difficulty levels, starter code)
- SignalR hub protocol (all existing events and groups)
- Activity tracking and kiosk lockdown behavior
- Teacher dashboard layout (student grid, activity feed, leaderboard, live code viewer)
- CodeMirror 6 editor with IntelliSense and diagnostics
- Docker Compose infrastructure (API + MySQL + Angular client)
- Output matching strategy

---

## 2. Authentication — Google OAuth 2.0

### 2.1 — Overview

All users (super admin, instructors, students) authenticate via Google Sign-In. The system uses Google's ID token flow: the client obtains a Google ID token, sends it to the backend, and the backend validates it and issues a JWT session token.

No password-based accounts. No registration forms. Identity is determined entirely by the user's Google account email.

### 2.2 — Google Cloud Project Setup

```yaml
# Configuration in appsettings.yaml (or appsettings.json)
Authentication:
  Google:
    ClientId: "<GOOGLE_CLIENT_ID>"          # From Google Cloud Console
    ClientSecret: "<GOOGLE_CLIENT_SECRET>"  # From Google Cloud Console
    # Allowed redirect URIs configured in Google Console:
    #   - https://codefest.yourdomain.com/auth/callback
    #   - http://localhost:4200/auth/callback
    #   - capacitor://codefest.app/auth/callback  (mobile)
    #   - http://localhost (Electron)
```

**Google Console configuration:**
- Create OAuth 2.0 credentials (Web application type)
- Add authorized JavaScript origins for all platforms
- Add authorized redirect URIs for all platforms
- Enable the Google Identity Services API
- OAuth consent screen: internal or external depending on institution

### 2.3 — Authentication Flow

```
┌────────────────────────────────────────────────────────┐
│                   All Platforms                          │
│                                                          │
│  1. User clicks "Sign in with Google"                   │
│  2. Google Sign-In popup/redirect opens                 │
│  3. User selects their Google account                   │
│  4. Client receives Google ID Token                     │
│  5. Client sends ID Token to:                           │
│       POST /api/auth/google                             │
│  6. Backend validates token with Google                  │
│  7. Backend looks up email in Users table               │
│  8. If found → issue JWT + return user profile + role    │
│     If NOT found → return 403 "Account not registered"  │
│  9. Client stores JWT, attaches to all API/SignalR calls │
└────────────────────────────────────────────────────────┘
```

**Key rule:** Users cannot self-register. The super admin must create student and instructor records first (with their Gmail addresses). When a person signs in with Google, the backend checks if their email exists in the `Users` table. If it does not, they are rejected with a clear message: *"Your account is not registered in CodeFest. Contact your instructor."*

### 2.4 — Backend Auth Implementation

**NuGet packages to add:**

```bash
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add package Google.Apis.Auth
```

**Token validation pseudocode:**

```csharp
// POST /api/auth/google
// Body: { "idToken": "<google_id_token>" }
//
// 1. Validate the Google ID token:
//    var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new()
//    {
//        Audience = new[] { googleClientId }
//    });
//
// 2. Extract email: payload.Email
//
// 3. Look up user in DB:
//    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == payload.Email);
//    if (user == null) return Forbid("Account not registered");
//
// 4. Update profile from Google (name, picture URL) if changed
//
// 5. Generate JWT:
//    Claims: sub=user.Id, email=user.Email, role=user.Role, name=user.DisplayName
//    Expiry: 24 hours (configurable)
//
// 6. Return: { token, user: { id, email, name, role, pictureUrl } }
```

**JWT attached to all subsequent requests:**
- HTTP API: `Authorization: Bearer <jwt>`
- SignalR: Passed as query string `?access_token=<jwt>` on connection (standard SignalR auth pattern)

### 2.5 — Role-Based Authorization

```csharp
// Program.cs — configure auth + authorization policies
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* JWT validation config */ });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SuperAdmin", p => p.RequireClaim("role", "SuperAdmin"));
    options.AddPolicy("Instructor", p => p.RequireClaim("role", "Instructor", "SuperAdmin"));
    options.AddPolicy("Student", p => p.RequireClaim("role", "Student", "Instructor", "SuperAdmin"));
    options.AddPolicy("Authenticated", p => p.RequireAuthenticatedUser());
});

// Controller usage:
// [Authorize(Policy = "SuperAdmin")]    — admin-only endpoints
// [Authorize(Policy = "Instructor")]    — instructor + admin
// [Authorize(Policy = "Student")]       — any authenticated user
// [Authorize(Policy = "Authenticated")] — any authenticated user
```

### 2.6 — Client-Side Auth (All Platforms)

**Angular service (`auth.service.ts`):**

```typescript
// Dependencies:
//   npm install @abacritt/angularx-social-login
//   OR use Google Identity Services (GIS) directly via script tag
//
// Flow:
//   1. Initialize Google Sign-In with the client ID
//   2. On button click → trigger Google sign-in
//   3. On success → POST /api/auth/google with the ID token
//   4. Store JWT in memory (NOT localStorage for security)
//   5. Use an HTTP interceptor to attach Bearer token to all API requests
//   6. Use an auth guard on protected routes
//   7. On 401 response → redirect to sign-in page
//   8. On token expiry → attempt silent refresh, else redirect to sign-in
```

**Platform-specific notes:**

| Platform | Google Sign-In Method |
|----------|----------------------|
| Web (browser) | Google Identity Services (GIS) JavaScript library |
| Android (Capacitor) | `@codetrix-studio/capacitor-google-auth` plugin |
| iOS (Capacitor) | Same Capacitor plugin (uses native Google Sign-In SDK) |
| Windows (Electron) | Google OAuth via system browser redirect (loopback IP) |

---

## 3. Data Model Changes

### 3.1 — New Entities

The following entities are NEW and must be added to `CodeFestDbContext`.

```csharp
// Models/User.cs
// Central identity table — every person in the system.
public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;           // Gmail address (unique, primary identifier)
    public string DisplayName { get; set; } = string.Empty;     // From Google profile or admin-set
    public string? PictureUrl { get; set; }                     // Google profile picture URL
    public UserRole Role { get; set; }                          // SuperAdmin, Instructor, Student
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;                  // Soft-disable without deleting
}

public enum UserRole { Student, Instructor, SuperAdmin }


// Models/Course.cs
public class Course
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;            // Short code, e.g. "CS101"
    public string Name { get; set; } = string.Empty;            // "Introduction to Programming with C#"
    public string? Description { get; set; }
    public int InstructorId { get; set; }                       // FK → User (must have Role=Instructor or SuperAdmin)
    public User Instructor { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public List<Enrollment> Enrollments { get; set; } = new();
    public List<Challenge> Challenges { get; set; } = new();    // Challenges now belong to a course
    public List<Session> Sessions { get; set; } = new();
}


// Models/Enrollment.cs
// Maps students to courses. A student can be enrolled in multiple courses.
public class Enrollment
{
    public int Id { get; set; }
    public int StudentId { get; set; }                          // FK → User (must have Role=Student)
    public User Student { get; set; } = null!;
    public int CourseId { get; set; }                           // FK → Course
    public Course Course { get; set; } = null!;
    public EnrollmentStatus Status { get; set; }
    public DateTime EnrolledAt { get; set; }

    // Unique constraint: (StudentId, CourseId)
}

public enum EnrollmentStatus
{
    Active,             // Student can join sessions
    Pending,            // Student requested enrollment, awaiting approval
    Dropped,            // Student was removed from the course
    Rejected            // Enrollment request was rejected
}


// Models/AcademicLoad.cs
// Maps an instructor to their assigned courses for a term/period.
// In the current model, each course already has an InstructorId,
// so AcademicLoad serves as an explicit assignment record that
// the super admin manages and can include metadata like term/year.
public class AcademicLoad
{
    public int Id { get; set; }
    public int InstructorId { get; set; }                       // FK → User (Role=Instructor or SuperAdmin)
    public User Instructor { get; set; } = null!;
    public int CourseId { get; set; }                           // FK → Course
    public Course Course { get; set; } = null!;
    public string? Term { get; set; }                           // e.g. "Fall 2025", "Spring 2026"
    public bool IsActive { get; set; } = true;
    public DateTime AssignedAt { get; set; }

    // Unique constraint: (InstructorId, CourseId)
    // Must be consistent with Course.InstructorId
}
```

### 3.2 — Modified Existing Entities

```csharp
// Models/Session.cs — MODIFIED
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

    // --- NEW FIELDS ---
    public int CourseId { get; set; }                           // FK → Course (session belongs to a course)
    public Course Course { get; set; } = null!;
    public int CreatedByUserId { get; set; }                    // FK → User (the instructor who created it)
    public User CreatedBy { get; set; } = null!;
    public string? ShareableLink { get; set; }                  // Full URL for link sharing
    public string? QrCodeData { get; set; }                     // Base64-encoded QR code image or URL data

    // ChallengeIds remains — but challenges are now scoped to the course
    public List<int> ChallengeIds { get; set; } = new();        // Selected from Course.Challenges
}


// Models/SessionParticipant.cs — REPLACES the old session-scoped Student model
// The old "Student" model was ephemeral (created on join, tied to one session).
// Now, User is the persistent identity. SessionParticipant links a User to a Session.
public class SessionParticipant
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public Session Session { get; set; } = null!;
    public int UserId { get; set; }                             // FK → User (the student)
    public User User { get; set; } = null!;
    public string ConnectionId { get; set; } = string.Empty;
    public int CurrentChallengeIndex { get; set; }
    public int TotalPoints { get; set; }
    public DateTime JoinedAt { get; set; }
    public bool IsConnected { get; set; }
    public StudentClientType ClientType { get; set; }
}

// StudentClientType EXTENDED:
public enum StudentClientType { Web, Android, iOS, WindowsElectron }


// Models/Challenge.cs — MODIFIED
// Challenges now belong to a course instead of being standalone.
public class Challenge
{
    // ... all existing fields remain ...
    
    // --- NEW FIELD ---
    public int CourseId { get; set; }                           // FK → Course
    public Course Course { get; set; } = null!;
    
    // All other fields (Title, Description, StarterCode, TestCases, etc.)
    // remain exactly as in CODEFEST-SPEC.md
}


// Models/Submission.cs — MODIFIED
public class Submission
{
    // ... all existing fields remain ...

    // StudentId is RENAMED to UserId (references User, not old Student)
    public int UserId { get; set; }                             // FK → User
    // SessionId, ChallengeId, Code, TestsPassed, etc. — unchanged
}


// Models/ActivityLog.cs — MODIFIED
public class ActivityLog
{
    // StudentId is RENAMED to UserId (references User, not old Student)
    public int UserId { get; set; }                             // FK → User
    // SessionId, Type, Data, Timestamp — unchanged
}


// Models/EnrollmentRequest.cs — NEW
// Created when a non-enrolled student tries to join a session and requests enrollment.
public class EnrollmentRequest
{
    public int Id { get; set; }
    public int StudentUserId { get; set; }                      // FK → User
    public User Student { get; set; } = null!;
    public int CourseId { get; set; }                           // FK → Course
    public Course Course { get; set; } = null!;
    public EnrollmentRequestStatus Status { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public int? ReviewedByUserId { get; set; }                  // FK → User (instructor or admin who reviewed)
}

public enum EnrollmentRequestStatus { Pending, Approved, Rejected }
```

### 3.3 — Database Migration Notes

```
Migration: AddAuthAndCourses
  - Create Users table
  - Create Courses table
  - Create Enrollments table (unique index on StudentId+CourseId)
  - Create AcademicLoads table (unique index on InstructorId+CourseId)
  - Create EnrollmentRequests table
  - Add CourseId, CreatedByUserId, ShareableLink, QrCodeData to Sessions
  - Add CourseId to Challenges
  - Rename Students table → SessionParticipants
  - Rename StudentId → UserId in Submissions, ActivityLogs, SessionParticipants
  - Seed the super admin User record (email from config)
  
  WARNING: This is a breaking migration. Existing data (sessions, students,
  submissions) will need a data migration script to map old Student records
  to new User + SessionParticipant records. Plan accordingly.
```

---

## 4. Super Admin Configuration & Seeding

### 4.1 — Super Admin Account

The super admin account email is defined in configuration and auto-seeded on first startup.

```yaml
# appsettings.yaml
CodeFest:
  SuperAdmin:
    Email: "raed.felfel.instructor@gmail.com"    # This account gets SuperAdmin role
    DisplayName: "Raed Felfel"                    # Default name, updated on first Google login
```

On application startup, the backend checks if a User with this email and `Role=SuperAdmin` exists. If not, it creates one. This is the only user that is auto-created — all other users must be created through the admin UI or file upload.

### 4.2 — Super Admin Capabilities

The super admin can:

1. **Manage courses** — Create, edit, deactivate courses (name, code, description, instructor assignment)
2. **Manage users** — Create, edit, deactivate instructor and student accounts
3. **Manage enrollments** — Enroll/drop students in courses, approve/reject enrollment requests
4. **Manage academic loads** — Assign instructors to courses (with optional term/year)
5. **Manage challenges** — Create/edit challenges for any course
6. **Create sessions** — For any course (super admin can act as instructor for any course)
7. **View all data** — All sessions, all courses, all users, all activity logs
8. **Upload data files** — Bulk import courses, students, enrollments from CSV/JSON files

### 4.3 — Instructor Capabilities

An instructor can:

1. **Manage challenges** — Create, edit, delete challenges for their own courses only
2. **Create sessions** — For their own courses only
3. **Monitor sessions** — Full teacher dashboard for their sessions
4. **Manage enrollment** — Enroll/drop students in their own courses, approve/reject enrollment requests for their courses
5. **View session history** — See all past sessions for their courses
6. **View student performance** — Submissions, scores, activity for students in their courses

### 4.4 — Student Capabilities

A student can:

1. **View enrolled courses** — See courses they are enrolled in
2. **Join sessions** — For courses they are enrolled in (via link, QR code, or session code)
3. **Request enrollment** — If they access a session for a course they are not enrolled in
4. **Participate in sessions** — Code editor, run, submit (same as current spec)
5. **View their own history** — Past submissions and scores

---

## 5. API Endpoints

### 5.1 — Authentication

```
POST   /api/auth/google                          # Exchange Google ID token for JWT
       Body: { idToken: string }
       Returns: { token, user: { id, email, name, role, pictureUrl } }
       Errors: 403 if email not registered

GET    /api/auth/me                              # Get current user profile from JWT
       [Authorize]
       Returns: { id, email, name, role, pictureUrl }

POST   /api/auth/refresh                         # Refresh JWT (if near expiry)
       [Authorize]
```

### 5.2 — Super Admin — User Management

```
GET    /api/admin/users                          # List all users (filterable by role, search by name/email)
       [Authorize: SuperAdmin]
       Query: ?role=Student&search=ali&page=1&pageSize=20

POST   /api/admin/users                          # Create a user (student or instructor)
       [Authorize: SuperAdmin]
       Body: { email, displayName, role }

PUT    /api/admin/users/{id}                     # Update user details
       [Authorize: SuperAdmin]
       Body: { displayName, role, isActive }

DELETE /api/admin/users/{id}                     # Soft-deactivate a user
       [Authorize: SuperAdmin]

POST   /api/admin/users/upload                   # Bulk import users from CSV/JSON file
       [Authorize: SuperAdmin]
       Body: multipart/form-data (file)
       File format (CSV): email,displayName,role
       File format (JSON): [{ email, displayName, role }]
       Returns: { imported: number, skipped: number, errors: [...] }
```

### 5.3 — Super Admin — Course Management

```
GET    /api/admin/courses                        # List all courses
       [Authorize: SuperAdmin]

POST   /api/admin/courses                        # Create a course
       [Authorize: SuperAdmin]
       Body: { code, name, description, instructorId }

PUT    /api/admin/courses/{id}                   # Update course
       [Authorize: SuperAdmin]
       Body: { code, name, description, instructorId, isActive }

DELETE /api/admin/courses/{id}                   # Soft-deactivate course
       [Authorize: SuperAdmin]

POST   /api/admin/courses/upload                 # Bulk import courses from CSV/JSON
       [Authorize: SuperAdmin]
       Body: multipart/form-data (file)
       File format (CSV): code,name,description,instructorEmail
       File format (JSON): [{ code, name, description, instructorEmail }]
```

### 5.4 — Super Admin — Enrollment Management

```
GET    /api/admin/enrollments                    # List all enrollments (filterable)
       [Authorize: SuperAdmin]
       Query: ?courseId=5&status=Active

POST   /api/admin/enrollments                    # Enroll a student in a course
       [Authorize: SuperAdmin]
       Body: { studentId, courseId }

DELETE /api/admin/enrollments/{id}               # Drop a student from a course
       [Authorize: SuperAdmin]

POST   /api/admin/enrollments/upload             # Bulk import enrollments from CSV/JSON
       [Authorize: SuperAdmin]
       Body: multipart/form-data (file)
       File format (CSV): studentEmail,courseCode
       File format (JSON): [{ studentEmail, courseCode }]

GET    /api/admin/enrollment-requests             # List pending enrollment requests
       [Authorize: SuperAdmin]
       Query: ?courseId=5&status=Pending

PUT    /api/admin/enrollment-requests/{id}        # Approve or reject
       [Authorize: SuperAdmin]
       Body: { status: "Approved" | "Rejected" }
```

### 5.5 — Super Admin — Academic Load Management

```
GET    /api/admin/academic-loads                  # List all academic loads
       [Authorize: SuperAdmin]

POST   /api/admin/academic-loads                  # Assign instructor to course
       [Authorize: SuperAdmin]
       Body: { instructorId, courseId, term }

PUT    /api/admin/academic-loads/{id}             # Update assignment
       [Authorize: SuperAdmin]

DELETE /api/admin/academic-loads/{id}             # Remove assignment
       [Authorize: SuperAdmin]
```

### 5.6 — Instructor Endpoints

```
GET    /api/instructor/courses                   # List instructor's own courses
       [Authorize: Instructor]

GET    /api/instructor/courses/{id}              # Course details with enrollment count
       [Authorize: Instructor]
       (must be the assigned instructor)

GET    /api/instructor/courses/{id}/students     # List enrolled students for a course
       [Authorize: Instructor]

POST   /api/instructor/courses/{id}/enrollments  # Enroll a student (instructor manages own course)
       [Authorize: Instructor]
       Body: { studentId }

DELETE /api/instructor/courses/{id}/enrollments/{enrollmentId}
       [Authorize: Instructor]                   # Drop a student

GET    /api/instructor/courses/{id}/enrollment-requests
       [Authorize: Instructor]                   # Pending requests for this course

PUT    /api/instructor/courses/{id}/enrollment-requests/{requestId}
       [Authorize: Instructor]                   # Approve/reject
       Body: { status: "Approved" | "Rejected" }

GET    /api/instructor/courses/{id}/challenges   # List challenges for the course
       [Authorize: Instructor]

POST   /api/instructor/courses/{id}/challenges   # Create a challenge for the course
       [Authorize: Instructor]

PUT    /api/instructor/challenges/{id}           # Update a challenge
       [Authorize: Instructor]

DELETE /api/instructor/challenges/{id}           # Delete a challenge
       [Authorize: Instructor]

GET    /api/instructor/courses/{id}/sessions     # Session history for a course
       [Authorize: Instructor]
       Returns: list of all sessions (past and active) for this course

POST   /api/instructor/sessions                  # Create a session for a course
       [Authorize: Instructor]
       Body: { courseId, name, challengeIds }
       Returns: { session, joinCode, shareableLink, qrCodeBase64 }

# Existing teacher endpoints (from CODEFEST-SPEC.md §3.6) remain
# but are now scoped to the authenticated instructor:
GET    /api/teacher/sessions/{code}
GET    /api/teacher/sessions/{code}/activity
GET    /api/teacher/sessions/{code}/leaderboard
GET    /api/teacher/students/{id}/code
GET    /api/teacher/students/{id}/submissions
POST   /api/teacher/sessions/{code}/hint
POST   /api/teacher/sessions/{code}/broadcast
PUT    /api/teacher/sessions/{code}/status
```

### 5.7 — Student Endpoints

```
GET    /api/student/courses                      # List courses the student is enrolled in
       [Authorize: Student]

GET    /api/student/courses/{id}                 # Course details
       [Authorize: Student]
       (must be enrolled)

POST   /api/student/enrollment-requests          # Request enrollment in a course
       [Authorize: Student]
       Body: { courseId }

GET    /api/student/sessions                     # List active sessions the student can join
       [Authorize: Student]
       Returns: active sessions for enrolled courses

GET    /api/student/history                      # Past participation + scores
       [Authorize: Student]
       Query: ?courseId=5

# Session join is via SignalR (see §6)
```

---

## 6. SignalR Hub Changes

### 6.1 — Authentication on Connection

```csharp
// The SignalR hub now requires authentication.
// JWT is passed as query string on connection:
//   const connection = new signalR.HubConnectionBuilder()
//     .withUrl("/hubs/codefest", {
//         accessTokenFactory: () => authService.getToken()
//     })
//     .build();
//
// The hub can access the user from Context.User:
//   var userId = int.Parse(Context.User.FindFirst("sub").Value);
//   var role = Context.User.FindFirst("role").Value;
```

### 6.2 — Modified Hub Methods

```csharp
// --- CHANGED: JoinSession ---
// Before: JoinSession(sessionCode, displayName, clientType)
// After:  JoinSession(sessionCode, clientType)
//
// The user is identified from the JWT. No display name needed.
// The server:
//   1. Extracts userId from JWT
//   2. Looks up the session by code
//   3. Checks that the user is enrolled in the session's course
//   4. If NOT enrolled:
//      a. Return error: { code: "NOT_ENROLLED", courseId, courseName }
//      b. Client shows: "You are not enrolled in {courseName}."
//         + "Request Enrollment" button
//   5. If enrolled → create SessionParticipant, join SignalR group, proceed normally

// --- CHANGED: CreateSession ---
// Before: CreateSession(sessionName)
// After:  CreateSession(sessionName, courseId, challengeIds)
//
// The instructor must own the course (or be super admin).
// challengeIds must all belong to the specified course.
// Server generates: join code, shareable link, QR code data.
```

All other hub methods (SubmitCode, RunCode, SendRunInput, etc.) remain unchanged. They now use `Context.User` instead of a student ID parameter.

---

## 7. Session Sharing — Links & QR Codes

### 7.1 — Shareable Links

When a session is created, the server generates a shareable URL:

```
https://codefest.yourdomain.com/join/{sessionCode}

Example: https://codefest.yourdomain.com/join/ABC123
```

This link works across all platforms:
- **Web:** Opens directly in the browser
- **Android/iOS:** If the app is installed, the link opens the app via deep linking (Capacitor App Links / Universal Links). If not installed, opens in the browser.
- **Windows Electron:** The link opens in the default browser; if the Electron app is running, it can register a custom protocol handler (`codefest://join/ABC123`)

### 7.2 — QR Code Generation

The server generates a QR code encoding the shareable link. This is generated server-side using a QR code library.

```csharp
// NuGet: dotnet add package QRCoder
//
// On session creation:
//   var qrGenerator = new QRCodeGenerator();
//   var qrCodeData = qrGenerator.CreateQrCode(shareableLink, QRCodeGenerator.ECCLevel.M);
//   var qrCode = new PngByteQRCode(qrCodeData);
//   var pngBytes = qrCode.GetGraphic(10);  // 10 pixels per module
//   session.QrCodeData = Convert.ToBase64String(pngBytes);
//
// The QR code is returned to the instructor in the session creation response
// and displayed on the teacher dashboard for students to scan.
```

### 7.3 — Join Flow via Link/QR

```
Student scans QR or clicks link
    → App/browser opens to /join/ABC123
    → If not signed in → redirect to Google Sign-In → then back to /join/ABC123
    → If signed in → POST /api/sessions/ABC123/join (or via SignalR JoinSession)
    → Server checks enrollment:
        ✅ Enrolled → join session, navigate to /code
        ❌ Not enrolled → show error page:
           "You are not enrolled in [Course Name]"
           [Request Enrollment] button
           → POST /api/student/enrollment-requests { courseId }
           → "Your request has been sent to the instructor."
           → Instructor/admin sees the request in their dashboard
```

---

## 8. Super Admin Dashboard UI

### 8.1 — Route Structure

```
/admin                          → Admin dashboard home (summary stats)
/admin/users                    → User management (list, create, edit, upload)
/admin/courses                  → Course management (list, create, edit, upload)
/admin/enrollments              → Enrollment management (list, enroll, drop, upload)
/admin/enrollment-requests      → Pending enrollment requests
/admin/academic-loads           → Academic load assignments
```

### 8.2 — Admin Dashboard Layout

```
┌────────────────────────────────────────────────────────────────┐
│  CodeFest Admin         [raed.felfel.instructor@gmail.com] [⚙]│
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                     │
│  Sidebar │   Main Content Area                                 │
│          │                                                     │
│  📊 Home │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  👥 Users│   │ Users   ││ Courses ││ Active  ││ Pending ││
│  📚 Crs  │   │ 156     ││ 8       ││Sessions ││Requests ││
│  📋 Enrl │   │         ││         ││ 3       ││ 12      ││
│  📝 Req  │   └─────────┘ └─────────┘ └─────────┘ └─────────┘│
│  🎓 Load │                                                     │
│          │   Recent Activity                                   │
│          │   ...                                               │
└──────────┴─────────────────────────────────────────────────────┘
```

### 8.3 — User Management Screen

- Table with columns: Name, Email, Role, Status, Last Login, Actions
- Search bar (by name or email)
- Filter by role (All, Student, Instructor, Super Admin)
- "Add User" button → modal with: Email, Display Name, Role dropdown
- "Upload Users" button → file upload (CSV or JSON), with preview/validation before import
- Inline edit and deactivate actions
- CSV template download link

### 8.4 — Course Management Screen

- Table with columns: Code, Name, Instructor, Students Count, Sessions Count, Status, Actions
- "Add Course" button → modal with: Code, Name, Description, Instructor (dropdown of instructors)
- "Upload Courses" button → file upload with preview
- Click a course → detail view showing enrolled students, challenges, and session history

### 8.5 — Enrollment Management Screen

- Table with columns: Student Name, Student Email, Course, Status, Enrolled Date, Actions
- Filter by course, by status
- "Enroll Student" button → modal with student picker + course picker
- "Upload Enrollments" button → file upload (CSV: studentEmail, courseCode)
- Bulk actions: select multiple → enroll/drop

### 8.6 — Enrollment Requests Screen

- Table of pending requests with columns: Student Name, Email, Course, Requested Date, Actions
- Approve / Reject buttons per row
- Bulk approve/reject with select-all

### 8.7 — File Upload Format

All upload endpoints accept CSV or JSON files. The system validates the file before importing and returns a preview.

**Users CSV format:**
```csv
email,displayName,role
ali.student@gmail.com,Ali Ahmad,Student
sara.student@gmail.com,Sara Mahmoud,Student
omar.instructor@gmail.com,Omar Nasser,Instructor
```

**Courses CSV format:**
```csv
code,name,description,instructorEmail
CS101,Intro to Programming,Introduction to C# programming,omar.instructor@gmail.com
CS201,Data Structures,Advanced data structures and algorithms,omar.instructor@gmail.com
```

**Enrollments CSV format:**
```csv
studentEmail,courseCode
ali.student@gmail.com,CS101
sara.student@gmail.com,CS101
ali.student@gmail.com,CS201
```

**JSON format** follows the same field names as an array of objects.

**Upload flow:**
1. Admin selects file
2. Frontend parses and shows preview table (first 10 rows + total count)
3. Validation: checks email format, required fields, duplicate detection
4. Admin clicks "Import"
5. Backend processes, returns: `{ imported: 45, skipped: 3, errors: [{row: 7, error: "Invalid email"}] }`
6. Admin sees result summary

---

## 9. Instructor Dashboard Changes

### 9.1 — Session Creation Flow (Updated)

The session creation flow in `CODEFEST-SPEC.md` §3.5 is updated:

```
Instructor opens /teacher (must be signed in via Google)
    → Sees list of their courses (from academic load)
    → Selects a course
    → Sees course challenges + enrolled student count
    → Clicks "Create Session"
    → Modal:
        - Session name (text input)
        - Course (pre-selected, read-only)
        - Select challenges from the course's challenge pool (checkboxes)
    → System generates:
        - 6-character join code
        - Shareable link: https://codefest.yourdomain.com/join/ABC123
        - QR code image
    → Dashboard shows:
        - Join code (large, projected on screen)
        - QR code (students scan with phone)
        - "Copy Link" button
        - Student grid (students appear as they join)
    → From here, flow continues as in CODEFEST-SPEC.md §3.5
```

### 9.2 — Session History View (New)

```
/teacher/courses/{id}/sessions    → List of all sessions for this course

Table columns: Session Name, Date, Duration, Students, Status, Actions
Click a session → view that session's details:
    - Leaderboard (final)
    - Activity log
    - Submissions
    - Export (CSV)
```

### 9.3 — Enrollment Management (Instructor View)

Instructors can manage enrollment for their own courses from within the teacher area:

```
/teacher/courses/{id}/students    → Enrolled students for this course

- Table: Name, Email, Status, Enrolled Date
- "Enroll Student" button (search by email from existing student users)
- Drop student action
- Pending enrollment requests notification badge
- "Enrollment Requests" tab showing pending requests with Approve/Reject
```

---

## 10. Student Experience Changes

### 10.1 — Sign-In Screen

```
/login

┌──────────────────────────────────┐
│                                  │
│         🎮 CodeFest              │
│                                  │
│   Celebrative Coding Sessions    │
│                                  │
│   ┌──────────────────────────┐   │
│   │  🔵 Sign in with Google  │   │
│   └──────────────────────────┘   │
│                                  │
│   Use your institutional Gmail   │
│   account to sign in.            │
│                                  │
└──────────────────────────────────┘
```

### 10.2 — Student Home (New)

After signing in, students see a home screen before joining a session:

```
/student

┌──────────────────────────────────────────────┐
│  CodeFest        Welcome, Ali!     [Sign Out]│
├──────────────────────────────────────────────┤
│                                              │
│  Your Courses                                │
│  ┌────────────────────────────────────────┐  │
│  │ CS101 — Intro to Programming          │  │
│  │ Instructor: Dr. Omar                   │  │
│  │ 🟢 Active session available            │  │
│  │                        [Join Session]  │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ CS201 — Data Structures               │  │
│  │ Instructor: Dr. Omar                   │  │
│  │ No active sessions                     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ─── OR ───                                  │
│                                              │
│  Enter session code: [______] [Join]         │
│                                              │
│  Past Sessions                               │
│  • CS101 Session "Week 5 Lab" — 350 pts     │
│  • CS101 Session "Midterm" — 480 pts         │
│                                              │
└──────────────────────────────────────────────┘
```

### 10.3 — Non-Enrolled Student Flow

When a student accesses a session (via link, QR, or code) for a course they are NOT enrolled in:

```
┌──────────────────────────────────────────────┐
│                                              │
│  ⚠️ Not Enrolled                             │
│                                              │
│  This session belongs to:                    │
│  CS101 — Intro to Programming                │
│  Instructor: Dr. Omar                        │
│                                              │
│  You are not enrolled in this course.        │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │     📩 Request Enrollment            │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Your instructor will review your request.   │
│                                              │
└──────────────────────────────────────────────┘
```

After requesting:

```
│  ✅ Enrollment request sent!                 │
│                                              │
│  You'll be able to join once your            │
│  instructor approves your request.           │
```

---

## 11. Multi-Platform Updates

All platform builds use the same Angular codebase. Platform-specific differences are in the shell (Capacitor native plugins, Electron wrapper) and the Google Sign-In integration method.

### 11.1 — iOS Support (New — Capacitor)

```bash
cd ~/codefest/codefest-client

# Add iOS platform
npm install @capacitor/ios
npx cap add ios

# Add Google Sign-In plugin
npm install @codetrix-studio/capacitor-google-auth

# Configure in capacitor.config.ts:
# {
#   plugins: {
#     GoogleAuth: {
#       scopes: ['profile', 'email'],
#       serverClientId: '<GOOGLE_CLIENT_ID>',
#       iosClientId: '<GOOGLE_IOS_CLIENT_ID>'  // Separate iOS client ID from Google Console
#     }
#   }
# }

# Build and sync
npx ng build --configuration production
npx cap sync ios

# Open in Xcode
npx cap open ios
```

**iOS-specific requirements:**
- Register a URL scheme in Info.plist for Google Sign-In callback
- Add the GoogleService-Info.plist from Firebase/Google Console
- Configure Associated Domains for Universal Links (session share links)
- Screen pinning: iOS does not support true kiosk mode without MDM. Use Guided Access API where available, otherwise rely on soft kiosk (detect app switch, log it)

**iOS kiosk approach:**
- Use `UIAccessibility.requestGuidedAccessSession` (requires Guided Access enabled in device Settings)
- If Guided Access is not enabled, fall back to soft kiosk (same as web: detect and report app switches)
- The teacher dashboard shows the client type (iOS) so the instructor knows the lockdown level

### 11.2 — Windows Electron Kiosk (New)

```
~/codefest/codefest-electron/
├── package.json
├── main.js                    # Electron main process
├── preload.js                 # Secure bridge to renderer
└── electron-builder.yml       # Build config for Windows installer
```

**Electron setup:**

```bash
mkdir -p ~/codefest/codefest-electron
cd ~/codefest/codefest-electron
npm init -y
npm install electron electron-builder --save-dev
```

**main.js — Electron main process (key features):**

```javascript
// 1. KIOSK MODE
//    - BrowserWindow with: kiosk: true, fullscreen: true, frame: false
//    - Disable: Alt+F4, Alt+Tab, Ctrl+W, Windows key (via globalShortcut.register)
//    - Block DevTools in production
//
// 2. GOOGLE AUTH
//    - Use Electron's session to handle OAuth
//    - Open Google Sign-In in a BrowserWindow
//    - Capture the redirect with the auth code
//    - OR: Use loopback IP redirect (http://127.0.0.1:{port}/callback)
//
// 3. TEACHER PIN EXIT
//    - Register an IPC handler for "request-exit"
//    - Renderer sends the teacher PIN
//    - Main process validates PIN → if correct, close kiosk
//    - PIN is configured in the app settings or fetched from the API
//
// 4. DEEP LINKS
//    - Register custom protocol: codefest://
//    - Handle: codefest://join/ABC123 → load session join page
//    - Also handle https:// links if registered as default handler
//
// 5. AUTO-UPDATE (optional)
//    - Use electron-updater for OTA updates
//    - Check for updates on launch
```

**Build and distribute:**

```bash
cd ~/codefest/codefest-electron

# Build the Angular app first
cd ../codefest-client
npx ng build --configuration production

# Copy build output to Electron
cp -r dist/codefest-client/browser ../codefest-electron/web-app/

# Build Electron for Windows
cd ../codefest-electron
npx electron-builder --win --x64

# Output: dist/CodeFest Setup.exe (NSIS installer)
# Or:     dist/CodeFest.exe (portable)
```

### 11.3 — Platform Feature Matrix

| Feature | Web | Android | iOS | Windows Electron |
|---------|-----|---------|-----|-----------------|
| Google Sign-In | GIS JS library | Capacitor plugin | Capacitor plugin | OAuth loopback redirect |
| Kiosk mode | Soft (fullscreen + detection) | Hard (screen pinning / device owner) | Guided Access (if enabled) | Hard (kiosk window + shortcut blocking) |
| Teacher PIN exit | N/A (soft kiosk) | Yes (LockTask.stopLockTask) | Yes (end Guided Access) | Yes (IPC handler) |
| QR code scanning | Not applicable (desktop) | Camera API | Camera API | Not applicable (desktop) |
| Deep links | URL routing | App Links | Universal Links | Custom protocol handler |
| Session link sharing | Copy link | Share sheet | Share sheet | Copy link |
| Push notifications | Not supported | FCM (optional) | APNS (optional) | Not supported |

### 11.4 — Docker Compose Addition

No new containers needed for Electron or iOS builds. The Electron app and Capacitor apps connect to the same API server. The Docker Compose file from `CODEFEST-SPEC.md` §1.4 remains unchanged.

---

## 12. Angular Route Map (Updated)

```typescript
// app.routes.ts — UPDATED

export const routes: Routes = [
  // --- Public ---
  { path: 'login',             component: LoginComponent },

  // --- Student ---
  { path: 'student',           component: StudentHomeComponent, canActivate: [authGuard, roleGuard('Student')] },
  { path: 'join/:code',        component: JoinComponent, canActivate: [authGuard] },
  { path: 'code',              component: CodingComponent, canActivate: [authGuard, sessionGuard] },

  // --- Instructor / Teacher ---
  { path: 'teacher',           component: TeacherComponent, canActivate: [authGuard, roleGuard('Instructor')] },
  { path: 'teacher/courses/:id/sessions', component: SessionHistoryComponent, canActivate: [authGuard, roleGuard('Instructor')] },
  { path: 'teacher/courses/:id/students', component: CourseStudentsComponent, canActivate: [authGuard, roleGuard('Instructor')] },

  // --- Super Admin ---
  { path: 'admin',             component: AdminDashboardComponent, canActivate: [authGuard, roleGuard('SuperAdmin')] },
  { path: 'admin/users',       component: AdminUsersComponent, canActivate: [authGuard, roleGuard('SuperAdmin')] },
  { path: 'admin/courses',     component: AdminCoursesComponent, canActivate: [authGuard, roleGuard('SuperAdmin')] },
  { path: 'admin/enrollments', component: AdminEnrollmentsComponent, canActivate: [authGuard, roleGuard('SuperAdmin')] },
  { path: 'admin/enrollment-requests', component: AdminRequestsComponent, canActivate: [authGuard, roleGuard('SuperAdmin')] },
  { path: 'admin/academic-loads', component: AdminAcademicLoadsComponent, canActivate: [authGuard, roleGuard('SuperAdmin')] },

  // --- Redirects ---
  { path: '',                  redirectTo: '/login', pathMatch: 'full' },
  { path: '**',               redirectTo: '/login' }
];
```

---

## 13. Angular Project Structure Changes

```
codefest-client/src/app/
├── core/
│   ├── services/
│   │   ├── auth.service.ts              # NEW — Google Sign-In + JWT management
│   │   ├── signalr.service.ts           # MODIFIED — attach JWT on connection
│   │   ├── session.service.ts           # MODIFIED — session now includes courseId
│   │   ├── activity-tracker.service.ts  # Unchanged
│   │   ├── kiosk.service.ts             # Unchanged (platform-specific via DI)
│   │   ├── course.service.ts            # NEW — course CRUD + enrollment
│   │   ├── admin.service.ts             # NEW — admin API calls
│   │   └── qr.service.ts               # NEW — QR code display/generation
│   ├── guards/
│   │   ├── auth.guard.ts               # NEW — must be signed in
│   │   ├── role.guard.ts               # NEW — role-based route access
│   │   ├── session.guard.ts            # MODIFIED — check enrollment
│   │   └── teacher.guard.ts            # MODIFIED — check instructor role
│   ├── interceptors/
│   │   └── auth.interceptor.ts         # NEW — attach Bearer token to HTTP requests
│   └── models/
│       ├── user.model.ts               # NEW
│       ├── course.model.ts             # NEW
│       ├── enrollment.model.ts         # NEW
│       ├── challenge.model.ts          # Unchanged
│       ├── submission.model.ts         # Unchanged
│       └── session.model.ts            # MODIFIED — add courseId, shareableLink, qrCode
├── features/
│   ├── login/
│   │   └── login.component.ts          # NEW — Google Sign-In button
│   ├── student-home/
│   │   └── student-home.component.ts   # NEW — enrolled courses, active sessions, history
│   ├── join/
│   │   └── join.component.ts           # MODIFIED — auth required, enrollment check
│   ├── not-enrolled/
│   │   └── not-enrolled.component.ts   # NEW — "Request Enrollment" page
│   ├── coding/
│   │   └── ...                         # Unchanged (all editor/challenge components)
│   ├── teacher/
│   │   ├── ...                         # Mostly unchanged dashboard components
│   │   ├── session-create/
│   │   │   └── session-create.component.ts  # MODIFIED — course picker, QR display
│   │   ├── session-history/
│   │   │   └── session-history.component.ts # NEW — past sessions per course
│   │   └── course-students/
│   │       └── course-students.component.ts # NEW — enrollment management for instructor
│   └── admin/
│       ├── admin-dashboard.component.ts     # NEW
│       ├── admin-users.component.ts         # NEW
│       ├── admin-courses.component.ts       # NEW
│       ├── admin-enrollments.component.ts   # NEW
│       ├── admin-requests.component.ts      # NEW
│       ├── admin-academic-loads.component.ts # NEW
│       └── shared/
│           ├── file-upload.component.ts     # NEW — reusable CSV/JSON upload with preview
│           └── data-table.component.ts      # NEW — reusable sortable/filterable table
└── shared/
    ├── components/
    │   ├── celebration.component.ts         # Unchanged
    │   ├── status-badge.component.ts        # Unchanged
    │   ├── google-signin-button.component.ts # NEW
    │   └── qr-display.component.ts          # NEW — renders QR code image
    └── pipes/
        └── time-ago.pipe.ts                 # Unchanged
```

---

## 14. Configuration File Summary

```yaml
# appsettings.yaml — all new configuration keys

CodeFest:
  SuperAdmin:
    Email: "raed.felfel.instructor@gmail.com"

Authentication:
  Google:
    ClientId: "<GOOGLE_CLIENT_ID>"
    ClientSecret: "<GOOGLE_CLIENT_SECRET>"
  Jwt:
    Secret: "<JWT_SECRET_KEY>"          # 256-bit minimum
    Issuer: "CodeFest"
    Audience: "CodeFest"
    ExpiryHours: 24

Session:
  ShareableLinkBase: "https://codefest.yourdomain.com/join"
  # QR code is auto-generated from the shareable link
```

```bash
# .env — add to existing file
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
JWT_SECRET=<random-256-bit-key>
```

---

## 15. Implementation Order

This specification should be implemented in the following order to minimize integration risk:

1. **Database models + migrations** — Add User, Course, Enrollment, AcademicLoad, EnrollmentRequest, SessionParticipant. Modify Session, Challenge, Submission, ActivityLog. Run migration.

2. **Auth backend** — Google token validation, JWT issuing, auth middleware, role-based policies. Seed super admin from config.

3. **Admin API endpoints** — CRUD for users, courses, enrollments, academic loads. File upload endpoints.

4. **Auth frontend (Angular)** — Login page, auth service, interceptor, guards. Test login flow on web.

5. **Admin dashboard UI** — All admin screens (users, courses, enrollments, requests, academic loads, file upload).

6. **Instructor changes** — Course-scoped session creation, challenge management per course, enrollment management, session history view. QR code generation + display.

7. **Student changes** — Student home screen, enrollment check on join, enrollment request flow, not-enrolled page.

8. **SignalR auth** — JWT on connection, enrollment validation in JoinSession, update all hub methods to use Context.User.

9. **Session sharing** — Shareable links, QR codes, deep link handling on all platforms.

10. **iOS support** — Capacitor iOS platform, Google Sign-In plugin, Universal Links, Guided Access kiosk.

11. **Windows Electron** — Electron wrapper, kiosk mode, Google OAuth via loopback, teacher PIN exit, custom protocol handler, Windows installer build.

12. **Testing & data migration** — Migrate existing data (if any), end-to-end testing across all platforms.

---

## 16. CLI Prompts for Implementation

When passing this spec to Claude CLI for implementation, include the following context per phase:

**For backend work:** *"Read CODEFEST-AUTH-COURSES-SPEC.md sections 2–6. The existing codebase follows CODEFEST-SPEC.md. Apply changes to the .NET 8 Web API project in CodeFest.Api/. Preserve all existing code execution, SignalR, and challenge logic. These changes apply to the backend that serves all platforms (web, Android, iOS, Windows Electron)."*

**For admin UI work:** *"Read CODEFEST-AUTH-COURSES-SPEC.md section 8. Build the admin dashboard in the Angular 17+ project at codefest-client/. This UI must work across web browsers and inside the Electron wrapper on Windows."*

**For mobile work:** *"Read CODEFEST-AUTH-COURSES-SPEC.md sections 2.6, 11.1. Add iOS platform via Capacitor. Configure Google Sign-In for both Android and iOS. Implement deep linking for session share URLs. These changes affect the Capacitor layer in codefest-client/."*

**For Electron work:** *"Read CODEFEST-AUTH-COURSES-SPEC.md section 11.2. Create the Electron wrapper project at codefest-electron/. It loads the Angular app build and adds kiosk mode, Google OAuth, teacher PIN exit, and custom protocol handling for Windows."*

---

## 17. Open Questions for Future Consideration

These items are intentionally deferred and can be addressed in future specs:

1. **Token refresh strategy** — Should the JWT silently refresh, or should the user re-authenticate after 24 hours?
2. **Offline mode** — Should students be able to write code offline and sync when reconnected?
3. **Push notifications** — Should students receive notifications when a session starts (FCM/APNS)?
4. **Multi-term support** — Should courses and enrollments be term-scoped (Fall 2025, Spring 2026)?
5. **Grade export** — Should the system export grades in a format compatible with institutional LMS (Moodle, Blackboard)?
6. **Super admin delegation** — Should there be multiple super admins, or is one sufficient?
