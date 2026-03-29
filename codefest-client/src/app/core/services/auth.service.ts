import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { AuthResponse, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'codefest_jwt';
  private currentUser$ = new BehaviorSubject<User | null>(null);
  private token: string | null = null;

  user$ = this.currentUser$.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredAuth();
  }

  get currentUser(): User | null {
    return this.currentUser$.value;
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }

  loginWithGoogle(idToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/google', { idToken }).pipe(
      tap((response) => {
        this.token = response.token;
        this.currentUser$.next(response.user);
        sessionStorage.setItem(this.TOKEN_KEY, response.token);
        sessionStorage.setItem('codefest_user', JSON.stringify(response.user));
      })
    );
  }

  refreshToken(): Observable<{ token: string }> {
    return this.http.post<{ token: string }>('/api/auth/refresh', {}).pipe(
      tap((response) => {
        this.token = response.token;
        sessionStorage.setItem(this.TOKEN_KEY, response.token);
      })
    );
  }

  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>('/api/auth/me').pipe(
      tap((user) => this.currentUser$.next(user))
    );
  }

  logout(): void {
    this.token = null;
    this.currentUser$.next(null);
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem('codefest_user');
    this.router.navigate(['/login']);
  }

  hasRole(role: string): boolean {
    const user = this.currentUser;
    if (!user) return false;
    if (role === 'Student') return true; // All authenticated users have at least Student access
    if (role === 'Instructor')
      return user.role === 'Instructor' || user.role === 'SuperAdmin';
    if (role === 'SuperAdmin') return user.role === 'SuperAdmin';
    return false;
  }

  private loadStoredAuth(): void {
    const token = sessionStorage.getItem(this.TOKEN_KEY);
    const userJson = sessionStorage.getItem('codefest_user');
    if (token && userJson) {
      this.token = token;
      try {
        this.currentUser$.next(JSON.parse(userJson));
      } catch {
        this.logout();
      }
    }
  }
}
