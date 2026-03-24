import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { RunStateService } from '../../../core/services/run-state.service';
import {
  RunState,
  RunEvent,
  CompileError,
} from '../../../core/models/run-state.model';
import { SignalrService } from '../../../core/services/signalr.service';
import { SessionService } from '../../../core/services/session.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="terminal-container"
      [class.visible]="isVisible"
      data-testid="terminal-panel"
    >
      <div class="terminal-header">
        <span class="terminal-title">Terminal</span>
        <div class="terminal-actions">
          @if (isTouchDevice()) {
            <button
              class="btn-terminal"
              (click)="copyOutput()"
              title="Copy terminal output"
              data-testid="copy-output-button"
            >
              Copy
            </button>
          }
          <button
            class="btn-terminal"
            (click)="clear()"
            title="Clear"
            data-testid="clear-button"
          >
            Clear
          </button>
          @if (isRunning) {
            <button
              class="btn-terminal btn-danger"
              (click)="stop()"
              title="Stop"
              data-testid="stop-button"
            >
              &#9632; Stop
            </button>
          }
        </div>
      </div>
      <div class="terminal-body" #terminalContainer></div>

      <!-- Mobile input bar -->
      <div
        class="mobile-input-bar"
        [class.hidden]="!showMobileInput"
        data-testid="mobile-input-bar"
      >
        <input
          #mobileInput
          type="text"
          placeholder="Type your input..."
          [(ngModel)]="mobileInputValue"
          (keydown.enter)="submitMobileInput()"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-testid="mobile-input-field"
        />
        <button
          class="send-btn"
          (click)="submitMobileInput()"
          data-testid="mobile-send-button"
        >
          Send
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .terminal-container {
        display: none;
        flex-direction: column;
        border-top: 2px solid #333;
        background: #1e1e1e;
        min-height: 150px;
        max-height: 50vh;
        resize: vertical;
        overflow: hidden;
      }

      .terminal-container.visible {
        display: flex;
      }

      .terminal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 12px;
        background: #252526;
        border-bottom: 1px solid #333;
      }

      .terminal-title {
        font-size: 12px;
        font-weight: 600;
        color: #cccccc;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .terminal-actions {
        display: flex;
        gap: 8px;
      }

      .btn-terminal {
        padding: 2px 10px;
        font-size: 12px;
        border: 1px solid #555;
        border-radius: 3px;
        background: transparent;
        color: #ccc;
        cursor: pointer;
      }

      .btn-terminal:hover {
        background: #333;
      }

      .btn-danger {
        border-color: #ef5350;
        color: #ef5350;
      }

      .btn-danger:hover {
        background: rgba(239, 83, 80, 0.15);
      }

      .terminal-body {
        flex: 1;
        padding: 4px;
        overflow: hidden;
      }

      :host ::ng-deep .xterm {
        height: 100%;
      }

      /* Mobile input bar — hidden by default, shown on touch devices when waiting */
      .mobile-input-bar {
        display: none;
      }

      .mobile-input-bar.hidden {
        display: none !important;
      }

      @media (pointer: coarse) {
        .mobile-input-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: #2d2d2d;
          border-top: 1px solid #444;
        }

        .mobile-input-bar.hidden {
          display: none !important;
        }

        .mobile-input-bar input {
          flex: 1;
          padding: 8px 12px;
          font-size: 16px; /* >=16px prevents iOS zoom on focus */
          font-family: 'JetBrains Mono', Consolas, monospace;
          background: #1e1e1e;
          border: 1px solid #555;
          border-radius: 4px;
          color: #4fc3f7;
          outline: none;
          -webkit-text-size-adjust: none;
        }

        .mobile-input-bar input:focus {
          border-color: #4fc3f7;
        }

        .send-btn {
          flex: 0 0 auto;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 600;
          background: #4fc3f7;
          color: #1e1e1e;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .send-btn:active {
          background: #29b6f6;
        }
      }

      /* Larger touch targets on mobile */
      @media (pointer: coarse) {
        .btn-terminal {
          min-height: 36px;
          min-width: 36px;
          padding: 4px 12px;
          font-size: 13px;
        }
      }

      /* Screen reader only */
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
    `,
  ],
})
export class TerminalComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('terminalContainer', { static: true })
  terminalContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('mobileInput')
  mobileInputRef?: ElementRef<HTMLInputElement>;

  @Output() unreadOutput = new EventEmitter<boolean>();

  private terminal!: Terminal;
  private fitAddon!: FitAddon;
  private subscriptions = new Subscription();
  private inputBuffer = '';
  private isInputMode = false;
  private runCount = 0;
  private resizeObserver?: ResizeObserver;
  private visibilityHandler?: () => void;

  isVisible = false;
  isRunning = false;
  showMobileInput = false;
  mobileInputValue = '';

  constructor(
    private runState: RunStateService,
    private signalr: SignalrService,
    private session: SessionService
  ) {}

  ngOnInit(): void {
    this.subscribeToEvents();
    this.setupVisibilityHandler();
  }

  ngAfterViewInit(): void {
    this.initTerminal();
    this.setupViewportResize();
    this.setupContextMenuPrevention();
  }

  private initTerminal(): void {
    const isTouch = this.isTouchDevice();
    const isCapacitor = this.isCapacitor();

    this.terminal = new Terminal({
      theme: {
        background: '#1E1E1E',
        foreground: '#E0E0E0',
        cursor: '#4FC3F7',
        selectionBackground: '#264F78',
      },
      fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: isTouch ? 200 : 500,
      convertEol: true,
      disableStdin: true,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    this.terminal.open(this.terminalContainer.nativeElement);
    this.fitAddon.fit();

    // Allow touch scrolling in Capacitor/mobile
    if (isTouch) {
      this.terminal.options.scrollOnUserInput = false;
    }

    // Handle keyboard input (desktop only — mobile uses input bar)
    this.terminal.onKey(({ key, domEvent }) => {
      if (!this.isInputMode) return;

      if (domEvent.key === 'Enter') {
        this.submitInput();
      } else if (domEvent.key === 'Backspace') {
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.terminal.write('\b \b');
        }
      } else if (domEvent.key === 'c' && domEvent.ctrlKey) {
        this.stop();
      } else if (key.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
        this.inputBuffer += key;
        this.terminal.write(`\x1b[38;2;79;195;247m${key}\x1b[0m`);
      }
    });

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => {
      try {
        this.fitAddon.fit();
      } catch {
        // ignore fit errors during destruction
      }
    });
    this.resizeObserver.observe(this.terminalContainer.nativeElement);
  }

  private setupViewportResize(): void {
    if (!this.isTouchDevice()) return;

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        this.onViewportResize();
      });
    }
  }

  private onViewportResize(): void {
    const vv = window.visualViewport;
    if (!vv) return;

    const keyboardHeight = window.innerHeight - vv.height;

    if (keyboardHeight > 100) {
      // Keyboard is open — shrink terminal
      this.terminalContainer.nativeElement.style.maxHeight = `${vv.height - 120}px`;
    } else {
      // Keyboard closed
      this.terminalContainer.nativeElement.style.maxHeight = '';
    }

    try {
      this.fitAddon.fit();
    } catch {}
  }

  private setupContextMenuPrevention(): void {
    if (this.isTouchDevice()) {
      this.terminalContainer.nativeElement.addEventListener(
        'contextmenu',
        (e: Event) => e.preventDefault()
      );
    }
  }

  private setupVisibilityHandler(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.terminal) {
        this.terminal.scrollToBottom();
        try {
          this.fitAddon?.fit();
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private subscribeToEvents(): void {
    this.subscriptions.add(
      this.runState.events$.subscribe((event) => this.handleRunEvent(event))
    );

    this.subscriptions.add(
      this.runState.state$.subscribe((state) => {
        this.isRunning =
          state === RunState.Running ||
          state === RunState.WaitingForInput ||
          state === RunState.Compiling;

        this.manageFocusOnStateChange(state);
      })
    );

    // Reconnection messages
    this.subscriptions.add(
      this.signalr.reconnecting$.subscribe(() => {
        if (this.terminal && this.isVisible) {
          this.terminal.writeln(
            '\x1b[33m\u26A0 Connection lost \u2014 reconnecting...\x1b[0m'
          );
        }
      })
    );

    this.subscriptions.add(
      this.signalr.reconnected$.subscribe(() => {
        if (this.terminal && this.isVisible) {
          this.terminal.writeln('\x1b[32m\u2713 Reconnected\x1b[0m');
        }
      })
    );
  }

  private handleRunEvent(event: RunEvent): void {
    switch (event.type) {
      case 'compiling':
        this.show();
        if (this.runCount > 0) {
          this.terminal.writeln('');
          this.terminal.writeln(
            `\x1b[90m────── Run #${this.runCount + 1} ──────\x1b[0m`
          );
        }
        this.terminal.writeln('\x1b[90mCompiling...\x1b[0m');
        this.announce('Compiling your code');
        break;

      case 'started':
        this.runCount++;
        break;

      case 'output':
        this.terminal.write(event.data as string);
        this.unreadOutput.emit(true);
        break;

      case 'waiting':
        if (this.isTouchDevice()) {
          this.showMobileInput = true;
          setTimeout(
            () => this.mobileInputRef?.nativeElement.focus(),
            100
          );
        } else {
          this.enableInputMode();
        }
        this.announce('Program is waiting for your input');
        break;

      case 'inputEcho':
        this.terminal.writeln('');
        this.showMobileInput = false;
        this.mobileInputValue = '';
        this.disableInputMode();
        break;

      case 'compileError':
        this.show();
        this.renderCompileErrors(event.data as CompileError[]);
        break;

      case 'error':
        this.show();
        this.terminal.writeln(`\x1b[31m${event.data}\x1b[0m`);
        this.showMobileInput = false;
        this.mobileInputValue = '';
        this.disableInputMode();
        this.announce(`Error: ${event.data}`);
        break;

      case 'finished': {
        const exitCode = event.data as number;
        const color = exitCode === 0 ? '90' : '31';
        this.terminal.writeln('');
        this.terminal.writeln(
          `\x1b[${color}m--- Program ended (exit code ${exitCode}) ---\x1b[0m`
        );
        this.showMobileInput = false;
        this.mobileInputValue = '';
        this.disableInputMode();
        this.announce(`Program finished with exit code ${exitCode}`);
        break;
      }

      case 'clear':
        this.terminal.clear();
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
    this.signalr.sendRunInput(this.session.snapshot.sessionCode, input);
  }

  submitMobileInput(): void {
    const input = this.mobileInputValue;
    this.mobileInputValue = '';
    this.showMobileInput = false;

    // Echo in terminal
    this.terminal.write(`\x1b[36m${input}\x1b[0m\n`);

    this.signalr.sendRunInput(this.session.snapshot.sessionCode, input);
  }

  private renderCompileErrors(errors: CompileError[]): void {
    this.terminal.writeln('\x1b[31m══ Compile Errors ══\x1b[0m');
    for (const err of errors) {
      this.terminal.writeln(
        `\x1b[31m  Line ${err.line}, Col ${err.column}: ${err.message}\x1b[0m`
      );
    }
    this.terminal.writeln('\x1b[31m════════════════════\x1b[0m');
  }

  private manageFocusOnStateChange(state: RunState): void {
    if (!this.isTouchDevice()) return;

    switch (state) {
      case RunState.WaitingForInput:
        setTimeout(
          () => this.mobileInputRef?.nativeElement.focus(),
          100
        );
        break;
      case RunState.Finished:
      case RunState.Error: {
        const runBtn = document.querySelector<HTMLElement>(
          '[data-testid="run-button"]'
        );
        runBtn?.focus();
        break;
      }
    }
  }

  private announce(message: string): void {
    const announcer = document.getElementById('sr-announcer');
    if (announcer) {
      announcer.textContent = message;
    }
  }

  copyOutput(): void {
    const buffer = this.terminal.buffer.active;
    let text = '';
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) text += line.translateToString(true) + '\n';
    }
    navigator.clipboard.writeText(text.trim()).catch(() => {});
  }

  show(): void {
    this.isVisible = true;
  }

  clear(): void {
    this.terminal.clear();
    this.runCount = 0;
  }

  stop(): void {
    this.signalr.stopRun(this.session.snapshot.sessionCode);
    this.showMobileInput = false;
    this.mobileInputValue = '';
    this.disableInputMode();
  }

  isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private isCapacitor(): boolean {
    return !!(window as any).Capacitor;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.resizeObserver?.disconnect();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.terminal?.dispose();
  }
}
