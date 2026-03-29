import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaginatedResponse } from '../models/user.model';
import {
  SessionFilters,
  SessionListItem,
  SessionDetailResponse,
} from '../models/session-list.model';

@Injectable({ providedIn: 'root' })
export class SessionListService {
  private readonly baseUrl = '/api/teacher';

  constructor(private http: HttpClient) {}

  getSessions(filters: SessionFilters): Observable<PaginatedResponse<SessionListItem>> {
    let params = new HttpParams()
      .set('page', filters.page.toString())
      .set('pageSize', filters.pageSize.toString())
      .set('sortBy', filters.sortBy)
      .set('sortDir', filters.sortDir);

    if (filters.courseId) params = params.set('courseId', filters.courseId.toString());
    if (filters.status) params = params.set('status', filters.status);
    if (filters.progress) params = params.set('progress', filters.progress);
    if (filters.search) params = params.set('search', filters.search);

    return this.http.get<PaginatedResponse<SessionListItem>>(
      `${this.baseUrl}/sessions`,
      { params }
    );
  }

  getSessionDetail(code: string): Observable<SessionDetailResponse> {
    return this.http.get<SessionDetailResponse>(`${this.baseUrl}/sessions/${code}`);
  }

  bulkEndSessions(codes: string[]): Observable<{ ended: number }> {
    return this.http.post<{ ended: number }>(
      `${this.baseUrl}/sessions/bulk-end`,
      { sessionCodes: codes }
    );
  }

  bulkDeleteSessions(codes: string[]): Observable<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(
      `${this.baseUrl}/sessions/bulk-delete`,
      { sessionCodes: codes }
    );
  }
}
