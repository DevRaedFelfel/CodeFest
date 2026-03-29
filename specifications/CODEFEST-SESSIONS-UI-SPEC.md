# CodeFest — Sessions UI Specification

## Teacher Sessions Screen & Student Session View — Revised for Courses/Enrollment Architecture

**Companion to:** CODEFEST-SPEC.md, CODEFEST-AUTH-COURSES-SPEC.md  
**Scope:** Angular 17+ frontend (web, Android/Capacitor, Electron/Windows)  
**Platforms affected:** All (web, mobile, desktop)

---

## §1 — Context & Terminology

This specification assumes the **courses/enrollment architecture** from `CODEFEST-AUTH-COURSES-SPEC.md` is implemented. Key entities referenced throughout:

| Entity | Source | Description |
|--------|--------|-------------|
| **User** | Auth spec | Google-authenticated account with `Role` (SuperAdmin, Instructor, Student) |
| **Course** | Auth spec | Has `Id`, `Name`, `Code`, `Description`, `InstructorUserId` |
| **Enrollment** | Auth spec | Links a `UserId` (student) to a `CourseId` with `Status` (Active, Dropped, Completed) |
| **AcademicLoad** | Auth spec | Links an `InstructorUserId` to a `CourseId` (which courses a teacher can create sessions for) |
| **Session** | Original spec + Auth spec | Now has `CourseId` — ties a session to a specific course. Has `Status` (Lobby, Active, Paused, Ended) |
| **SessionParticipant** | Auth spec (renamed from Student) | Links a `UserId` to a `SessionId` — only enrolled students can join |
| **Submission** | Original spec | Code submission with test results, linked to `SessionParticipant` |
| **ActivityLog** | Original spec | All student actions within a session |
| **Challenge** | Original spec | Coding challenge with test cases and pattern checks |

**Key relationships:**

```
Instructor (User) ──AcademicLoad──▶ Course
                                       │
                                       ├── Enrollment ──▶ Student (User)
                                       │
                                       └── Session
                                             │
                                             ├── SessionParticipant (enrolled students only)
                                             │     ├── Submission(s)
                                             │     └── ActivityLog(s)
                                             │
                                             └── Challenge(s)
```

---

## §2 — Teacher Sessions Screen (`/teacher/sessions`)

### 2.1 — Purpose

This is the **session management hub** for a logged-in instructor. It lists all sessions the instructor has created across all their courses, with bulk actions, filtering, and drill-down into per-session student data.

### 2.2 — Access Control

- **Route guard:** `teacher.guard.ts` — requires authenticated user with `Role = Instructor` or `Role = SuperAdmin`
- **Data scope:** The API returns only sessions belonging to courses in the instructor's `AcademicLoad`. A SuperAdmin sees all sessions across all courses.
- **Session ownership:** An instructor can only manage sessions for courses assigned to them via `AcademicLoad`.

### 2.3 — Page Layout (Scrollable)

The entire page is vertically scrollable (`overflow-y: auto` on the main content area, not the shell/nav). The layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER BAR (fixed)                                                 │
│  CodeFest  │  Sessions  │  Courses  │  [instructor@gmail.com] [▼]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ TOOLBAR ──────────────────────────────────────────────────────┐ │
│  │ [+ Create Session]  │  Course: [All ▼]  │  Status: [All ▼]    │ │
│  │ Progress: [All ▼]   │  Search: [________]  │  [Bulk Actions ▼]│ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ SESSIONS TABLE (scrollable body) ────────────────────────────┐ │
│  │ ☐  Session Name    Course    Code   Status  Progress  Created │ │
│  │────────────────────────────────────────────────────────────────│ │
│  │ ☐  Midterm Exam    CS101     ABC123 Active  12/30     Mar 20  │ │ ← expandable
│  │    └─ Student rows when expanded (see §2.5)                   │ │
│  │ ☐  Lab Week 5      CS101     XYZ789 Ended   30/30     Mar 15  │ │
│  │ ☐  Practice 1      CS202     DEF456 Lobby   0/15      Mar 24  │ │
│  │ ...                                                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ PAGINATION ───────────────────────────────────────────────────┐ │
│  │ Showing 1-20 of 47 sessions  │  [◀] [1] [2] [3] [▶]          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.4 — Sessions Table Specification

#### 2.4.1 — Table Structure

The sessions are displayed in a **data table** (not cards). Use Angular Material `mat-table` or a custom table component with the following columns:

| # | Column | Width | Content | Sortable |
|---|--------|-------|---------|----------|
| 1 | **Checkbox** | 48px | `<mat-checkbox>` for row selection | No |
| 2 | **Expand** | 40px | Chevron icon `▶` / `▼` toggle | No |
| 3 | **Session Name** | flex | Session name (clickable → navigates to live dashboard) | Yes |
| 4 | **Course** | 120px | Course code (e.g., "CS101") with tooltip showing full name | Yes |
| 5 | **Join Code** | 80px | 6-char code with copy-to-clipboard icon | No |
| 6 | **Status** | 100px | Badge: Lobby (gray), Active (green pulse), Paused (amber), Ended (red) | Yes |
| 7 | **Progress** | 120px | `{completed}/{total}` enrolled students who finished all challenges | Yes |
| 8 | **Created** | 100px | Relative date ("2h ago", "Mar 20") | Yes |
| 9 | **Actions** | 80px | Overflow menu `⋮` (Start, Pause, End, Share Link, Share QR, Delete) | No |

#### 2.4.2 — Header Row Checkbox (Select All)

The header row contains a **master checkbox** that follows standard tri-state behavior:

- **Unchecked:** No rows selected
- **Indeterminate (dash):** Some rows on the current page are selected
- **Checked:** All rows on the current page are selected

Selecting all applies only to the **current filtered/paginated view**, not all sessions globally. A banner appears when all visible rows are selected: *"All 20 sessions on this page selected. [Select all 47 sessions?]"*

#### 2.4.3 — Bulk Actions (when 1+ rows selected)

A bulk actions toolbar appears above the table when any checkbox is selected:

```
┌──────────────────────────────────────────────────────────────┐
│  ☑ 3 selected  │  [End Selected]  [Delete Selected]  [✕]    │
└──────────────────────────────────────────────────────────────┘
```

- **End Selected:** Ends all selected sessions that are Active/Paused. Confirmation dialog.
- **Delete Selected:** Soft-deletes selected sessions (Lobby/Ended only; Active/Paused sessions cannot be deleted). Confirmation dialog with count.

### 2.5 — Expandable Session Rows (Student Details)

Each session row is **collapsible/expandable**. Clicking the chevron `▶` expands a nested panel below the row showing the students who participated in (or are connected to) that session.

#### 2.5.1 — Expanded View Layout

```
│ ☐  Midterm Exam    CS101     ABC123   Active   12/30   Mar 20   ⋮  │
│ ▼                                                                    │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │  Student         Status      Challenge    Points   Submissions  │ │
│ │──────────────────────────────────────────────────────────────────│ │
│ │  Ali Ahmad       ● Online    3/5          350      7            │ │
│ │  Sara Nasser     ● Online    2/5          150      4            │ │
│ │  Omar Khalil     ○ Offline   1/5          50       2            │ │
│ │  Noor Haddad     ⚠ Flagged   2/5          100      5            │ │
│ │──────────────────────────────────────────────────────────────────│ │
│ │  Enrolled but not joined: 18 students                           │ │
│ │  [View Full Dashboard →]  [Export CSV]  [View Activity Log →]   │ │
│ └──────────────────────────────────────────────────────────────────┘ │
```

#### 2.5.2 — Nested Student Table Columns

| Column | Content |
|--------|---------|
| **Student** | Display name from `User` (Google account name). Links to student detail. |
| **Status** | ● Online (green), ○ Offline (gray), ⚠ Flagged (amber — tab switch or paste detected) |
| **Challenge** | `{current}/{total}` — current challenge index out of session's challenge count |
| **Points** | Total points accumulated |
| **Submissions** | Total submission attempts |

#### 2.5.3 — Data Source

The expanded student data comes from:

```
GET /api/teacher/sessions/{code}
```

Response includes `participants[]` which are `SessionParticipant` records joined with `User` (for name/email) and `Enrollment` (to confirm active enrollment). Only students with an **active enrollment** in the session's `Course` appear here. The "Enrolled but not joined" count = total active enrollments for the course minus the count of `SessionParticipant` records.

### 2.6 — Filters

All filters apply simultaneously (AND logic) and update the table in real-time (client-side for loaded data, server-side for paginated).

#### 2.6.1 — Course Filter

```
Course: [ All Courses        ▼ ]
         ├─ All Courses
         ├─ CS101 — Intro to Programming
         ├─ CS202 — Data Structures
         └─ CS303 — Algorithms
```

Populated from the instructor's `AcademicLoad` courses. SuperAdmin sees all courses.

#### 2.6.2 — Status Filter

```
Status: [ All Statuses  ▼ ]
         ├─ All Statuses
         ├─ Lobby
         ├─ Active
         ├─ Paused
         └─ Ended
```

#### 2.6.3 — Progress Filter

"Progress" means the percentage of enrolled students who have completed all challenges in the session.

```
Progress: [ All          ▼ ]
           ├─ All
           ├─ Not Started (0%)
           ├─ In Progress (1–99%)
           └─ Completed (100%)
```

#### 2.6.4 — Text Search

Free-text search filters by session name, join code, or course name/code. Debounced at 300ms.

### 2.7 — API Endpoints for This Screen

```
GET  /api/teacher/sessions
     ?courseId={id}
     &status={Lobby|Active|Paused|Ended}
     &progress={NotStarted|InProgress|Completed}
     &search={text}
     &page={n}
     &pageSize={n}
     &sortBy={name|course|status|progress|createdAt}
     &sortDir={asc|desc}

Response:
{
  items: [
    {
      id: number,
      name: string,
      courseId: number,
      courseCode: string,
      courseName: string,
      code: string,              // 6-char join code
      status: "Lobby" | "Active" | "Paused" | "Ended",
      createdAt: string,
      startedAt: string | null,
      endedAt: string | null,
      challengeCount: number,
      enrolledCount: number,     // total active enrollments for the course
      participantCount: number,  // students who actually joined this session
      completedCount: number,    // students who finished all challenges
    }
  ],
  totalCount: number,
  page: number,
  pageSize: number
}

GET  /api/teacher/sessions/{code}
     → includes participants[] with student details (see §2.5.3)

GET  /api/teacher/sessions/{code}/activity
     ?studentId={userId}         // NEW: filter by specific student
     &type={ActivityType}
     &page={n}
     &pageSize={n}

POST /api/teacher/sessions/bulk-end
     Body: { sessionCodes: string[] }

DELETE /api/teacher/sessions/bulk-delete
     Body: { sessionCodes: string[] }
```

---

## §3 — Teacher Session Live Dashboard (`/teacher/sessions/{code}`)

This is the **existing** live monitoring view from the original spec (§3.2 in CODEFEST-SPEC.md) with the following modifications for courses/enrollment alignment.

### 3.1 — Activity Log: Student Filter

The Activity Feed panel (right side of dashboard) gains a **student filter dropdown**.

```
┌─ Activity Feed ─────────────────────────────┐
│ Filter: [All Students ▼] [All Types ▼]      │
│                                              │
│  09:15  Ali Ahmad: submitted challenge 3     │
│  09:14  Sara Nasser: tab switch detected     │
│  09:14  Ali Ahmad: test pass (3/3)           │
│  09:13  Omar Khalil: joined session          │
│  ...                                         │
└──────────────────────────────────────────────┘
```

**Student filter dropdown:** Populated dynamically from the `SessionParticipant` records for this session. Each entry shows the student's display name. Selecting a student filters the activity log to show only events from that student.

```
Filter: [ All Students       ▼ ]
         ├─ All Students
         ├─ Ali Ahmad
         ├─ Sara Nasser
         ├─ Omar Khalil
         └─ Noor Haddad
```

The dropdown only shows students who have **joined this session** (i.e., have a `SessionParticipant` record), not all enrolled students.

**API:**

```
GET /api/teacher/sessions/{code}/activity?studentId={userId}
```

The `studentId` parameter is the `User.Id` of the selected student. When omitted, all activity is returned.

### 3.2 — Activity Log: Type Filter

In addition to the student filter, the activity log is filterable by event type:

```
Type: [ All Types        ▼ ]
       ├─ All Types
       ├─ Submissions
       ├─ Connections (Joined/Disconnected/Reconnected)
       ├─ Progress (TestPassed/ChallengeCompleted)
       ├─ Suspicious (TabSwitched/CopyPaste/FullscreenExited)
       └─ Code Changes
```

Both filters work together (AND).

### 3.3 — Dashboard Scrollability

The live dashboard page itself must be scrollable. The layout from CODEFEST-SPEC §3.2 uses a fixed viewport split (student grid left, activity feed right, leaderboard bottom). For responsiveness:

- **Desktop (≥1200px):** Two-column layout. Student grid scrolls independently (virtual scroll for 30+ students). Activity feed scrolls independently. Leaderboard is a fixed-height bar at the bottom.
- **Tablet (768px–1199px):** Single column. Student grid → Activity feed → Leaderboard stacked vertically. The whole page scrolls.
- **Mobile (< 768px):** Tabbed navigation: [Students] [Activity] [Leaderboard] [Controls]. Each tab fills the viewport and scrolls independently.

---

## §4 — Student Session View (`/code`)

### 4.1 — Access Control

- The student must be authenticated via Google OAuth.
- The student must have an **active enrollment** (`Enrollment.Status = Active`) in the course associated with the session.
- On attempting to join a session (via code or link), the system checks: `Enrollment WHERE UserId = {student} AND CourseId = {session.CourseId} AND Status = Active`. If no match → rejection with message: *"You are not enrolled in the course for this session. Contact your instructor."*

### 4.2 — Activity Log on Student View

The student does **not** see a full activity log. However, the student view includes:

- **Their own submission history** for the current session (visible in a collapsible "My Submissions" panel)
- **Leaderboard** showing ranked students by points (display names only, no activity details about other students)
- **Hint/Broadcast messages** from the teacher (displayed as toast notifications and in a message panel)

### 4.3 — Student View Scrollability

The student coding view must be fully scrollable:

- **Desktop:** Challenge description panel (left) + Code editor (center) + Test results (right). If viewport is too narrow, the layout wraps and the page scrolls vertically.
- **Tablet/Mobile:** Stacked vertically: Challenge description → Code editor → Test results → Leaderboard. Full page scroll. The code editor has a minimum height of 300px and uses `overflow-y: auto` internally for long code.

---

## §5 — Leaderboard Explained

### 5.1 — What Is the Leaderboard?

The **Leaderboard** is a real-time ranked list of all students in the current session, sorted by total points (descending). It serves as the **gamification** element that drives engagement during coding sessions.

### 5.2 — How Points Are Calculated

| Event | Points |
|-------|--------|
| Challenge completed (all tests pass) | `Challenge.Points` (default: 100) |
| Speed bonus | Up to 50% extra if completed in under half the time limit |
| First to complete | +25 bonus points for the first student to complete each challenge |
| Hint penalty | −10% of challenge points per hint used |

### 5.3 — Where It Appears

- **Teacher Dashboard:** A horizontal bar at the bottom of the live dashboard (CODEFEST-SPEC §3.2). Shows top 10 with points. Updates in real-time via SignalR `LeaderboardUpdated` event.
- **Student View:** A collapsible sidebar/panel showing their rank and the top 10. Updated in real-time.
- **End of Session:** Full-screen celebration view with final rankings, confetti animation (`canvas-confetti`), and sound effects (`howler`). Triggered by `SessionEnded` SignalR event.

### 5.4 — Data Model

```csharp
// DTOs/LeaderboardEntry.cs
public class LeaderboardEntry
{
    public int Rank { get; set; }
    public int UserId { get; set; }
    public string DisplayName { get; set; }     // From User (Google account)
    public int TotalPoints { get; set; }
    public int ChallengesCompleted { get; set; }
    public int TotalChallenges { get; set; }
    public bool IsCurrentUser { get; set; }     // For highlighting in student view
}
```

### 5.5 — API

```
GET /api/teacher/sessions/{code}/leaderboard
SignalR event: LeaderboardUpdated(List<LeaderboardEntry>)
```

---

## §6 — Broadcast & Hint Panel: Selected State Visibility Fix

### 6.1 — Problem

The current broadcast and hint panels use a background color for the selected/active state that is not visible (likely same as or too close to the panel background, or using a color with insufficient contrast).

### 6.2 — Fix

Apply these rules to the broadcast and hint panel selection states:

```scss
// In broadcast-panel.component.scss and any hint selection UI

// The active/selected tab or option
.panel-option {
  background: transparent;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s ease;

  &.selected,
  &:active,
  &[aria-selected="true"] {
    background: var(--primary-color, #1976d2);      // Solid primary blue
    color: #ffffff;                                   // White text for contrast
    border-color: var(--primary-color, #1976d2);
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.25); // Focus ring

    // Ensure icons inside also flip color
    .mat-icon, svg {
      color: #ffffff;
      fill: #ffffff;
    }
  }

  &:hover:not(.selected) {
    background: var(--hover-bg, rgba(25, 118, 210, 0.08));
    border-color: var(--primary-color, #1976d2);
  }
}

// Dark theme override
:host-context(.dark-theme) .panel-option {
  &.selected {
    background: var(--primary-color-dark, #42a5f5);
    color: #000000;
  }
}
```

**WCAG contrast requirement:** Selected state must have at least 4.5:1 contrast ratio between text and background. The blue (#1976d2) + white (#ffffff) combination gives 4.56:1, which passes AA.

### 6.3 — Affected Components

- `broadcast-panel.component.ts` — the "Broadcast" vs "Hint" mode toggle
- Any toggle between "Send to all" vs "Send to specific student"
- The challenge selector in hint mode (which challenge to hint about)

---

## §7 — Responsive Design Specification

Both the Teacher Sessions screen and Student Session view must be responsive across all platforms (web browser, Android/Capacitor, Electron/Windows).

### 7.1 — Breakpoints

| Breakpoint | Range | Layout |
|------------|-------|--------|
| **Mobile** | < 768px | Single column, stacked, tabbed navigation for complex views |
| **Tablet** | 768px – 1199px | Condensed table (some columns hidden), collapsible panels |
| **Desktop** | ≥ 1200px | Full table with all columns, multi-column dashboard |

### 7.2 — Teacher Sessions Table Responsive Behavior

**Mobile (< 768px):**
- Table transforms into a **card list**. Each session is a card showing: name, course badge, status badge, progress bar, and an expand chevron.
- Checkboxes move into a "selection mode" toggle (long-press or toolbar button to enter selection mode, then tap cards to select).
- Filters collapse into a single "Filter" button that opens a bottom sheet.
- Bulk actions bar sticks to the bottom of the screen.

**Tablet (768px – 1199px):**
- Table remains but hides "Created" and "Join Code" columns (accessible via row expansion or overflow menu).
- Column widths compress proportionally.
- Filters remain visible but use icon-only buttons with tooltips for space savings.

**Desktop (≥ 1200px):**
- Full table as specified in §2.4.

### 7.3 — Student Session View Responsive Behavior

**Mobile (< 768px):**
- Challenge description, code editor, and test results are in a **swipeable tab layout** or an accordion:
  - Tab 1: Challenge description
  - Tab 2: Code editor (full width, min-height: 300px)
  - Tab 3: Test results + submissions
  - Tab 4: Leaderboard
- The "Run" and "Submit" buttons float at the bottom of the screen as a sticky bar.
- The interactive console (from CODEFEST-INTERACTIVE-CONSOLE-SPEC) renders as a bottom sheet.

**Tablet (768px – 1199px):**
- Two-column: Challenge description (left, 35%) + Code editor (right, 65%).
- Test results and leaderboard are in a collapsible drawer below the editor.

**Desktop (≥ 1200px):**
- Three-panel layout as originally specified: challenge (left), editor (center), results (right).

### 7.4 — Touch Targets

All interactive elements (buttons, checkboxes, expand chevrons, filter dropdowns) must have a minimum touch target of **44×44px** per WCAG 2.5.5 for mobile/tablet.

---

## §8 — Component Architecture

### 8.1 — New/Modified Angular Components

```
features/teacher/
├── sessions-list/
│   ├── sessions-list.component.ts          # NEW: table + filters + bulk actions
│   ├── sessions-list.component.html
│   ├── sessions-list.component.scss
│   ├── session-row/
│   │   └── session-row.component.ts        # NEW: expandable row with nested students
│   ├── session-filters/
│   │   └── session-filters.component.ts    # NEW: course/status/progress/search filters
│   └── bulk-actions-bar/
│       └── bulk-actions-bar.component.ts   # NEW: appears when checkboxes selected
├── session-dashboard/                       # EXISTING (CODEFEST-SPEC §3)
│   ├── activity-feed/
│   │   └── activity-feed.component.ts      # MODIFIED: add student + type filter dropdowns
│   ├── leaderboard-panel/
│   │   └── leaderboard-panel.component.ts  # EXISTING: no changes
│   ├── broadcast-panel/
│   │   └── broadcast-panel.component.ts    # MODIFIED: fix selected state colors
│   └── student-grid/
│       └── student-grid.component.ts       # EXISTING: no changes
└── ...

features/coding/                             # Student view
├── coding.component.ts                      # MODIFIED: responsive layout
├── leaderboard/
│   └── leaderboard.component.ts            # EXISTING: student-facing leaderboard
└── ...
```

### 8.2 — New Services

```typescript
// core/services/session-list.service.ts
@Injectable({ providedIn: 'root' })
export class SessionListService {
  getSessions(filters: SessionFilters): Observable<PaginatedResult<SessionListItem>>;
  getSessionDetail(code: string): Observable<SessionDetail>;
  bulkEndSessions(codes: string[]): Observable<void>;
  bulkDeleteSessions(codes: string[]): Observable<void>;
}

// core/models/session-list.model.ts
export interface SessionFilters {
  courseId?: number;
  status?: 'Lobby' | 'Active' | 'Paused' | 'Ended';
  progress?: 'NotStarted' | 'InProgress' | 'Completed';
  search?: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

export interface SessionListItem {
  id: number;
  name: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  code: string;
  status: SessionStatus;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  challengeCount: number;
  enrolledCount: number;
  participantCount: number;
  completedCount: number;
}

export interface SessionParticipantDetail {
  userId: number;
  displayName: string;
  email: string;
  connectionStatus: 'online' | 'offline' | 'flagged';
  currentChallengeIndex: number;
  totalPoints: number;
  submissionCount: number;
  joinedAt: string;
  flags: string[];   // ['tab_switch', 'paste_detected', ...]
}
```

---

## §9 — Routing

```typescript
// app.routes.ts additions
{
  path: 'teacher',
  canActivate: [teacherGuard],
  children: [
    { path: '', redirectTo: 'sessions', pathMatch: 'full' },
    { path: 'sessions', component: SessionsListComponent },
    { path: 'sessions/:code', component: SessionDashboardComponent },  // live dashboard
  ]
}
```

The teacher's default landing page after login is now `/teacher/sessions` (the sessions list), not the live dashboard directly. The live dashboard is accessed by clicking a specific session row or navigating to `/teacher/sessions/{code}`.

---

## §10 — Database Changes

### 10.1 — Session Table Modifications

No new tables are needed beyond what CODEFEST-AUTH-COURSES-SPEC defined. However, the `Session` model gains computed properties for the sessions list view:

```csharp
// In SessionService or via SQL projection
public class SessionListProjection
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int CourseId { get; set; }
    public string CourseCode { get; set; }       // JOIN Course
    public string CourseName { get; set; }       // JOIN Course
    public string Code { get; set; }
    public SessionStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int ChallengeCount { get; set; }      // COUNT of session's challenges
    public int EnrolledCount { get; set; }       // COUNT of active enrollments for CourseId
    public int ParticipantCount { get; set; }    // COUNT of SessionParticipant for this session
    public int CompletedCount { get; set; }      // COUNT of participants who completed all challenges
}
```

### 10.2 — Indexes for Performance

```sql
-- For the sessions list query (filtered by instructor's courses)
CREATE INDEX IX_Session_CourseId_Status ON Sessions (CourseId, Status);

-- For activity log student filter
CREATE INDEX IX_ActivityLog_SessionId_StudentId ON ActivityLogs (SessionId, StudentId, Timestamp DESC);

-- For enrollment check on session join
CREATE INDEX IX_Enrollment_UserId_CourseId_Status ON Enrollments (UserId, CourseId, Status);
```

---

## §11 — SignalR Events (Additions)

No new SignalR events are required. The existing events from CODEFEST-SPEC §1.7 cover all real-time needs. The activity log filtering (by student, by type) is handled client-side by filtering the incoming `ActivityLogged` events, or server-side via the REST API for historical data.

---

## §12 — Testing Requirements

### 12.1 — Unit Tests (Jasmine/Karma)

| # | Test | Component |
|---|------|-----------|
| 1 | Sessions table renders with correct columns | SessionsListComponent |
| 2 | Header checkbox toggles all visible row checkboxes | SessionsListComponent |
| 3 | Indeterminate state when some rows selected | SessionsListComponent |
| 4 | Course filter updates table data | SessionFiltersComponent |
| 5 | Status filter updates table data | SessionFiltersComponent |
| 6 | Progress filter updates table data | SessionFiltersComponent |
| 7 | Text search debounces and filters | SessionFiltersComponent |
| 8 | Row expansion shows nested student table | SessionRowComponent |
| 9 | Row collapse hides nested student table | SessionRowComponent |
| 10 | Bulk actions bar appears when checkboxes selected | BulkActionsBarComponent |
| 11 | Bulk end triggers confirmation and API call | BulkActionsBarComponent |
| 12 | Activity log student filter shows only session participants | ActivityFeedComponent |
| 13 | Activity log type filter works correctly | ActivityFeedComponent |
| 14 | Broadcast panel selected state has correct contrast | BroadcastPanelComponent |
| 15 | Leaderboard renders ranked students correctly | LeaderboardComponent |

### 12.2 — Integration Tests (xUnit + WebApplicationFactory)

| # | Test |
|---|------|
| 1 | `GET /api/teacher/sessions` returns only sessions for instructor's courses |
| 2 | `GET /api/teacher/sessions` with courseId filter returns correct subset |
| 3 | `GET /api/teacher/sessions` with status filter returns correct subset |
| 4 | `GET /api/teacher/sessions/{code}` returns participants with enrollment check |
| 5 | `GET /api/teacher/sessions/{code}/activity?studentId={id}` filters correctly |
| 6 | SuperAdmin can see all sessions across all courses |
| 7 | Instructor cannot see sessions for courses not in their AcademicLoad |
| 8 | Non-enrolled student is rejected when joining a session |
| 9 | `POST /api/teacher/sessions/bulk-end` ends only valid sessions |
| 10 | Pagination and sorting work correctly |

### 12.3 — E2E Tests (Playwright)

| # | Test |
|---|------|
| 1 | Teacher logs in → sees sessions list → filters by course → sees correct sessions |
| 2 | Teacher selects multiple sessions → bulk ends them → status updates |
| 3 | Teacher expands a session row → sees student details → collapses row |
| 4 | Teacher opens live dashboard → filters activity by student → sees only that student's events |
| 5 | Student joins session → appears in teacher's expanded view |
| 6 | Non-enrolled student tries to join → sees rejection message |
| 7 | Responsive: sessions table converts to cards on mobile viewport |
| 8 | Broadcast panel selected state is visually distinct |

---

## §13 — Implementation Priority

### Phase 1: Sessions List Table (3 days)
- Sessions table component with all columns
- Checkbox selection (header + rows)
- Sorting
- Pagination

### Phase 2: Filters + Bulk Actions (2 days)
- Course, status, progress, text filters
- Bulk actions bar (end, delete)

### Phase 3: Expandable Rows (2 days)
- Row expansion/collapse
- Nested student table
- "Enrolled but not joined" count

### Phase 4: Activity Log Filters (1 day)
- Student dropdown filter on activity feed
- Activity type dropdown filter
- API integration

### Phase 5: Responsive + Fixes (2 days)
- Mobile card layout for sessions
- Tablet compressed table
- Student view responsive stacking
- Broadcast/hint selected state color fix

---

## §14 — Claude CLI Prompts

### For implementing the Sessions List Table:

```
You are implementing the CodeFest Teacher Sessions List screen in Angular 17+.
Read the specs: CODEFEST-SPEC.md, CODEFEST-AUTH-COURSES-SPEC.md, CODEFEST-SESSIONS-UI-SPEC.md.
Focus on §2 (Teacher Sessions Screen) and §8 (Component Architecture).
The sessions are displayed in a data table with checkboxes, expandable rows,
filters (course, status, progress, search), bulk actions, and pagination.
Sessions are scoped to the instructor's AcademicLoad courses.
Use Angular Material or PrimeNG for the table. Ensure the page is fully scrollable.
Implement SessionsListComponent, SessionRowComponent, SessionFiltersComponent, BulkActionsBarComponent.
```

### For implementing the Activity Log Filters:

```
You are modifying the CodeFest Activity Feed component in the Teacher Dashboard.
Read: CODEFEST-SESSIONS-UI-SPEC.md §3.1 and §3.2.
Add two filter dropdowns: (1) student filter populated from SessionParticipants,
(2) activity type filter. Both filters AND together.
The student filter dropdown only shows students who joined the session.
Use the existing GET /api/teacher/sessions/{code}/activity endpoint with new
?studentId= and ?type= query parameters.
```

### For fixing the Broadcast/Hint selected state:

```
Fix the selected/active state background color on the Broadcast and Hint panels.
Read: CODEFEST-SESSIONS-UI-SPEC.md §6.
The selected state must use a solid primary color (#1976d2) with white text
for WCAG AA contrast (4.5:1 minimum). Apply to both light and dark themes.
```
