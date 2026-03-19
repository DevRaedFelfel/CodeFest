import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-session-creator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="creator-card">
      <h2>Create New Session</h2>

      <div class="form-group">
        <label for="sessionName">Session Name</label>
        <input
          id="sessionName"
          type="text"
          [(ngModel)]="sessionName"
          placeholder="e.g. Intro to Loops"
          maxlength="100"
          autocomplete="off"
        />
      </div>

      <div class="form-group">
        <label>Select Challenges</label>
        @if (loading) {
          <p class="loading-text">Loading challenges...</p>
        } @else if (challenges.length === 0) {
          <p class="loading-text">No challenges available.</p>
        } @else {
          <div class="challenge-list">
            @for (ch of challenges; track ch.id) {
              <label class="challenge-item">
                <input
                  type="checkbox"
                  [checked]="selectedIds.has(ch.id)"
                  (change)="toggleChallenge(ch.id)"
                />
                <span class="challenge-info">
                  <span class="ch-title">{{ ch.title }}</span>
                  <span class="ch-meta">{{ ch.points }} pts &middot; {{ difficultyLabel(ch.difficulty) }}</span>
                </span>
              </label>
            }
          </div>
        }
      </div>

      @if (errorMessage) {
        <div class="error">{{ errorMessage }}</div>
      }

      <button
        class="create-btn"
        (click)="create()"
        [disabled]="!canCreate || creating"
      >
        {{ creating ? 'Creating...' : 'Create Session' }}
      </button>

      <button class="cancel-btn" (click)="cancelled.emit()">Cancel</button>
    </div>
  `,
  styles: [
    `
      .creator-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 2rem;
        max-width: 560px;
        margin: 0 auto;
      }

      h2 {
        margin: 0 0 1.5rem 0;
        font-size: 1.5rem;
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .form-group {
        margin-bottom: 1.25rem;
      }

      .form-group > label {
        display: block;
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
        font-weight: 500;
      }

      input[type='text'] {
        width: 100%;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #fff;
        font-size: 1rem;
        outline: none;
        box-sizing: border-box;
      }

      input[type='text']:focus {
        border-color: #7b2ff7;
      }

      input[type='text']::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }

      .loading-text {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.85rem;
      }

      .challenge-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        max-height: 300px;
        overflow-y: auto;
      }

      .challenge-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem 0.8rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .challenge-item:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .challenge-item input[type='checkbox'] {
        accent-color: #7b2ff7;
        width: 16px;
        height: 16px;
      }

      .challenge-info {
        display: flex;
        flex-direction: column;
      }

      .ch-title {
        color: #fff;
        font-size: 0.9rem;
        font-weight: 500;
      }

      .ch-meta {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.75rem;
      }

      .error {
        background: rgba(255, 71, 87, 0.15);
        border: 1px solid rgba(255, 71, 87, 0.3);
        color: #ff4757;
        padding: 0.65rem 1rem;
        border-radius: 8px;
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }

      .create-btn {
        width: 100%;
        padding: 0.85rem;
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        border: none;
        border-radius: 8px;
        color: #fff;
        font-size: 1.05rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s, transform 0.1s;
        margin-bottom: 0.5rem;
      }

      .create-btn:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .create-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .cancel-btn {
        width: 100%;
        padding: 0.65rem;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.9rem;
        cursor: pointer;
        transition: border-color 0.2s;
      }

      .cancel-btn:hover {
        border-color: rgba(255, 255, 255, 0.3);
      }
    `,
  ],
})
export class SessionCreatorComponent implements OnInit {
  @Output() sessionCreated = new EventEmitter<{
    name: string;
    challengeIds: number[];
  }>();
  @Output() cancelled = new EventEmitter<void>();

  sessionName = '';
  challenges: any[] = [];
  selectedIds = new Set<number>();
  loading = true;
  creating = false;
  errorMessage = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>('/api/challenges').subscribe({
      next: (challenges) => {
        this.challenges = challenges;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get canCreate(): boolean {
    return this.sessionName.trim().length > 0 && this.selectedIds.size > 0;
  }

  toggleChallenge(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  difficultyLabel(difficulty: number): string {
    const labels: Record<number, string> = {
      0: 'Easy',
      1: 'Medium',
      2: 'Hard',
      3: 'Boss',
    };
    return labels[difficulty] ?? 'Unknown';
  }

  create(): void {
    if (!this.canCreate || this.creating) return;
    this.creating = true;
    this.errorMessage = '';
    this.sessionCreated.emit({
      name: this.sessionName.trim(),
      challengeIds: Array.from(this.selectedIds),
    });
  }
}
