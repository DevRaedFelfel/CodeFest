import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  RunStateService,
} from '../../../core/services/run-state.service';
import { RunState, RunEvent, CompileError } from '../../../core/models/run-state.model';
import { SignalrService } from '../../../core/services/signalr.service';
import { SessionService } from '../../../core/services/session.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="terminal-container"
      [class.visible]="isVisible"
      data-testid="terminal-panel"
    >
      <div class="terminal-header">
        <span class="terminal-title">Terminal</span>
        <div class="terminal-actions">
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
    `,
  ],
})
export class TerminalComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('terminalContainer', { static: true })
  terminalContainer!: ElementRef<HTMLDivElement>;

  private terminal!: Terminal;
  private fitAddon!: FitAddon;
  private subscriptions = new Subscription();
  private inputBuffer = '';
  private isInputMode = false;
  private runCount = 0;
  private resizeObserver?: ResizeObserver;

  isVisible = false;
  isRunning = false;

  constructor(
    private runState: RunStateService,
    private signalr: SignalrService,
    private session: SessionService
  ) {}

  ngOnInit(): void {
    this.subscribeToEvents();
  }

  ngAfterViewInit(): void {
    this.initTerminal();
  }

  private initTerminal(): void {
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
      scrollback: 500,
      convertEol: true,
      disableStdin: true,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    this.terminal.open(this.terminalContainer.nativeElement);
    this.fitAddon.fit();

    // Handle keyboard input
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
        // Echo in input color (light blue)
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

      case 'finished': {
        const exitCode = event.data as number;
        const color = exitCode === 0 ? '90' : '31';
        this.terminal.writeln('');
        this.terminal.writeln(
          `\x1b[${color}m--- Program ended (exit code ${exitCode}) ---\x1b[0m`
        );
        this.disableInputMode();
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

  private renderCompileErrors(errors: CompileError[]): void {
    this.terminal.writeln('\x1b[31m══ Compile Errors ══\x1b[0m');
    for (const err of errors) {
      this.terminal.writeln(
        `\x1b[31m  Line ${err.line}, Col ${err.column}: ${err.message}\x1b[0m`
      );
    }
    this.terminal.writeln('\x1b[31m════════════════════\x1b[0m');
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
    this.disableInputMode();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.resizeObserver?.disconnect();
    this.terminal?.dispose();
  }
}
