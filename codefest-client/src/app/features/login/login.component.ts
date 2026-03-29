import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="logo-section">
          <h1 class="logo">CodeFest</h1>
          <p class="tagline">Celebrative Coding Sessions</p>
        </div>

        <div class="signin-section">
          <div id="google-signin-btn"></div>

          @if (error) {
            <div class="error-message">
              <span class="error-icon">!</span>
              {{ error }}
            </div>
          }

          @if (loading) {
            <div class="loading">Signing in...</div>
          }
        </div>

        <p class="hint">Use your institutional Gmail account to sign in.</p>
      </div>
    </div>
  `,
  styles: [
    `
      .login-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        padding: 1rem;
      }
      .login-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1.5rem;
        padding: 3rem 2.5rem;
        max-width: 400px;
        width: 100%;
        text-align: center;
      }
      .logo {
        font-size: 2.5rem;
        font-weight: 800;
        background: linear-gradient(135deg, #667eea, #764ba2);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0 0 0.5rem;
      }
      .tagline {
        color: rgba(255, 255, 255, 0.6);
        margin: 0 0 2rem;
        font-size: 1rem;
      }
      .signin-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .error-message {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        font-size: 0.875rem;
        width: 100%;
      }
      .error-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
        background: rgba(239, 68, 68, 0.3);
        border-radius: 50%;
        margin-right: 0.5rem;
        font-size: 0.75rem;
        font-weight: bold;
      }
      .loading {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.875rem;
      }
      .hint {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.8rem;
        margin: 0;
      }
    `,
  ],
})
export class LoginComponent implements OnInit {
  error: string | null = null;
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // If already authenticated, redirect
    if (this.auth.isAuthenticated) {
      this.redirectByRole();
      return;
    }

    this.initializeGoogleSignIn();
  }

  private initializeGoogleSignIn(): void {
    // Load Google Identity Services if not already loaded
    if (typeof google !== 'undefined' && google.accounts) {
      this.renderGoogleButton();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => this.renderGoogleButton();
      document.head.appendChild(script);
    }
  }

  private renderGoogleButton(): void {
    google.accounts.id.initialize({
      client_id: (window as any).__CODEFEST_GOOGLE_CLIENT_ID__ || '',
      callback: (response: any) => this.handleCredentialResponse(response),
    });

    google.accounts.id.renderButton(
      document.getElementById('google-signin-btn'),
      {
        theme: 'outline',
        size: 'large',
        width: 300,
        text: 'signin_with',
      }
    );
  }

  private handleCredentialResponse(response: any): void {
    this.ngZone.run(() => {
      this.loading = true;
      this.error = null;

      this.auth.loginWithGoogle(response.credential).subscribe({
        next: () => {
          this.loading = false;
          this.redirectByRole();
        },
        error: (err) => {
          this.loading = false;
          this.error =
            err.error?.error ||
            'Sign-in failed. Please try again.';
        },
      });
    });
  }

  private redirectByRole(): void {
    const user = this.auth.currentUser;
    if (!user) return;

    switch (user.role) {
      case 'SuperAdmin':
        this.router.navigate(['/admin']);
        break;
      case 'Instructor':
        this.router.navigate(['/teacher']);
        break;
      case 'Student':
        this.router.navigate(['/student']);
        break;
      default:
        this.router.navigate(['/student']);
    }
  }
}
