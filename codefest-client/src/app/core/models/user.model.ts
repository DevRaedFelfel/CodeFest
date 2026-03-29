export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  pictureUrl?: string;
}

export type UserRole = 'Student' | 'Instructor' | 'SuperAdmin';

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  description?: string;
  instructorId: number;
  instructorName: string;
  isActive: boolean;
  createdAt: string;
  studentCount: number;
  sessionCount: number;
}

export interface Enrollment {
  id: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  status: string;
  enrolledAt: string;
}

export interface AcademicLoad {
  id: number;
  instructorId: number;
  instructorName: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  term?: string;
  isActive: boolean;
  assignedAt: string;
}

export interface EnrollmentRequest {
  id: number;
  studentUserId: number;
  studentName: string;
  studentEmail: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  status: string;
  requestedAt: string;
  reviewedAt?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; error: string }[];
}
