import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Challenge, DifficultyLevel } from '../../../core/models/challenge.model';

@Component({
  selector: 'app-challenge-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (challenge) {
      <div class="challenge-panel">
        <div class="challenge-header">
          <span class="difficulty" [class]="difficultyClass">
            {{ difficultyLabel }}
          </span>
          <span class="points">{{ challenge.points }} pts</span>
        </div>

        <h2 class="title">{{ challenge.title }}</h2>

        <div class="description" [innerHTML]="formattedDescription"></div>

        @if (visibleTests.length > 0) {
          <div class="test-cases">
            <h3>Example Test Cases</h3>
            @for (test of visibleTests; track test.id) {
              <div class="test-case">
                @if (test.description) {
                  <div class="test-desc">{{ test.description }}</div>
                }
                <div class="test-io">
                  <div class="io-block">
                    <span class="io-label">Input:</span>
                    <pre>{{ test.input }}</pre>
                  </div>
                  <div class="io-block">
                    <span class="io-label">Expected Output:</span>
                    <pre>{{ test.expectedOutput }}</pre>
                  </div>
                </div>
              </div>
            }
          </div>
        }

        @if (hints.length > 0) {
          <div class="hints">
            <h3>Hints</h3>
            @for (hint of hints; track $index) {
              <div class="hint">{{ hint }}</div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .challenge-panel {
        padding: 1.5rem;
        height: 100%;
        overflow-y: auto;
        color: #e0e0e0;
      }

      .challenge-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
      }

      .difficulty {
        padding: 0.25rem 0.75rem;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
      }

      .difficulty.easy {
        background: rgba(46, 213, 115, 0.15);
        color: #2ed573;
      }
      .difficulty.medium {
        background: rgba(255, 165, 2, 0.15);
        color: #ffa502;
      }
      .difficulty.hard {
        background: rgba(255, 71, 87, 0.15);
        color: #ff4757;
      }
      .difficulty.boss {
        background: rgba(123, 47, 247, 0.15);
        color: #7b2ff7;
      }

      .points {
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.85rem;
      }

      .title {
        font-size: 1.4rem;
        font-weight: 700;
        margin: 0 0 1rem;
        color: #fff;
      }

      .description {
        line-height: 1.6;
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.8);
      }

      .description :host ::ng-deep code {
        background: rgba(255, 255, 255, 0.1);
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
        font-family: 'Fira Code', monospace;
        font-size: 0.85em;
      }

      .test-cases {
        margin-top: 1.5rem;
      }

      .test-cases h3,
      .hints h3 {
        font-size: 1rem;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 0.75rem;
        font-weight: 600;
      }

      .test-case {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 0.75rem;
        margin-bottom: 0.75rem;
      }

      .test-desc {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 0.5rem;
      }

      .test-io {
        display: flex;
        gap: 1rem;
      }

      .io-block {
        flex: 1;
      }

      .io-label {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.4);
        display: block;
        margin-bottom: 0.25rem;
      }

      pre {
        background: rgba(0, 0, 0, 0.3);
        padding: 0.5rem;
        border-radius: 4px;
        font-family: 'Fira Code', monospace;
        font-size: 0.85rem;
        margin: 0;
        white-space: pre-wrap;
        color: #e0e0e0;
      }

      .hints {
        margin-top: 1.5rem;
      }

      .hint {
        background: rgba(0, 210, 255, 0.08);
        border-left: 3px solid #00d2ff;
        padding: 0.65rem 0.85rem;
        border-radius: 0 6px 6px 0;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class ChallengePanelComponent {
  @Input() challenge: Challenge | null = null;
  @Input() hints: string[] = [];

  get visibleTests() {
    return this.challenge?.testCases.filter((t) => !t.isHidden) ?? [];
  }

  get difficultyClass(): string {
    if (!this.challenge) return '';
    return DifficultyLevel[this.challenge.difficulty].toLowerCase();
  }

  get difficultyLabel(): string {
    if (!this.challenge) return '';
    return DifficultyLevel[this.challenge.difficulty];
  }

  get formattedDescription(): string {
    if (!this.challenge) return '';
    // Simple markdown-lite: backtick to code, newlines to br
    return this.challenge.description
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }
}
