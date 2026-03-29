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
  courseId: number | null;
  courseCode: string | null;
  courseName: string | null;
  code: string;
  status: string;
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
  email: string | null;
  connectionStatus: 'online' | 'offline' | 'flagged';
  currentChallengeIndex: number;
  totalPoints: number;
  submissionCount: number;
  joinedAt: string;
  flags: string[];
}

export interface SessionDetailResponse {
  id: number;
  name: string;
  courseId: number | null;
  courseCode: string | null;
  courseName: string | null;
  code: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  challengeIds: number[];
  shareableLink: string | null;
  qrCodeData: string | null;
  participants: SessionParticipantDetail[];
  enrolledNotJoinedCount: number;
}
