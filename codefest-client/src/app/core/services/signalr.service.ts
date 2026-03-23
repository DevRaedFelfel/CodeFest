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

  constructor(private zone: NgZone) {}

  async connect(): Promise<void> {
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.baseUrl)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build();

    this.registerHandlers();

    this.hubConnection.onreconnecting(() => {
      this.zone.run(() => this.connected$.next(false));
    });

    this.hubConnection.onreconnected(() => {
      this.zone.run(() => this.connected$.next(true));
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
