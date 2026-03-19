import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Challenge } from '../models/challenge.model';
import { LeaderboardEntry, SessionStatus } from '../models/session.model';
import { SubmissionResult } from '../models/submission.model';
import { SignalrService } from './signalr.service';

export interface SessionState {
  sessionCode: string;
  sessionName: string;
  studentId: number;
  displayName: string;
  status: SessionStatus;
  currentChallenge: Challenge | null;
  currentChallengeIndex: number;
  totalChallenges: number;
  totalPoints: number;
  leaderboard: LeaderboardEntry[];
  lastResult: SubmissionResult | null;
  hints: { challengeId: number; hint: string }[];
  broadcasts: string[];
}

const INITIAL_STATE: SessionState = {
  sessionCode: '',
  sessionName: '',
  studentId: 0,
  displayName: '',
  status: SessionStatus.Lobby,
  currentChallenge: null,
  currentChallengeIndex: 0,
  totalChallenges: 0,
  totalPoints: 0,
  leaderboard: [],
  lastResult: null,
  hints: [],
  broadcasts: [],
};

@Injectable({ providedIn: 'root' })
export class SessionService {
  private state$ = new BehaviorSubject<SessionState>({ ...INITIAL_STATE });

  get state() {
    return this.state$.asObservable();
  }

  get snapshot() {
    return this.state$.value;
  }

  constructor(private signalr: SignalrService) {
    this.setupListeners();
  }

  private setupListeners(): void {
    this.signalr.sessionStarted$.subscribe((challenge) => {
      this.patch({
        status: SessionStatus.Active,
        currentChallenge: challenge,
        currentChallengeIndex: 0,
      });
    });

    this.signalr.sessionPaused$.subscribe(() => {
      this.patch({ status: SessionStatus.Paused });
    });

    this.signalr.sessionResumed$.subscribe(() => {
      this.patch({ status: SessionStatus.Active });
    });

    this.signalr.sessionEnded$.subscribe((leaderboard) => {
      this.patch({
        status: SessionStatus.Ended,
        leaderboard,
      });
    });

    this.signalr.testResults$.subscribe((result) => {
      this.patch({ lastResult: result });
      if (result.allPassed) {
        this.patch({
          totalPoints: this.snapshot.totalPoints + result.pointsAwarded,
        });
      }
    });

    this.signalr.nextChallenge$.subscribe((challenge) => {
      this.patch({
        currentChallenge: challenge,
        currentChallengeIndex: this.snapshot.currentChallengeIndex + 1,
        lastResult: null,
      });
    });

    this.signalr.leaderboardUpdated$.subscribe((leaderboard) => {
      this.patch({ leaderboard });
    });

    this.signalr.hintReceived$.subscribe((hint) => {
      this.patch({ hints: [...this.snapshot.hints, hint] });
    });

    this.signalr.broadcastReceived$.subscribe(({ message }) => {
      this.patch({ broadcasts: [...this.snapshot.broadcasts, message] });
    });
  }

  setJoinInfo(data: {
    sessionCode: string;
    sessionName: string;
    studentId: number;
    displayName: string;
    totalChallenges: number;
    status: SessionStatus;
    currentChallenge?: Challenge;
  }): void {
    this.patch({
      sessionCode: data.sessionCode,
      sessionName: data.sessionName,
      studentId: data.studentId,
      displayName: data.displayName,
      totalChallenges: data.totalChallenges,
      status: data.status,
      currentChallenge: data.currentChallenge ?? null,
    });
  }

  clearLastResult(): void {
    this.patch({ lastResult: null });
  }

  reset(): void {
    this.state$.next({ ...INITIAL_STATE });
  }

  private patch(partial: Partial<SessionState>): void {
    this.state$.next({ ...this.state$.value, ...partial });
  }
}
