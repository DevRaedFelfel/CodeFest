import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { SignalrService } from './signalr.service';
import {
  Session,
  StudentInfo,
  LeaderboardEntry,
  ActivityLog,
} from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class TeacherService {
  private readonly baseUrl = '/api/teacher';

  sessions$ = new BehaviorSubject<Session[]>([]);
  currentSession$ = new BehaviorSubject<Session | null>(null);
  students$ = new BehaviorSubject<StudentInfo[]>([]);
  activityFeed$ = new BehaviorSubject<ActivityLog[]>([]);
  leaderboard$ = new BehaviorSubject<LeaderboardEntry[]>([]);

  constructor(
    private http: HttpClient,
    private signalr: SignalrService
  ) {
    this.listenToSignalR();
  }

  private listenToSignalR(): void {
    this.signalr.studentJoined$.subscribe((student: StudentInfo) => {
      const current = this.students$.value;
      const exists = current.find((s) => s.id === student.id);
      if (exists) {
        this.students$.next(
          current.map((s) => (s.id === student.id ? { ...s, ...student, isConnected: true } : s))
        );
      } else {
        this.students$.next([...current, student]);
      }
    });

    this.signalr.studentDisconnected$.subscribe((studentId: number) => {
      const current = this.students$.value;
      this.students$.next(
        current.map((s) =>
          s.id === studentId ? { ...s, isConnected: false } : s
        )
      );
    });

    this.signalr.activityLogged$.subscribe((activity: ActivityLog) => {
      const current = this.activityFeed$.value;
      const updated = [activity, ...current].slice(0, 200);
      this.activityFeed$.next(updated);
    });

    this.signalr.submissionResult$.subscribe((result: any) => {
      // Update student points if result contains student info
      if (result.studentId && result.pointsAwarded) {
        const current = this.students$.value;
        this.students$.next(
          current.map((s) =>
            s.id === result.studentId
              ? { ...s, totalPoints: s.totalPoints + result.pointsAwarded }
              : s
          )
        );
      }
    });

    this.signalr.leaderboardUpdated$.subscribe(
      (entries: LeaderboardEntry[]) => {
        this.leaderboard$.next(entries);
      }
    );

    this.signalr.sessionStatusChanged$.subscribe((status: string) => {
      const session = this.currentSession$.value;
      if (session) {
        this.currentSession$.next({ ...session, status: this.mapStatus(status) });
      }
    });
  }

  private mapStatus(status: string): number {
    const map: Record<string, number> = {
      Lobby: 0,
      Active: 1,
      Paused: 2,
      Ended: 3,
    };
    return map[status] ?? 0;
  }

  loadSessions(): void {
    this.http.get<Session[]>(`${this.baseUrl}/sessions`).subscribe({
      next: (sessions) => this.sessions$.next(sessions),
      error: (err) => console.error('Failed to load sessions', err),
    });
  }

  async createSession(name: string, challengeIds: number[]): Promise<Session> {
    const session = await firstValueFrom(
      this.http.post<Session>(`${this.baseUrl}/sessions`, { name, challengeIds })
    );
    this.sessions$.next([session, ...this.sessions$.value]);
    this.currentSession$.next(session);
    return session;
  }

  selectSession(session: Session): void {
    this.currentSession$.next(session);
    this.loadStudents(session.code);
    this.loadActivity(session.code);
    this.loadLeaderboard(session.code);
  }

  loadStudents(sessionCode: string): void {
    this.http
      .get<any>(`${this.baseUrl}/sessions/${sessionCode}`)
      .subscribe({
        next: (session) => this.students$.next(session.students ?? []),
        error: (err) => console.error('Failed to load students', err),
      });
  }

  loadActivity(sessionCode: string, page: number = 1, type?: string): void {
    let url = `${this.baseUrl}/sessions/${sessionCode}/activity?page=${page}`;
    if (type) {
      url += `&type=${type}`;
    }
    this.http.get<ActivityLog[]>(url).subscribe({
      next: (activities) => this.activityFeed$.next(activities),
      error: (err) => console.error('Failed to load activity', err),
    });
  }

  loadLeaderboard(sessionCode: string): void {
    this.http
      .get<LeaderboardEntry[]>(
        `${this.baseUrl}/sessions/${sessionCode}/leaderboard`
      )
      .subscribe({
        next: (entries) => this.leaderboard$.next(entries),
        error: (err) => console.error('Failed to load leaderboard', err),
      });
  }

  getStudentCode(
    sessionCode: string,
    studentId: number
  ): Promise<{ code: string }> {
    return new Promise((resolve, reject) => {
      this.http
        .get<{ code: string }>(
          `${this.baseUrl}/students/${studentId}/code`
        )
        .subscribe({ next: resolve, error: reject });
    });
  }

  getStudentSubmissions(
    sessionCode: string,
    studentId: number
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.http
        .get<any[]>(
          `${this.baseUrl}/students/${studentId}/submissions`
        )
        .subscribe({ next: resolve, error: reject });
    });
  }

  clearSession(): void {
    this.currentSession$.next(null);
    this.students$.next([]);
    this.activityFeed$.next([]);
    this.leaderboard$.next([]);
  }
}
