# CodeFest Interactive Console — Web & Mobile Platform Adaptation Spec

**Project:** CodeFest — Interactive Coding Challenge Platform  
**Scope:** Platform-specific behavior for the interactive console across web browsers and Android Capacitor kiosk  
**Companion to:** `CODEFEST-INTERACTIVE-CONSOLE-SPEC.md` (core feature), `CODEFEST-SPEC.md` (Phase 2 web client, Phase 4 Android kiosk)  
**Status:** Supplement — apply after the core interactive console feature is implemented  
**Audience:** CLI agent implementing the feature. Read this after finishing the core spec. Every section is a concrete delta on existing files.

---

## 1. Why This Spec Exists

The core interactive console spec (`CODEFEST-INTERACTIVE-CONSOLE-SPEC.md`) was written primarily around the desktop browser experience. It mentions mobile in passing — "terminal is a full-screen tab" — but doesn't specify:

- How the terminal layout actually works on small screens (phone, tablet, Android kiosk)
- How the soft keyboard interacts with the terminal input
- How xterm.js behaves inside Capacitor's Android WebView
- What happens to the interactive run when the kiosk service detects fullscreen exit or tab switch
- How SignalR reconnection affects a running program
- Browser compatibility issues (Safari WebSocket quirks, Firefox keyboard handling)
- Touch-specific interactions (no right-click, no hover, no Ctrl+Enter)

This spec fills every gap. Each section describes the problem, the solution, the files to change, and the tests to write.

---

## 2. Responsive Layout — Three Breakpoints

### 2.1 Breakpoint Definitions

| Breakpoint | Width | Devices | Layout Strategy |
|-----------|-------|---------|-----------------|
| Desktop | ≥1024px | Laptops, desktops, iPads landscape | Side-by-side panels, terminal below editor |
| Tablet | 600–1023px | Tablets portrait, large phones landscape | Stacked panels, terminal below editor (narrower) |
| Phone | <600px | Phones portrait, Android kiosk on small tablets | Full-screen tabs, terminal is its own tab |

### 2.2 Desktop Layout (≥1024px) — Already Specified

```
┌─────────────────────────────────────────────────────────────┐
│  Timer  │  Challenge 2/5: Sum Machine  │  150 pts  │ ● ● ○ │
├─────────────────────┬───────────────────────────────────────┤
│                     │  Code Editor (CodeMirror 6)           │
│  Challenge          │                                       │
│  Description        ├───────────────────────────────────────┤
│  (40%)              │  Terminal Panel (35% of right area)    │
│                     │  (hidden until first Run)              │
├─────────────────────┴───────────────────────────────────────┤
│  [▶ Run]  [■ Stop]                           [✓ Submit]     │
└─────────────────────────────────────────────────────────────┘
```

No changes needed. This is what the core spec describes.

### 2.3 Tablet Layout (600–1023px) — New

On tablets, the side-by-side layout gets cramped. Challenge description stacks above the editor, and the terminal slides below the editor. The whole view becomes vertically scrollable.

```
┌─────────────────────────────────────────────┐
│  Timer  │  Challenge 2/5  │  150 pts        │
├─────────────────────────────────────────────┤
│  Challenge Description (collapsible)        │
│  [tap to collapse ▲]                        │
├─────────────────────────────────────────────┤
│                                             │
│  Code Editor (CodeMirror 6)                 │
│  (min-height: 250px)                        │
│                                             │
├─────────────────────────────────────────────┤
│  Terminal Panel                             │
│  (min-height: 150px, hidden until Run)      │
│                                             │
├─────────────────────────────────────────────┤
│  [▶ Run]  [■ Stop]            [✓ Submit]    │
└─────────────────────────────────────────────┘
```

**Key behaviors:**
- Challenge description is collapsible — tap a chevron to fold it to a single-line summary ("Challenge 2/5: Sum Machine"). This gives more vertical space to the editor + terminal.
- Terminal panel appears between the editor and the bottom bar on first Run. It's not resizable on tablet — fixed at 35% of the viewport height (minus top bar and bottom bar).
- The editor and terminal scroll as a unit within the content area. The top bar and bottom bar are sticky.

**File changes:**

```
features/coding/coding.component.scss    — add tablet breakpoint rules
features/coding/challenge-panel/
  challenge-panel.component.ts           — add collapse toggle
  challenge-panel.component.scss         — collapsible animation
```

### 2.4 Phone Layout (<600px) — New

On phones, there's no room for stacked panels. The coding view becomes a **tabbed interface** with three tabs: Challenge, Code, Terminal.

```
┌─────────────────────────────────────────────┐
│  Timer: 04:32  │  Sum Machine  │  150 pts   │
├────────┬────────┬───────────────────────────┤
│ Challenge │ Code │ Terminal                  │  ← tab bar
├────────┴────────┴───────────────────────────┤
│                                             │
│  (active tab fills full viewport height)    │
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│  [▶ Run]  [■ Stop]            [✓ Submit]    │
└─────────────────────────────────────────────┘
```

**Key behaviors:**
- Tab bar sits directly below the top bar. Three tabs: "Challenge", "Code", "Terminal".
- "Terminal" tab has a badge (red dot) when there's new unread output since the student last viewed it.
- Swipe left/right between tabs (use Angular CDK `cdkDrag` or a lightweight swipe library — NOT a heavy carousel).
- When student clicks [▶ Run] while on the Code tab, auto-switch to the Terminal tab.
- When the terminal receives `RunWaiting` (needs input) and the student is NOT on the Terminal tab, pulse the Terminal tab badge and show a small toast: "Program is waiting for your input".
- The bottom bar ([▶ Run] / [■ Stop] / [✓ Submit]) is always visible regardless of active tab. Sticky at the bottom.

**File changes:**

```
features/coding/coding.component.ts      — add tab state management
features/coding/coding.component.html    — add tab bar + swipe container
features/coding/coding.component.scss    — phone breakpoint, tab styles
features/coding/terminal/
  terminal.component.ts                  — emit unread badge signal
shared/components/
  tab-bar/tab-bar.component.ts           — NEW reusable tab bar
  tab-bar/tab-bar.component.scss
  tab-bar/tab-bar.component.html
```

### 2.5 Responsive SCSS Structure

Add to `coding.component.scss`:

```scss
// ═══ BREAKPOINTS ═══════════════════════════════════════════

$phone-max: 599px;
$tablet-min: 600px;
$tablet-max: 1023px;
$desktop-min: 1024px;

// ═══ DESKTOP (≥1024px) — existing layout, no changes ═══

@media (min-width: $desktop-min) {
  .coding-layout {
    display: grid;
    grid-template-columns: 40% 60%;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
    
    .top-bar     { grid-column: 1 / -1; }
    .challenge   { grid-row: 2; }
    .editor-area { grid-row: 2; display: flex; flex-direction: column; }
    .bottom-bar  { grid-column: 1 / -1; }
  }
  
  .terminal-container {
    flex: 0 0 35%;
    min-height: 150px;
    max-height: 50vh;
    resize: vertical;
  }
}

// ═══ TABLET (600–1023px) ═══════════════════════════════════

@media (min-width: $tablet-min) and (max-width: $tablet-max) {
  .coding-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    
    .top-bar     { flex: 0 0 auto; }
    .challenge   { flex: 0 0 auto; max-height: 30vh; overflow-y: auto;
                   transition: max-height 0.3s ease;
                   &.collapsed { max-height: 40px; } }
    .editor-area { flex: 1 1 auto; min-height: 250px; }
    .terminal-container { flex: 0 0 35vh; min-height: 150px; }
    .bottom-bar  { flex: 0 0 auto; }
  }
}

// ═══ PHONE (<600px) ════════════════════════════════════════

@media (max-width: $phone-max) {
  .coding-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    
    .top-bar    { flex: 0 0 auto; }
    .tab-bar    { flex: 0 0 auto; display: flex; }  // hidden on desktop/tablet
    .tab-content { flex: 1 1 auto; overflow: hidden;
                   position: relative;
                   // Each tab is position: absolute, full size
                   .tab-pane { position: absolute; inset: 0;
                               overflow-y: auto;
                               visibility: hidden; opacity: 0;
                               transition: opacity 0.2s;
                               &.active { visibility: visible; opacity: 1; } } }
    .bottom-bar { flex: 0 0 auto; }
  }
  
  // Hide tab bar on desktop/tablet
  .tab-bar { display: none; }
}
```

---

## 3. Soft Keyboard Handling (Touch Devices)

### 3.1 The Problem

On phones and tablets, when the terminal needs input (`RunWaiting`), tapping the terminal area should bring up the soft keyboard so the student can type. But xterm.js's built-in input handling doesn't work well with mobile soft keyboards:

- xterm.js uses a hidden `<textarea>` for input capture. On Android, this textarea may not trigger the soft keyboard reliably inside a Capacitor WebView.
- The soft keyboard pushes the viewport up, potentially hiding the terminal output (the student can't see what they typed).
- When the keyboard opens, the bottom bar ([▶ Run] / [■ Stop] / [✓ Submit]) may get pushed off screen or overlap the terminal.

### 3.2 Solution: Dedicated Mobile Input Field

On touch devices (detected via `'ontouchstart' in window` or `navigator.maxTouchPoints > 0`), we **do not rely on xterm.js's built-in keyboard handling** for input. Instead, we overlay a native `<input>` field at the bottom of the terminal panel when the program is waiting for input.

```
┌──────────────────────────────────────────┐
│ Terminal                        [■ Stop] │
├──────────────────────────────────────────┤
│                                          │
│  Enter your name: █                      │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  ┌──────────────────────────────┐ [Send] │  ← mobile input bar
│  │ Type your input here...      │        │     (visible only when WaitingForInput)
│  └──────────────────────────────┘        │
├──────────────────────────────────────────┤
│  [▶ Run]  [■ Stop]        [✓ Submit]     │
└──────────────────────────────────────────┘
```

**Key behaviors:**
- The mobile input bar is ONLY shown on touch devices AND only when the run state is `WaitingForInput`.
- The `<input>` field auto-focuses when it appears, which triggers the soft keyboard.
- Student types input, then either taps [Send] or presses Enter on the soft keyboard.
- After sending, the mobile input bar hides, the input is echoed in the terminal, and the program continues.
- The mobile input bar is positioned above the bottom bar (Run/Stop/Submit) using `position: sticky` so it stays visible even if the keyboard pushes the viewport.

### 3.3 Viewport Resize on Keyboard Open

When the soft keyboard opens, the browser viewport shrinks. We need to handle this:

```typescript
// features/coding/terminal/terminal.component.ts — additions

private setupViewportResize(): void {
  if (!this.isTouchDevice()) return;
  
  // Use visualViewport API (supported on all modern mobile browsers)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      this.onViewportResize();
    });
  }
}

private onViewportResize(): void {
  // When soft keyboard opens, visualViewport.height shrinks.
  // We need to:
  // 1. Shrink the terminal to fit the remaining space
  // 2. Ensure the input field stays visible
  // 3. Re-fit xterm.js to the new dimensions
  
  const vv = window.visualViewport;
  if (!vv) return;
  
  const keyboardHeight = window.innerHeight - vv.height;
  
  if (keyboardHeight > 100) {
    // Keyboard is open
    this.terminalContainer.nativeElement.style.maxHeight = 
      `${vv.height - 120}px`;  // 120px for top bar + bottom bar + input bar
    this.fitAddon.fit();
  } else {
    // Keyboard is closed
    this.terminalContainer.nativeElement.style.maxHeight = '';
    this.fitAddon.fit();
  }
}

private isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
```

### 3.4 CSS for Mobile Input Bar

```scss
// features/coding/terminal/terminal.component.scss — additions

.mobile-input-bar {
  display: none;  // Hidden by default
  
  @media (max-width: $phone-max), (pointer: coarse) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: #2D2D2D;
    border-top: 1px solid #444;
    
    &.hidden { display: none; }
    
    input {
      flex: 1;
      padding: 8px 12px;
      font-size: 16px;  // ≥16px prevents iOS zoom on focus
      font-family: 'JetBrains Mono', Consolas, monospace;
      background: #1E1E1E;
      border: 1px solid #555;
      border-radius: 4px;
      color: #4FC3F7;
      outline: none;
      
      &:focus {
        border-color: #4FC3F7;
      }
      
      // Prevent iOS autocorrect/autocapitalize on code input
      -webkit-text-size-adjust: none;
    }
    
    .send-btn {
      flex: 0 0 auto;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 600;
      background: #4FC3F7;
      color: #1E1E1E;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      
      &:active {
        background: #29B6F6;
      }
    }
  }
}
```

### 3.5 HTML Addition to Terminal Component

```html
<!-- features/coding/terminal/terminal.component.html — additions -->

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
  
  <!-- Mobile input bar — only visible on touch devices when waiting for input -->
  <div class="mobile-input-bar" 
       [class.hidden]="!showMobileInput"
       data-testid="mobile-input-bar">
    <input #mobileInput
           type="text"
           placeholder="Type your input..."
           [value]="mobileInputValue"
           (input)="mobileInputValue = $event.target.value"
           (keydown.enter)="submitMobileInput()"
           autocomplete="off"
           autocorrect="off"
           autocapitalize="off"
           spellcheck="false"
           data-testid="mobile-input-field" />
    <button class="send-btn" 
            (click)="submitMobileInput()"
            data-testid="mobile-send-button">
      Send
    </button>
  </div>
</div>
```

### 3.6 TypeScript Additions

```typescript
// features/coding/terminal/terminal.component.ts — additions

// New properties
showMobileInput = false;
mobileInputValue = '';
@ViewChild('mobileInput') mobileInputRef?: ElementRef<HTMLInputElement>;

// Modify handleRunEvent to show mobile input
private handleRunEvent(event: RunEvent): void {
  switch (event.type) {
    // ... existing cases ...
    
    case 'waiting':
      if (this.isTouchDevice()) {
        this.showMobileInput = true;
        // Auto-focus after Angular change detection
        setTimeout(() => this.mobileInputRef?.nativeElement.focus(), 100);
      } else {
        this.enableInputMode();  // Desktop: xterm.js keyboard capture
      }
      break;
      
    case 'inputEcho':
      this.showMobileInput = false;
      this.mobileInputValue = '';
      // ... existing terminal echo logic ...
      break;
      
    case 'finished':
    case 'error':
      this.showMobileInput = false;
      this.mobileInputValue = '';
      // ... existing logic ...
      break;
  }
}

submitMobileInput(): void {
  const input = this.mobileInputValue;
  this.mobileInputValue = '';
  this.showMobileInput = false;
  
  // Echo in terminal
  this.terminal.write(`\x1b[36m${input}\x1b[0m\n`);
  
  // Send to server
  this.signalr.sendRunInput(this.session.currentSessionCode, input);
}
```

---

## 4. Android Capacitor WebView — Kiosk Integration

### 4.1 xterm.js in Capacitor WebView

Capacitor uses Android's `WebView` component, which is based on Chromium. xterm.js works in Chromium-based WebViews, but there are specific issues to handle:

**Issue 1: WebGL renderer not available**

xterm.js v5 uses a WebGL renderer by default for performance. Some Android WebViews have WebGL disabled or partially supported. Force the canvas (DOM) renderer:

```typescript
// features/coding/terminal/terminal.component.ts — modify initTerminal()

this.terminal = new Terminal({
  // ... existing options ...
  
  // Force canvas renderer in Capacitor WebView
  // WebGL is unreliable in Android WebView
  rendererType: this.isCapacitor() ? 'canvas' : undefined  // undefined = auto-detect
});

private isCapacitor(): boolean {
  return !!(window as any).Capacitor;
}
```

**Issue 2: Touch scrolling inside xterm.js**

xterm.js captures touch events for text selection. On Android, this conflicts with the native scroll-to-dismiss-keyboard gesture. Configure xterm.js to only capture touch for selection when there's a text selection active:

```typescript
// After terminal.open():
if (this.isTouchDevice()) {
  // Allow touch scrolling through to the parent
  this.terminal.options.scrollOnUserInput = false;
}
```

**Issue 3: Copy/paste in WebView**

Android WebView's long-press-to-copy may not work inside xterm.js's canvas. Add a manual "Copy Output" button in the terminal header for mobile:

```html
<!-- Add to terminal-header actions, only on touch devices -->
<button class="btn-terminal" 
        *ngIf="isTouchDevice()" 
        (click)="copyOutput()"
        title="Copy terminal output">
  Copy
</button>
```

```typescript
copyOutput(): void {
  // Extract all text from xterm.js buffer
  const buffer = this.terminal.buffer.active;
  let text = '';
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (line) text += line.translateToString(true) + '\n';
  }
  
  navigator.clipboard.writeText(text.trim()).then(() => {
    // Brief visual feedback
    // (toast or button text change: "Copied!")
  });
}
```

### 4.2 Kiosk Service Interaction

The existing kiosk service (`kiosk.service.ts`) detects fullscreen exit and tab switches. The interactive console needs to work alongside it:

**Scenario 1: Student exits fullscreen while program is running**

The kiosk service shows a warning overlay ("Return to fullscreen"). The terminal and the running program should NOT be affected — the program keeps running in the background. When the student returns to fullscreen, they see the terminal exactly as they left it (output continued accumulating).

**No code change needed** — the terminal is part of the Angular component tree and persists through overlay visibility changes. Just verify this in tests.

**Scenario 2: Tab switch detected while program is running**

If the student switches tabs (browser) or switches apps (Android), the kiosk service logs `TabSwitched`. The running program continues on the server. When the student returns, accumulated output appears in the terminal.

**Potential issue:** SignalR may buffer messages while the tab is backgrounded. On tab return, all buffered `RunOutput` events arrive at once. The terminal should handle this gracefully — xterm.js will render all output instantly, which may cause a brief visual flash of scrolling text.

**Mitigation:** On `visibilitychange` → `visible`, scroll the terminal to the bottom:

```typescript
// features/coding/terminal/terminal.component.ts — additions

ngOnInit(): void {
  // ... existing init ...
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Scroll to bottom to catch up on buffered output
      this.terminal.scrollToBottom();
      this.fitAddon.fit();
    }
  });
}
```

**Scenario 3: Lock task mode (Device Owner) on Android**

In lock task mode, the student cannot switch apps at all — the system buttons are disabled. The kiosk service's `TabSwitched` event will never fire. The terminal works normally. **No special handling needed.**

**Scenario 4: Teacher pauses session while student is on Android kiosk**

This is already specified in the core spec (§7.7): all active runs are killed on pause. The Android app receives the `SessionPaused` SignalR event just like the web client. The terminal shows "Session paused — run stopped." **No platform-specific change needed.**

### 4.3 Capacitor Plugin: Keyboard Control

On Android kiosk mode, the system soft keyboard can sometimes get stuck or fail to appear inside the WebView. Add a Capacitor plugin method to force-show/hide the keyboard:

```typescript
// capacitor-plugin addition to LockTaskPlugin

// In Angular, when terminal needs input on Android:
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

// When RunWaiting fires on Android:
if (Capacitor.isNativePlatform()) {
  await Keyboard.show();  // Force soft keyboard open
}

// When run finishes:
if (Capacitor.isNativePlatform()) {
  await Keyboard.hide();
}
```

Add `@capacitor/keyboard` to dependencies:

```bash
cd codefest-client
npm install @capacitor/keyboard
npx cap sync android
```

### 4.4 Android WebView Configuration

Add to `capacitor.config.ts`:

```typescript
// capacitor.config.ts — additions

const config: CapacitorConfig = {
  // ... existing config ...
  
  android: {
    // Allow mixed content (HTTP API on local network)
    allowMixedContent: true,
    
    // WebView settings for terminal
    webContentsDebuggingEnabled: true,  // Remove in production
    
    // Keyboard behavior
    keyboard: {
      resize: 'native',       // Let Android handle viewport resize
      style: 'dark',           // Dark keyboard to match terminal theme
    }
  },
  
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true  // Resize viewport when keyboard opens in fullscreen
    }
  }
};
```

---

## 5. Browser Compatibility

### 5.1 Compatibility Matrix

| Feature | Chrome 90+ | Firefox 90+ | Safari 15+ | Android WebView (Capacitor) | Notes |
|---------|-----------|------------|-----------|---------------------------|-------|
| xterm.js rendering | ✅ WebGL | ✅ WebGL | ✅ Canvas | ✅ Canvas (forced) | Safari: WebGL sometimes flickers; xterm auto-falls back to canvas |
| SignalR WebSocket | ✅ | ✅ | ✅ | ✅ | All support RFC 6455 |
| SignalR Long Polling fallback | ✅ | ✅ | ✅ | ✅ | Fallback if WebSocket blocked by proxy |
| `visualViewport` API | ✅ | ✅ | ✅ | ✅ | For soft keyboard detection |
| `ResizeObserver` | ✅ | ✅ | ✅ | ✅ | For terminal resize |
| Clipboard API | ✅ | ✅ | ⚠️ Requires user gesture | ✅ | Safari: `navigator.clipboard.writeText()` only works from click handler |
| `Ctrl+Enter` shortcut | ✅ | ✅ | ✅ `Cmd+Enter` | N/A (no keyboard) | |

### 5.2 Safari-Specific Issues

**Issue 1: WebSocket idle timeout**

Safari aggressively closes idle WebSocket connections after ~30 seconds of no messages. During an interactive run where the student is thinking before typing input, the connection may drop.

**Solution:** SignalR's built-in keep-alive handles this. Verify the keep-alive interval is ≤15 seconds:

```csharp
// Program.cs — verify SignalR configuration
builder.Services.AddSignalR(options =>
{
    options.KeepAliveInterval = TimeSpan.FromSeconds(10);  // Ping every 10s
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
});
```

On the client side, verify `@microsoft/signalr` auto-reconnect is configured:

```typescript
// core/services/signalr.service.ts — verify reconnect config

this.connection = new HubConnectionBuilder()
  .withUrl('/hubs/codefest')
  .withAutomaticReconnect([0, 1000, 5000, 10000, 30000])  // Retry intervals
  .build();
```

**Issue 2: Clipboard in Safari**

`navigator.clipboard.writeText()` requires a user gesture (click/tap). The "Copy" button already provides this. But programmatic clipboard access (e.g., on Ctrl+C) won't work in Safari. **Acceptable limitation** — students can still select text manually and use Cmd+C.

**Issue 3: iOS Safari (if students use iPhones)**

iOS Safari's viewport handling is unique — the URL bar hides/shows when scrolling, changing the viewport height. Use `100dvh` instead of `100vh` for the coding layout:

```scss
.coding-layout {
  height: 100dvh;  // Dynamic viewport height — accounts for iOS Safari URL bar
  
  // Fallback for older browsers
  @supports not (height: 100dvh) {
    height: 100vh;
  }
}
```

### 5.3 Firefox-Specific Issues

**Issue 1: `Ctrl+Enter` conflicts**

Firefox uses `Ctrl+Enter` to auto-complete URLs in the address bar when the address bar is focused. Inside CodeMirror, this doesn't conflict because CodeMirror captures keyboard events. **No change needed.**

**Issue 2: Paste event in CodeMirror**

Firefox fires `paste` events differently from Chrome. The existing activity tracker (`activity-tracker.service.ts`) listens for paste events on the editor. Verify it works in Firefox — the `clipboardData` property name is the same across browsers since Firefox 63+. **No change needed, but add to browser test matrix.**

### 5.4 SignalR Transport Negotiation

In some classroom networks, WebSocket connections may be blocked by firewalls or HTTP proxies that don't support the `Upgrade` header. SignalR falls back to Server-Sent Events (SSE) or Long Polling.

**Impact on interactive console:**

| Transport | Latency | Interactive Run Impact |
|-----------|---------|----------------------|
| WebSocket | <50ms | Ideal — real-time output streaming |
| SSE + HTTP POST | 50–200ms | Acceptable — slight delay on output, input works via POST |
| Long Polling | 200–1000ms | Noticeable lag — output arrives in bursts, input has round-trip delay |

**For Long Polling:** The terminal output may appear "chunky" instead of character-by-character. The `SignalRTextWriter` already buffers and flushes on newline/50ms delay, so Long Polling will see batches of full lines rather than character-by-character. This is acceptable.

**Detection and notification:** If the transport falls back to Long Polling, show a subtle warning in the terminal header:

```typescript
// core/services/signalr.service.ts — additions

this.connection.onreconnected(() => {
  // Check transport type
  const transport = (this.connection as any).connection?.transport;
  if (transport?.name === 'LongPolling') {
    console.warn('SignalR fell back to Long Polling — expect higher latency');
    this.transportWarning$.next('Slow connection — output may be delayed');
  }
});
```

The terminal header can show this as a small amber icon with tooltip.

---

## 6. SignalR Reconnection During Interactive Run

### 6.1 The Scenario

Student is running a program interactively. The WiFi blips for 3 seconds. SignalR disconnects and reconnects. What happens?

### 6.2 Current Behavior (from core spec)

The core spec says: "If the student reconnects, they see a fresh idle state (no attempt to resume the previous run)." This is because `OnDisconnectedAsync` kills the run.

### 6.3 Problem: Auto-Reconnect Kills the Run

SignalR's `withAutomaticReconnect()` tries to reconnect within seconds. But between disconnect and reconnect, `OnDisconnectedAsync` fires on the server, killing the active run. When the student reconnects, their program is gone.

For a 2-second WiFi blip, this is a terrible experience — the student loses their interactive session for no good reason.

### 6.4 Solution: Grace Period Before Kill

Modify `OnDisconnectedAsync` to wait a grace period before killing the run:

```csharp
// Hubs/CodeFestHub.cs — modify OnDisconnectedAsync

public override async Task OnDisconnectedAsync(Exception? exception)
{
    var student = await _sessionService.GetStudentByConnectionAsync(Context.ConnectionId);
    if (student == null)
    {
        await base.OnDisconnectedAsync(exception);
        return;
    }
    
    // DON'T kill the run immediately — start a grace timer
    if (_interactiveRunService.HasActiveRun(student.Id))
    {
        _ = _interactiveRunService.StartDisconnectGracePeriodAsync(
            student.Id, 
            gracePeriodSeconds: 15);  // Wait 15 seconds before killing
    }
    
    // ... existing disconnect logic (mark offline, notify teacher) ...
    
    await base.OnDisconnectedAsync(exception);
}
```

Add to `InteractiveRunService`:

```csharp
// Services/InteractiveRunService.cs — additions

private readonly ConcurrentDictionary<int, CancellationTokenSource> _graceTimers = new();

/// <summary>
/// Start a grace period. If the student reconnects within this window,
/// their run continues. If not, the run is killed.
/// </summary>
public async Task StartDisconnectGracePeriodAsync(int studentId, int gracePeriodSeconds)
{
    // Cancel any existing grace timer for this student
    if (_graceTimers.TryRemove(studentId, out var existingCts))
        existingCts.Cancel();
    
    var graceCts = new CancellationTokenSource();
    _graceTimers[studentId] = graceCts;
    
    try
    {
        await Task.Delay(TimeSpan.FromSeconds(gracePeriodSeconds), graceCts.Token);
        
        // Grace period expired — student didn't reconnect. Kill the run.
        _graceTimers.TryRemove(studentId, out _);
        await StopRunAsync(studentId);
    }
    catch (OperationCanceledException)
    {
        // Student reconnected in time — do nothing, run continues
    }
}

/// <summary>
/// Student reconnected. Cancel the grace timer and update the connection ID
/// so output streams to the new connection.
/// </summary>
public void OnStudentReconnected(int studentId, string newConnectionId)
{
    // Cancel grace timer
    if (_graceTimers.TryRemove(studentId, out var graceCts))
        graceCts.Cancel();
    
    // Update the active session's connection ID
    if (_activeSessions.TryGetValue(studentId, out var session))
    {
        session.ConnectionId = newConnectionId;
        
        // Send a "RunResumed" event so the client knows the run is still alive
        _ = _hubContext.Clients.Client(newConnectionId)
            .SendAsync("RunResumed", session.State.ToString());
    }
}
```

Update the hub's reconnect handler:

```csharp
// In CodeFestHub — when a student joins/reconnects and already has an active run

// Called during re-join or when SignalR auto-reconnect succeeds:
public async Task ReconnectToRun(string sessionCode)
{
    var student = await _sessionService.GetStudentByConnectionAsync(Context.ConnectionId);
    if (student == null) return;
    
    _interactiveRunService.OnStudentReconnected(student.Id, Context.ConnectionId);
}
```

### 6.5 Client-Side Reconnection

On the Angular side, handle the `RunResumed` event:

```typescript
// core/services/signalr.service.ts — additions

this.connection.on('RunResumed', (state: string) => {
  // The run is still alive on the server after a reconnect
  if (state === 'WaitingForInput') {
    this.runState.handleRunWaiting();
  } else if (state === 'Running') {
    this.runState.handleRunStarted('resumed');
  }
});

this.connection.onreconnected(async () => {
  // Tell server we're back
  await this.connection.invoke('ReconnectToRun', this.session.currentSessionCode);
});
```

### 6.6 Terminal After Reconnect

When the student reconnects, output produced during the disconnect gap is lost (it was sent to the old connection ID and went nowhere). The terminal shows whatever was there before the disconnect, plus a reconnection message:

```typescript
// In terminal event handling:

this.connection.onreconnecting(() => {
  this.terminal.writeln('\x1b[33m⚠ Connection lost — reconnecting...\x1b[0m');
});

this.connection.onreconnected(() => {
  this.terminal.writeln('\x1b[32m✓ Reconnected\x1b[0m');
});
```

**Acceptable limitation:** Output generated during the disconnect gap (~2-15 seconds) is lost from the terminal display. The program continues running correctly on the server. For a classroom setting, this is fine.

---

## 7. Touch Interaction Specifics

### 7.1 No Right-Click Context Menu

On desktop, right-clicking the terminal shows the browser context menu (which the kiosk service disables). On mobile, long-press sometimes triggers a context menu or text selection. xterm.js handles this, but verify:

```typescript
// features/coding/terminal/terminal.component.ts — additions

if (this.isTouchDevice()) {
  this.terminalContainer.nativeElement.addEventListener('contextmenu', 
    (e: Event) => e.preventDefault());
}
```

### 7.2 No Hover Tooltips

Desktop terminal has hover tooltips (e.g., on the info icon about `Console.ReadKey()` limitation). On touch, replace hover tooltips with tap-to-toggle:

```scss
// Tooltip handling for touch
@media (pointer: coarse) {
  .tooltip-trigger {
    // On touch, tooltip appears on tap and dismisses on second tap or tap-elsewhere
    &.active .tooltip-content { display: block; }
    .tooltip-content { display: none; }
  }
}

@media (pointer: fine) {
  .tooltip-trigger:hover .tooltip-content { display: block; }
}
```

### 7.3 Touch Keyboard Shortcuts Replacement

Desktop uses `Ctrl+Enter` to run and `Ctrl+C` to stop. These don't exist on mobile. The buttons ([▶ Run], [■ Stop]) are the only controls. Make sure they're large enough for touch:

```scss
// Bottom bar button sizes on mobile
@media (max-width: $phone-max), (pointer: coarse) {
  .bottom-bar {
    padding: 8px 12px;
    
    .btn-run, .btn-stop, .btn-submit {
      min-height: 44px;   // Apple's minimum touch target
      min-width: 44px;
      font-size: 16px;
      padding: 10px 20px;
    }
  }
}
```

### 7.4 Swipe Gesture: Terminal Dismiss

On phone layout (tabbed), the student might want to quickly swipe from the Terminal tab back to the Code tab to fix something. Support swipe-right on the terminal tab to switch to Code tab:

```typescript
// features/coding/coding.component.ts — additions for phone layout

private setupSwipeNavigation(): void {
  if (window.innerWidth >= 600) return;  // Only on phone breakpoint
  
  let touchStartX = 0;
  const threshold = 50;  // px
  
  const container = this.tabContentRef.nativeElement;
  
  container.addEventListener('touchstart', (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  
  container.addEventListener('touchend', (e: TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        this.navigateToPreviousTab();  // Swipe right → previous tab
      } else {
        this.navigateToNextTab();      // Swipe left → next tab
      }
    }
  }, { passive: true });
}
```

---

## 8. Accessibility on Mobile

### 8.1 Screen Reader Announcements

When the terminal state changes, announce it for screen readers. This matters on mobile where screen readers like TalkBack (Android) and VoiceOver (iOS) are common:

```typescript
// features/coding/terminal/terminal.component.ts — additions

private announce(message: string): void {
  const announcer = document.getElementById('sr-announcer');
  if (announcer) {
    announcer.textContent = message;
  }
}

// Call from handleRunEvent:
case 'compiling':
  this.announce('Compiling your code');
  break;
case 'waiting':
  this.announce('Program is waiting for your input');
  break;
case 'finished':
  this.announce(`Program finished with exit code ${event.data}`);
  break;
case 'error':
  this.announce(`Error: ${event.data}`);
  break;
```

Add to `coding.component.html`:

```html
<!-- Screen reader live region -->
<div id="sr-announcer" 
     aria-live="assertive" 
     aria-atomic="true" 
     class="sr-only">
</div>
```

```scss
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### 8.2 Focus Management

On mobile, focus management is critical because the soft keyboard follows focus:

- When terminal opens and program outputs text (no input needed) → do NOT focus the terminal. Keep focus on the editor so the keyboard doesn't pop up.
- When `RunWaiting` fires → focus the mobile input field (triggers keyboard).
- When run finishes → return focus to the Run button (so the student can quickly re-run).
- When terminal tab becomes active (phone layout) → focus the terminal area for scrolling, but NOT the input field unless `WaitingForInput`.

```typescript
// features/coding/terminal/terminal.component.ts — focus management

private manageFocusOnStateChange(state: RunState): void {
  if (!this.isTouchDevice()) return;
  
  switch (state) {
    case RunState.WaitingForInput:
      // Focus mobile input field
      setTimeout(() => this.mobileInputRef?.nativeElement.focus(), 100);
      break;
    case RunState.Finished:
    case RunState.Error:
      // Return focus to run button
      const runBtn = document.querySelector<HTMLElement>('[data-testid="run-button"]');
      runBtn?.focus();
      break;
    default:
      // Don't steal focus
      break;
  }
}
```

---

## 9. Performance on Low-End Android Devices

### 9.1 The Reality

Classroom Android devices are often budget models (2GB RAM, quad-core Mediatek). The Angular app + CodeMirror + xterm.js is non-trivial.

### 9.2 Optimizations

**xterm.js scrollback buffer:** Reduce from 500 lines (desktop) to 200 lines on mobile:

```typescript
this.terminal = new Terminal({
  scrollback: this.isTouchDevice() ? 200 : 500,
  // ...
});
```

**Output throttling on slow devices:** If the server streams output faster than the terminal can render, frames pile up. Add a client-side throttle for `RunOutput` events:

```typescript
// core/services/signalr.service.ts — output throttling

private outputBuffer = '';
private outputFlushTimer: any = null;
private readonly OUTPUT_FLUSH_INTERVAL = 32;  // ~30fps

this.connection.on('RunOutput', (text: string) => {
  if (this.isLowEndDevice()) {
    // Buffer and flush at 30fps
    this.outputBuffer += text;
    if (!this.outputFlushTimer) {
      this.outputFlushTimer = setTimeout(() => {
        this.runState.handleRunOutput(this.outputBuffer);
        this.outputBuffer = '';
        this.outputFlushTimer = null;
      }, this.OUTPUT_FLUSH_INTERVAL);
    }
  } else {
    this.runState.handleRunOutput(text);
  }
});

private isLowEndDevice(): boolean {
  // Heuristic: check deviceMemory API or hardwareConcurrency
  const memory = (navigator as any).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  return (memory && memory <= 2) || (cores && cores <= 4);
}
```

**CodeMirror + xterm.js coexistence:** On phone layout, only one of CodeMirror or xterm.js is visible at a time (they're in different tabs). Set `display: none` on the inactive tab's content to prevent layout recalculation:

```scss
// Already handled by the tab pane CSS:
.tab-pane:not(.active) {
  visibility: hidden;
  // xterm.js and CodeMirror don't render when not visible
}
```

---

## 10. Testing Strategy — Platform-Specific Tests

All tests in this section are **in addition to** the 49 tests in the core interactive console spec.

### 10.1 Unit Tests — Soft Keyboard & Mobile Input

```typescript
// features/coding/terminal/terminal-mobile.spec.ts

describe('Terminal — Mobile Input', () => {
  let component: TerminalComponent;
  let runStateService: RunStateService;
  
  beforeEach(async () => {
    // Mock touch device
    spyOn(component as any, 'isTouchDevice').and.returnValue(true);
    // ... standard TestBed setup ...
  });
  
  it('should show mobile input bar when WaitingForInput on touch device', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    
    expect(component.showMobileInput).toBeTrue();
    const inputBar = fixture.nativeElement.querySelector('[data-testid="mobile-input-bar"]');
    expect(inputBar).toBeTruthy();
    expect(inputBar.classList.contains('hidden')).toBeFalse();
  });
  
  it('should NOT show mobile input bar on desktop', () => {
    spyOn(component as any, 'isTouchDevice').and.returnValue(false);
    
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    
    expect(component.showMobileInput).toBeFalse();
  });
  
  it('should hide mobile input bar after sending input', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    
    component.mobileInputValue = 'test input';
    component.submitMobileInput();
    fixture.detectChanges();
    
    expect(component.showMobileInput).toBeFalse();
    expect(component.mobileInputValue).toBe('');
  });
  
  it('should auto-focus mobile input field when WaitingForInput', fakeAsync(() => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    
    tick(150);  // Wait for setTimeout focus
    
    const input = fixture.nativeElement.querySelector('[data-testid="mobile-input-field"]');
    expect(document.activeElement).toBe(input);
  }));
  
  it('should send input on Send button tap', () => {
    const signalrSpy = TestBed.inject(SignalRService) as jasmine.SpyObj<SignalRService>;
    
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    
    component.mobileInputValue = 'Ali';
    const sendBtn = fixture.nativeElement.querySelector('[data-testid="mobile-send-button"]');
    sendBtn.click();
    
    expect(signalrSpy.sendRunInput).toHaveBeenCalledWith('ABC123', 'Ali');
  });
  
  it('should send input on Enter key in mobile input field', () => {
    const signalrSpy = TestBed.inject(SignalRService) as jasmine.SpyObj<SignalRService>;
    
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    
    component.mobileInputValue = 'keyboard enter';
    const input = fixture.nativeElement.querySelector('[data-testid="mobile-input-field"]');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    
    expect(signalrSpy.sendRunInput).toHaveBeenCalledWith('ABC123', 'keyboard enter');
  });
  
  it('should hide mobile input bar on run error', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    expect(component.showMobileInput).toBeTrue();
    
    runStateService.handleRunError('NullReferenceException');
    fixture.detectChanges();
    expect(component.showMobileInput).toBeFalse();
  });
  
  it('should hide mobile input bar on run finished', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    expect(component.showMobileInput).toBeTrue();
    
    runStateService.handleRunFinished(0);
    fixture.detectChanges();
    expect(component.showMobileInput).toBeFalse();
  });
});
```

### 10.2 Unit Tests — Responsive Layout

```typescript
// features/coding/coding-responsive.spec.ts

describe('Coding View — Responsive Layout', () => {
  
  it('should show tab bar on phone viewport', () => {
    // Set viewport width to phone
    viewport.set(375, 667);
    fixture.detectChanges();
    
    const tabBar = fixture.nativeElement.querySelector('.tab-bar');
    expect(getComputedStyle(tabBar).display).not.toBe('none');
  });
  
  it('should hide tab bar on desktop viewport', () => {
    viewport.set(1280, 800);
    fixture.detectChanges();
    
    const tabBar = fixture.nativeElement.querySelector('.tab-bar');
    expect(getComputedStyle(tabBar).display).toBe('none');
  });
  
  it('should show three tabs on phone: Challenge, Code, Terminal', () => {
    viewport.set(375, 667);
    fixture.detectChanges();
    
    const tabs = fixture.nativeElement.querySelectorAll('.tab-bar .tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent.trim()).toBe('Challenge');
    expect(tabs[1].textContent.trim()).toBe('Code');
    expect(tabs[2].textContent.trim()).toBe('Terminal');
  });
  
  it('should auto-switch to Terminal tab on Run (phone)', () => {
    viewport.set(375, 667);
    fixture.detectChanges();
    
    // Start on Code tab
    component.activeTab = 'code';
    fixture.detectChanges();
    
    // Trigger run
    runStateService.handleRunCompiling();
    fixture.detectChanges();
    
    expect(component.activeTab).toBe('terminal');
  });
  
  it('should show badge on Terminal tab when unread output (phone)', () => {
    viewport.set(375, 667);
    component.activeTab = 'code';  // Student is on Code tab
    fixture.detectChanges();
    
    runStateService.handleRunOutput('some output');
    fixture.detectChanges();
    
    const terminalTab = fixture.nativeElement.querySelector('.tab[data-tab="terminal"]');
    expect(terminalTab.querySelector('.badge')).toBeTruthy();
  });
  
  it('should show toast when WaitingForInput and not on Terminal tab (phone)', () => {
    viewport.set(375, 667);
    component.activeTab = 'code';
    fixture.detectChanges();
    
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    
    const toast = fixture.nativeElement.querySelector('.input-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('waiting for your input');
  });
  
  it('should collapse challenge description on tablet', () => {
    viewport.set(768, 1024);
    fixture.detectChanges();
    
    const collapseBtn = fixture.nativeElement.querySelector('.challenge-collapse-toggle');
    expect(collapseBtn).toBeTruthy();
    
    collapseBtn.click();
    fixture.detectChanges();
    
    const challenge = fixture.nativeElement.querySelector('.challenge');
    expect(challenge.classList.contains('collapsed')).toBeTrue();
  });
});
```

### 10.3 Unit Tests — SignalR Reconnection

```csharp
// Tests/Unit/InteractiveRunGracePeriodTests.cs

public class InteractiveRunGracePeriodTests : IDisposable
{
    private readonly InteractiveRunService _service;
    // ... setup with mocked hub context ...
    
    [Fact]
    public async Task GracePeriod_StudentReconnectsInTime_RunContinues()
    {
        // Start a run
        await _service.StartRunAsync(1, "conn-1", 1, 
            "Console.ReadLine();", new());
        Assert.True(_service.HasActiveRun(1));
        
        // Simulate disconnect — start grace period
        _ = _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 5);
        
        // Student reconnects after 2 seconds
        await Task.Delay(2000);
        _service.OnStudentReconnected(1, "conn-2");
        
        // Run should still be active
        Assert.True(_service.HasActiveRun(1));
        
        // Wait past grace period to confirm it was cancelled
        await Task.Delay(5000);
        Assert.True(_service.HasActiveRun(1));
    }
    
    [Fact]
    public async Task GracePeriod_StudentDoesNotReconnect_RunKilled()
    {
        await _service.StartRunAsync(1, "conn-1", 1,
            "Console.ReadLine();", new());
        
        // Simulate disconnect — start 2-second grace period
        await _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 2);
        
        // Wait for grace period to expire
        await Task.Delay(3000);
        
        Assert.False(_service.HasActiveRun(1));
    }
    
    [Fact]
    public async Task GracePeriod_ReconnectUpdatesConnectionId()
    {
        await _service.StartRunAsync(1, "conn-1", 1,
            "Console.ReadLine();", new());
        
        _ = _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 10);
        
        _service.OnStudentReconnected(1, "conn-2");
        
        // Verify the session now targets conn-2
        // (The next RunOutput message should go to conn-2, not conn-1)
        // This is verified by checking _sentMessages target the new connectionId
        Assert.Contains(_sentMessages, m => m.method == "RunResumed");
    }
    
    [Fact]
    public async Task GracePeriod_MultipleDisconnects_OnlyLatestTimerActive()
    {
        await _service.StartRunAsync(1, "conn-1", 1,
            "Console.ReadLine();", new());
        
        // First disconnect
        _ = _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 10);
        
        // Reconnect
        _service.OnStudentReconnected(1, "conn-2");
        
        // Second disconnect
        _ = _service.StartDisconnectGracePeriodAsync(1, gracePeriodSeconds: 2);
        
        // Wait for second grace period
        await Task.Delay(3000);
        
        // Run should be killed (second timer expired)
        Assert.False(_service.HasActiveRun(1));
    }
    
    public void Dispose() => _service.Dispose();
}
```

### 10.4 Integration Tests — Android Capacitor

These tests run on a real or emulated Android device using Playwright's Android support or Appium. They verify the terminal works inside the Capacitor WebView.

```typescript
// e2e/android-interactive-console.spec.ts  (Appium / Playwright Android)

// NOTE: These tests require an Android emulator or device.
// Run with: npx playwright test --project=android
// Or with Appium for Capacitor-specific testing.

import { test, expect } from '@playwright/test';

test.describe('Android Capacitor — Interactive Console', () => {
  
  test('Terminal renders in WebView', async ({ page }) => {
    // Navigate to coding view (assumes already joined session)
    await page.goto('/code');
    
    await setEditorContent(page, 'Console.WriteLine("android test");');
    await page.tap('[data-testid="run-button"]');
    
    // Terminal should render
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('android test', { timeout: 15000 });
  });
  
  test('Mobile input bar appears for ReadLine on touch device', async ({ page }) => {
    const code = [
      'Console.Write("Name: ");',
      'var n = Console.ReadLine();',
      'Console.WriteLine("Hi " + n);'
    ].join('\n');
    
    await setEditorContent(page, code);
    await page.tap('[data-testid="run-button"]');
    
    // Wait for input prompt
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Name:', { timeout: 15000 });
    
    // Mobile input bar should be visible
    await expect(page.locator('[data-testid="mobile-input-bar"]')).toBeVisible();
    
    // Type and send
    await page.locator('[data-testid="mobile-input-field"]').fill('Android');
    await page.tap('[data-testid="mobile-send-button"]');
    
    // Verify output
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Hi Android', { timeout: 5000 });
  });
  
  test('Soft keyboard appears when input is needed', async ({ page }) => {
    // This test verifies the keyboard actually opens.
    // On Android emulator, we can check viewport height change.
    
    const code = 'var x = Console.ReadLine();';
    await setEditorContent(page, code);
    await page.tap('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="mobile-input-bar"]')).toBeVisible();
    
    // Tap the input field
    await page.tap('[data-testid="mobile-input-field"]');
    
    // Wait for keyboard to open (viewport height decreases)
    await page.waitForFunction(() => {
      return window.visualViewport!.height < window.innerHeight * 0.8;
    }, null, { timeout: 5000 });
    
    // Input field should still be visible (not hidden behind keyboard)
    await expect(page.locator('[data-testid="mobile-input-field"]')).toBeVisible();
  });
  
  test('Terminal works with screen pinning active', async ({ page }) => {
    // This test assumes the device is in lock task mode
    // and verifies terminal still functions correctly.
    
    await setEditorContent(page, 'Console.WriteLine("locked and working");');
    await page.tap('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('locked and working', { timeout: 15000 });
  });
  
  test('Phone layout: tabs work correctly', async ({ page }) => {
    // Set phone viewport (or running on phone-sized emulator)
    await page.setViewportSize({ width: 360, height: 640 });
    
    // Should see tab bar
    await expect(page.locator('.tab-bar')).toBeVisible();
    
    // Should be on Code tab by default
    const codeTab = page.locator('.tab[data-tab="code"]');
    await expect(codeTab).toHaveClass(/active/);
    
    // Run code
    await setEditorContent(page, 'Console.WriteLine("phone");');
    await page.tap('[data-testid="run-button"]');
    
    // Should auto-switch to Terminal tab
    const termTab = page.locator('.tab[data-tab="terminal"]');
    await expect(termTab).toHaveClass(/active/);
    
    // Output should be visible
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('phone', { timeout: 15000 });
  });
  
  test('Copy button works in WebView', async ({ page }) => {
    await setEditorContent(page, 'Console.WriteLine("copy me");');
    await page.tap('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('copy me', { timeout: 15000 });
    
    // Tap copy button
    await page.tap('[data-testid="copy-output-button"]');
    
    // Read clipboard (requires Capacitor clipboard plugin or Android permission)
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('copy me');
  });
});
```

### 10.5 E2E Tests — Browser Compatibility

```typescript
// e2e/browser-compat-console.spec.ts  (Playwright multi-browser)

// Run with: npx playwright test --project=chromium --project=firefox --project=webkit

import { test, expect } from '@playwright/test';

test.describe('Cross-Browser — Interactive Console', () => {
  
  test('Basic run works in all browsers', async ({ page, browserName }) => {
    // Join session (abbreviated)
    await joinSession(page);
    
    await setEditorContent(page, 'Console.WriteLine("hello from " + "browser");');
    await page.click('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('hello from browser', { timeout: 15000 });
    
    // Log which browser passed
    console.log(`✓ Basic run works on ${browserName}`);
  });
  
  test('Interactive input works in all browsers', async ({ page, browserName }) => {
    await joinSession(page);
    
    const code = [
      'Console.Write("Input: ");',
      'var v = Console.ReadLine();',
      'Console.WriteLine("Got: " + v);',
    ].join('\n');
    
    await setEditorContent(page, code);
    await page.click('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Input:', { timeout: 10000 });
    
    // Type in xterm.js (desktop)
    await page.locator('[data-testid="terminal-panel"]').click();
    await page.keyboard.type('browser-test');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Got: browser-test', { timeout: 5000 });
    
    console.log(`✓ Interactive input works on ${browserName}`);
  });
  
  test('SignalR WebSocket connection established', async ({ page, browserName }) => {
    await joinSession(page);
    
    // Verify WebSocket transport (not Long Polling)
    const transport = await page.evaluate(() => {
      // Access SignalR internal state
      const conn = (window as any).__signalrConnection;
      return conn?.connection?.transport?.name || 'unknown';
    });
    
    // WebSocket is preferred; SSE or LongPolling is acceptable
    expect(['WebSockets', 'ServerSentEvents', 'LongPolling']).toContain(transport);
    console.log(`${browserName} using transport: ${transport}`);
  });
  
  test('Reconnection after network interruption', async ({ page, context }) => {
    await joinSession(page);
    
    await setEditorContent(page, [
      'Console.Write("Before: ");',
      'var x = Console.ReadLine();',
      'Console.WriteLine("After: " + x);'
    ].join('\n'));
    
    await page.click('[data-testid="run-button"]');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Before:', { timeout: 10000 });
    
    // Simulate network interruption
    await context.setOffline(true);
    await page.waitForTimeout(2000);
    
    // Should show reconnecting message
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('reconnecting', { timeout: 5000 });
    
    // Restore network
    await context.setOffline(false);
    
    // Should reconnect
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('Reconnected', { timeout: 10000 });
    
    // Program should still be waiting for input — send it
    await page.locator('[data-testid="terminal-panel"]').click();
    await page.keyboard.type('survived');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('[data-testid="terminal-panel"]'))
      .toContainText('After: survived', { timeout: 5000 });
  });
});
```

### 10.6 Platform Test Summary Matrix

| Test Category | Framework | Count | What It Verifies |
|---------------|-----------|-------|------------------|
| **Unit: Mobile Input** | Jasmine/Karma | 7 | Mobile input bar visibility, auto-focus, send via button, send via Enter, hide on error/finish, desktop suppression |
| **Unit: Responsive Layout** | Jasmine/Karma | 6 | Tab bar visibility per breakpoint, auto-switch to terminal tab, unread badge, input toast, challenge collapse |
| **Unit: Reconnection Grace** | xUnit | 4 | Reconnect in time, grace expiry, connection ID update, multiple disconnects |
| **E2E: Android Capacitor** | Playwright/Appium | 6 | WebView rendering, mobile input bar, soft keyboard, lock task mode, phone tabs, copy button |
| **E2E: Cross-Browser** | Playwright (3 browsers) | 4×3=12 | Basic run, interactive input, transport detection, network reconnection — across Chrome, Firefox, Safari |
| **Total (platform-specific)** | — | **35** | — |

Combined with the core spec's 49 tests: **84 tests total**.

---

## 11. Files Changed Summary

### New Files

| File | Purpose |
|------|---------|
| `shared/components/tab-bar/tab-bar.component.ts` | Reusable phone tab bar |
| `shared/components/tab-bar/tab-bar.component.html` | Tab bar template |
| `shared/components/tab-bar/tab-bar.component.scss` | Tab bar styles |
| `e2e/android-interactive-console.spec.ts` | Android E2E tests |
| `e2e/browser-compat-console.spec.ts` | Cross-browser E2E tests |
| `features/coding/terminal/terminal-mobile.spec.ts` | Mobile unit tests |
| `features/coding/coding-responsive.spec.ts` | Responsive layout unit tests |
| `Tests/Unit/InteractiveRunGracePeriodTests.cs` | Grace period unit tests |

### Modified Files

| File | Changes |
|------|---------|
| `features/coding/coding.component.ts` | Tab state management, swipe navigation, auto-tab-switch on Run |
| `features/coding/coding.component.html` | Tab bar, tab content wrapper, SR announcer |
| `features/coding/coding.component.scss` | Three breakpoints (desktop/tablet/phone), tab styles |
| `features/coding/challenge-panel/challenge-panel.component.ts` | Collapse toggle for tablet |
| `features/coding/challenge-panel/challenge-panel.component.scss` | Collapsible animation |
| `features/coding/terminal/terminal.component.ts` | Mobile input bar, viewport resize, touch detection, Copy button, focus management, Capacitor renderer |
| `features/coding/terminal/terminal.component.html` | Mobile input bar HTML |
| `features/coding/terminal/terminal.component.scss` | Mobile input bar styles, touch target sizes |
| `core/services/signalr.service.ts` | Reconnection handling, RunResumed event, output throttling, transport warning |
| `Services/InteractiveRunService.cs` | Grace period on disconnect, `OnStudentReconnected()` |
| `Hubs/CodeFestHub.cs` | Grace period in `OnDisconnectedAsync`, `ReconnectToRun` method |
| `capacitor.config.ts` | Keyboard and WebView settings |
| `package.json` | Add `@capacitor/keyboard` dependency |

---

## 12. Implementation Order

Apply this spec **after** the core interactive console feature is complete and passing its 49 tests.

### Step 1: Responsive Layout (1–2 days)
- Add three-breakpoint SCSS
- Build tab bar component for phone layout
- Implement challenge collapse for tablet
- Run responsive unit tests

### Step 2: Mobile Input (1 day)
- Add mobile input bar to terminal component
- Touch detection + auto-focus
- Run mobile input unit tests

### Step 3: Soft Keyboard Handling (0.5 day)
- `visualViewport` resize handling
- Input field `font-size: 16px` (prevent iOS zoom)
- `autocorrect="off"`, `autocapitalize="off"`

### Step 4: SignalR Reconnection Grace Period (1 day)
- Backend: grace period logic in `InteractiveRunService`
- Backend: `ReconnectToRun` hub method
- Frontend: `RunResumed` handler, reconnection messages in terminal
- Run grace period unit tests

### Step 5: Android Capacitor Adaptations (1 day)
- Force canvas renderer in WebView
- Add `@capacitor/keyboard` integration
- Update `capacitor.config.ts`
- Copy button for WebView
- Run Android E2E tests on emulator

### Step 6: Cross-Browser Testing (0.5 day)
- Run Playwright tests on Chrome, Firefox, WebKit
- Fix any browser-specific issues discovered

### Step 7: Accessibility & Performance (0.5 day)
- Screen reader announcements
- Focus management
- Output throttling for low-end devices
- Reduced scrollback on mobile

**Total: ~6–7 days after core feature is done.**
