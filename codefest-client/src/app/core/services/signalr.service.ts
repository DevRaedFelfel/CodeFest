import { Injectable, NgZone } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { Challenge } from '../models/challenge.model';
import { SubmissionResult } from '../models/submission.model';
import { LeaderboardEntry } from '../models/session.model';
import { RunStateService } from './run-state.service';
import { CompileError } from '../models/run-state.model';

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private hubConnection!: HubConnection;
  private readonly baseUrl = '/hubs/codefest';

  // Connection state
  connected$ = new BehaviorSubject<boolean>(false);

  // Teacher events
  studentJoined$ = new Subject<any>();
  studentDisconnected$ = new Subject<number>();
  submissionResult$ = new Subject<any>();
  activityLogged$ = new Subject<any>();
  sessionStatusChanged$ = new Subject<string>();
  hintRequested$ = new Subject<any>();

  // Teacher: interactive run events
  studentRunStarted$ = new Subject<{ studentId: number; challengeId: number }>();
  studentRunStopped$ = new Subject<number>();
  studentRunFinished$ = new Subject<{ studentId: number; exitCode: number }>();
  studentRunError$ = new Subject<{ studentId: number; error: string }>();

  // Student events
  sessionStarted$ = new Subject<Challenge>();
  sessionPaused$ = new Subject<void>();
  sessionResumed$ = new Subject<void>();
  sessionEnded$ = new Subject<LeaderboardEntry[]>();
  testResults$ = new Subject<SubmissionResult>();
  nextChallenge$ = new Subject<Challenge>();
  hintReceived$ = new Subject<{ challengeId: number; hint: string }>();
  broadcastReceived$ = new Subject<{ message: string }>();
  celebration$ = new Subject<string>();
  leaderboardUpdated$ = new Subject<LeaderboardEntry[]>();
  error$ = new Subject<string>();
  sessionDeleted$ = new Subject<void>();
  sessionReopened$ = new Subject<void>();

  // Output throttling for low-end devices
  private outputBuffer = '';
  private outputFlushTimer: any = null;

  // Reconnection terminal messages
  reconnecting$ = new Subject<void>();
  reconnected$ = new Subject<void>();

  constructor(
    private zone: NgZone,
    private runState: RunStateService
  ) {}

  async connect(): Promise<void> {
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.baseUrl)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build();

    this.registerHandlers();

    this.hubConnection.onreconnecting(() => {
      this.zone.run(() => {
        this.connected$.next(false);
        this.reconnecting$.next();
      });
    });

    this.hubConnection.onreconnected(async () => {
      this.zone.run(() => {
        this.connected$.next(true);
        this.reconnected$.next();
      });
    });

    this.hubConnection.onclose(() => {
      this.zone.run(() => this.connected$.next(false));
    });

    await this.hubConnection.start();
    this.connected$.next(true);
  }

  private registerHandlers(): void {
    const on = (event: string, callback: (...args: any[]) => void) => {
      this.hubConnection.on(event, (...args) => {
        this.zone.run(() => callback(...args));
      });
    };

    on('SessionStarted', (challenge: Challenge) =>
      this.sessionStarted$.next(challenge)
    );
    on('SessionPaused', () => this.sessionPaused$.next());
    on('SessionResumed', () => this.sessionResumed$.next());
    on('SessionEnded', (leaderboard: LeaderboardEntry[]) =>
      this.sessionEnded$.next(leaderboard)
    );
    on('TestResults', (result: SubmissionResult) =>
      this.testResults$.next(result)
    );
    on('NextChallenge', (challenge: Challenge) =>
      this.nextChallenge$.next(challenge)
    );
    on('HintReceived', (data: { challengeId: number; hint: string }) =>
      this.hintReceived$.next(data)
    );
    on('BroadcastReceived', (data: { message: string }) =>
      this.broadcastReceived$.next(data)
    );
    on('Celebration', (type: string) => this.celebration$.next(type));
    on('LeaderboardUpdated', (entries: LeaderboardEntry[]) =>
      this.leaderboardUpdated$.next(entries)
    );
    on('Error', (msg: string) => this.error$.next(msg));

    // Teacher handlers
    on('StudentJoined', (student: any) => this.studentJoined$.next(student));
    on('StudentDisconnected', (studentId: number) =>
      this.studentDisconnected$.next(studentId)
    );
    on('SubmissionResult', (result: any) =>
      this.submissionResult$.next(result)
    );
    on('ActivityLogged', (activity: any) =>
      this.activityLogged$.next(activity)
    );
    on('SessionStatusChanged', (status: string) =>
      this.sessionStatusChanged$.next(status)
    );
    on('HintRequested', (data: any) => this.hintRequested$.next(data));
    on('SessionDeleted', () => this.sessionDeleted$.next());
    on('SessionReopened', () => this.sessionReopened$.next());

    // Interactive run handlers (student-side)
    on('RunCompiling', () => this.runState.handleRunCompiling());
    on('RunStarted', (runId: string) =>
      this.runState.handleRunStarted(runId)
    );
    on('RunOutput', (text: string) => {
      if (this.isLowEndDevice()) {
        this.outputBuffer += text;
        if (!this.outputFlushTimer) {
          this.outputFlushTimer = setTimeout(() => {
            this.runState.handleRunOutput(this.outputBuffer);
            this.outputBuffer = '';
            this.outputFlushTimer = null;
          }, 32); // ~30fps
        }
      } else {
        this.runState.handleRunOutput(text);
      }
    });
    on('RunWaiting', () => this.runState.handleRunWaiting());
    on('RunInputEcho', (text: string) =>
      this.runState.handleRunInputEcho(text)
    );
    on('RunCompileError', (errors: CompileError[]) =>
      this.runState.handleRunCompileError(errors)
    );
    on('RunError', (message: string) =>
      this.runState.handleRunError(message)
    );
    on('RunFinished', (exitCode: number) =>
      this.runState.handleRunFinished(exitCode)
    );
    on('RunResumed', (state: string) => {
      if (state === 'WaitingForInput') {
        this.runState.handleRunWaiting();
      } else if (state === 'Running') {
        this.runState.handleRunStarted('resumed');
      }
    });

    // Interactive run handlers (teacher-side)
    on('StudentRunStarted', (studentId: number, challengeId: number) =>
      this.studentRunStarted$.next({ studentId, challengeId })
    );
    on('StudentRunStopped', (studentId: number) =>
      this.studentRunStopped$.next(studentId)
    );
  }

  async joinSession(
    sessionCode: string,
    displayName: string,
    clientType: string = 'Web'
  ): Promise<any> {
    return this.hubConnection.invoke(
      'JoinSession',
      sessionCode,
      displayName,
      clientType
    );
  }

  async submitCode(
    sessionCode: string,
    challengeId: number,
    code: string
  ): Promise<void> {
    return this.hubConnection.invoke(
      'SubmitCode',
      sessionCode,
      challengeId,
      code
    );
  }

  async logActivity(
    sessionCode: string,
    activityType: string,
    data?: string
  ): Promise<void> {
    if (this.hubConnection.state === HubConnectionState.Connected) {
      return this.hubConnection.invoke(
        'LogActivity',
        sessionCode,
        activityType,
        data ?? null
      );
    }
  }

  async requestHint(
    sessionCode: string,
    challengeId: number
  ): Promise<void> {
    return this.hubConnection.invoke(
      'RequestHint',
      sessionCode,
      challengeId
    );
  }

  // Teacher methods
  async joinAsTeacher(sessionCode: string): Promise<void> {
    return this.hubConnection.invoke('JoinAsTeacher', sessionCode);
  }

  async createSession(
    sessionName: string,
    challengeIds: number[]
  ): Promise<any> {
    return this.hubConnection.invoke(
      'CreateSession',
      sessionName,
      challengeIds
    );
  }

  async startSession(sessionCode: string): Promise<void> {
    return this.hubConnection.invoke('StartSession', sessionCode);
  }

  async pauseSession(sessionCode: string): Promise<void> {
    return this.hubConnection.invoke('PauseSession', sessionCode);
  }

  async resumeSession(sessionCode: string): Promise<void> {
    return this.hubConnection.invoke('ResumeSession', sessionCode);
  }

  async endSession(sessionCode: string): Promise<void> {
    return this.hubConnection.invoke('EndSession', sessionCode);
  }

  async deleteSession(sessionCode: string): Promise<void> {
    return this.hubConnection.invoke('DeleteSession', sessionCode);
  }

  async reopenSession(sessionCode: string): Promise<void> {
    return this.hubConnection.invoke('ReopenSession', sessionCode);
  }

  async pushHint(
    sessionCode: string,
    challengeId: number,
    hint: string
  ): Promise<void> {
    return this.hubConnection.invoke(
      'PushHint',
      sessionCode,
      challengeId,
      hint
    );
  }

  async broadcastMessage(
    sessionCode: string,
    message: string
  ): Promise<void> {
    return this.hubConnection.invoke(
      'BroadcastMessage',
      sessionCode,
      message
    );
  }

  // Interactive run methods
  async runCode(
    sessionCode: string,
    challengeId: number,
    code: string
  ): Promise<void> {
    return this.hubConnection.invoke(
      'RunCode',
      sessionCode,
      challengeId,
      code
    );
  }

  async sendRunInput(
    sessionCode: string,
    input: string
  ): Promise<void> {
    return this.hubConnection.invoke(
      'SendRunInput',
      sessionCode,
      input
    );
  }

  async stopRun(sessionCode: string): Promise<void> {
    return this.hubConnection.invoke('StopRun', sessionCode);
  }

  async reconnectToRun(sessionCode: string): Promise<void> {
    if (this.hubConnection.state === HubConnectionState.Connected) {
      return this.hubConnection.invoke('ReconnectToRun', sessionCode);
    }
  }

  private isLowEndDevice(): boolean {
    const memory = (navigator as any).deviceMemory;
    const cores = navigator.hardwareConcurrency;
    return (memory && memory <= 2) || (cores && cores <= 4);
  }

  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
    }
  }

  get isConnected(): boolean {
    return (
      this.hubConnection?.state === HubConnectionState.Connected
    );
  }
}
