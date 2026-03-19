export interface Session {
  id: number;
  code: string;
  name: string;
  status: SessionStatus;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  challengeIds: number[];
}

export enum SessionStatus {
  Lobby = 0,
  Active = 1,
  Paused = 2,
  Ended = 3,
}

export interface StudentInfo {
  id: number;
  displayName: string;
  connectionId: string;
  currentChallengeIndex: number;
  totalPoints: number;
  isConnected: boolean;
  clientType: string;
}

export interface LeaderboardEntry {
  studentId: number;
  displayName: string;
  totalPoints: number;
  challengesCompleted: number;
  rank: number;
}

export interface ActivityLog {
  studentId: number;
  displayName: string;
  activityType: string;
  data?: string;
  timestamp: string;
}
