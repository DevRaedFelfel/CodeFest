import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  User,
  Course,
  Enrollment,
  AcademicLoad,
  EnrollmentRequest,
  PaginatedResponse,
  ImportResult,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  // --- Users ---
  getUsers(
    role?: string,
    search?: string,
    page = 1,
    pageSize = 20
  ): Observable<PaginatedResponse<any>> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);
    if (role) params = params.set('role', role);
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<any>>('/api/admin/users', { params });
  }

  createUser(data: {
    email: string;
    displayName: string;
    role: string;
  }): Observable<any> {
    return this.http.post('/api/admin/users', data);
  }

  updateUser(
    id: number,
    data: { displayName?: string; role?: string; isActive?: boolean }
  ): Observable<any> {
    return this.http.put(`/api/admin/users/${id}`, data);
  }

  deactivateUser(id: number): Observable<void> {
    return this.http.delete<void>(`/api/admin/users/${id}`);
  }

  uploadUsers(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportResult>('/api/admin/users/upload', formData);
  }

  // --- Courses ---
  getCourses(): Observable<Course[]> {
    return this.http.get<Course[]>('/api/admin/courses');
  }

  createCourse(data: {
    code: string;
    name: string;
    description?: string;
    instructorId: number;
  }): Observable<Course> {
    return this.http.post<Course>('/api/admin/courses', data);
  }

  updateCourse(
    id: number,
    data: {
      code?: string;
      name?: string;
      description?: string;
      instructorId?: number;
      isActive?: boolean;
    }
  ): Observable<Course> {
    return this.http.put<Course>(`/api/admin/courses/${id}`, data);
  }

  deactivateCourse(id: number): Observable<void> {
    return this.http.delete<void>(`/api/admin/courses/${id}`);
  }

  uploadCourses(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportResult>('/api/admin/courses/upload', formData);
  }

  // --- Enrollments ---
  getEnrollments(
    courseId?: number,
    status?: string,
    page = 1,
    pageSize = 20
  ): Observable<PaginatedResponse<Enrollment>> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);
    if (courseId) params = params.set('courseId', courseId);
    if (status) params = params.set('status', status);
    return this.http.get<PaginatedResponse<Enrollment>>(
      '/api/admin/enrollments',
      { params }
    );
  }

  createEnrollment(data: {
    studentId: number;
    courseId: number;
  }): Observable<Enrollment> {
    return this.http.post<Enrollment>('/api/admin/enrollments', data);
  }

  deleteEnrollment(id: number): Observable<void> {
    return this.http.delete<void>(`/api/admin/enrollments/${id}`);
  }

  uploadEnrollments(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportResult>(
      '/api/admin/enrollments/upload',
      formData
    );
  }

  // --- Enrollment Requests ---
  getEnrollmentRequests(
    courseId?: number,
    status?: string,
    page = 1,
    pageSize = 20
  ): Observable<PaginatedResponse<EnrollmentRequest>> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);
    if (courseId) params = params.set('courseId', courseId);
    if (status) params = params.set('status', status);
    return this.http.get<PaginatedResponse<EnrollmentRequest>>(
      '/api/admin/enrollment-requests',
      { params }
    );
  }

  reviewEnrollmentRequest(
    id: number,
    status: string
  ): Observable<void> {
    return this.http.put<void>(`/api/admin/enrollment-requests/${id}`, {
      status,
    });
  }

  // --- Academic Loads ---
  getAcademicLoads(): Observable<AcademicLoad[]> {
    return this.http.get<AcademicLoad[]>('/api/admin/academic-loads');
  }

  createAcademicLoad(data: {
    instructorId: number;
    courseId: number;
    term?: string;
  }): Observable<AcademicLoad> {
    return this.http.post<AcademicLoad>('/api/admin/academic-loads', data);
  }

  updateAcademicLoad(
    id: number,
    data: { term?: string; isActive?: boolean }
  ): Observable<AcademicLoad> {
    return this.http.put<AcademicLoad>(
      `/api/admin/academic-loads/${id}`,
      data
    );
  }

  deleteAcademicLoad(id: number): Observable<void> {
    return this.http.delete<void>(`/api/admin/academic-loads/${id}`);
  }

  // --- Dashboard Stats ---
  getDashboardStats(): Observable<{
    userCount: number;
    courseCount: number;
    activeSessionCount: number;
    pendingRequestCount: number;
  }> {
    // Aggregate from existing endpoints
    return new Observable((subscriber) => {
      Promise.all([
        this.getUsers(undefined, undefined, 1, 1).toPromise(),
        this.getCourses().toPromise(),
        this.getEnrollmentRequests(undefined, 'Pending', 1, 1).toPromise(),
      ]).then(([users, courses, requests]) => {
        subscriber.next({
          userCount: users?.totalCount ?? 0,
          courseCount: courses?.length ?? 0,
          activeSessionCount: 0,
          pendingRequestCount: requests?.totalCount ?? 0,
        });
        subscriber.complete();
      });
    });
  }
}
