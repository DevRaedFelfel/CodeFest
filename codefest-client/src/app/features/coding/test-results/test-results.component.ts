import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubmissionResult } from '../../../core/models/submission.model';

@Component({
  selector: 'app-test-results',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (result) {
      <div class="results-panel" [class.visible]="visible">
        <div class="results-header">
          <h3>
            Test Results
            <span class="score" [class.all-passed]="result.allPassed">
              {{ result.testsPassed }}/{{ result.testsTotal }}
            </span>
          </h3>
          <button class="close-btn" (click)="close.emit()">&#x2715;</button>
        </div>

        @if (result.compileError) {
          <div class="error-block compile-error">
            <div class="error-label">Compile Error</div>
            <pre>{{ result.compileError }}</pre>
          </div>
        }

        @if (result.runtimeError) {
          <div class="error-block runtime-error">
            <div class="error-label">Runtime Error</div>
            <pre>{{ result.runtimeError }}</pre>
          </div>
        }

        @if (result.patternResults.length) {
          @for (pr of result.patternResults; track $index) {
            @if (!pr.passed) {
              <div class="error-block pattern-error">
                <div class="error-label">Code Check Failed</div>
                <p>{{ pr.failureMessage }}</p>
              </div>
            }
          }
        }

        @if (!result.compileError) {
          <div class="test-list">
            @for (test of result.testResults; track test.testCaseId) {
              <div class="test-item" [class.passed]="test.passed" [class.failed]="!test.passed">
                <span class="test-icon">{{ test.passed ? '&#10003;' : '&#10007;' }}</span>
                <div class="test-info">
                  @if (test.isHidden) {
                    <span class="test-name">Hidden Test</span>
                  } @else {
                    <span class="test-name">{{ test.description ?? 'Test ' + test.testCaseId }}</span>
                    @if (!test.passed && test.expectedOutput) {
                      <div class="test-diff">
                        <div class="diff-row">
                          <span class="diff-label">Expected:</span>
                          <pre>{{ test.expectedOutput }}</pre>
                        </div>
                        <div class="diff-row">
                          <span class="diff-label">Got:</span>
                          <pre>{{ test.actualOutput ?? '(no output)' }}</pre>
                        </div>
                      </div>
                    }
                  }
                </div>
              </div>
            }
          </div>
        }

        @if (result.allPassed) {
          <div class="all-passed-banner">
            All tests passed! +{{ result.pointsAwarded }} points
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .results-panel {
        background: #1a1a2e;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding: 1rem;
        max-height: 50vh;
        overflow-y: auto;
        animation: slideUp 0.2s ease-out;
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
      }

      .results-header h3 {
        margin: 0;
        font-size: 1rem;
        color: #fff;
      }

      .score {
        margin-left: 0.5rem;
        padding: 0.2rem 0.5rem;
        border-radius: 8px;
        font-size: 0.85rem;
        background: rgba(255, 71, 87, 0.15);
        color: #ff4757;
      }

      .score.all-passed {
        background: rgba(46, 213, 115, 0.15);
        color: #2ed573;
      }

      .close-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 1.1rem;
        cursor: pointer;
        padding: 0.25rem;
      }

      .close-btn:hover {
        color: #fff;
      }

      .error-block {
        background: rgba(255, 71, 87, 0.08);
        border: 1px solid rgba(255, 71, 87, 0.2);
        border-radius: 8px;
        padding: 0.75rem;
        margin-bottom: 0.75rem;
      }

      .error-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #ff4757;
        text-transform: uppercase;
        margin-bottom: 0.5rem;
      }

      .error-block pre,
      .error-block p {
        margin: 0;
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.8);
        white-space: pre-wrap;
      }

      .pattern-error {
        border-color: rgba(255, 165, 2, 0.3);
        background: rgba(255, 165, 2, 0.08);
      }

      .pattern-error .error-label {
        color: #ffa502;
      }

      .test-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .test-item {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.03);
      }

      .test-icon {
        font-size: 1rem;
        width: 1.2rem;
        flex-shrink: 0;
      }

      .test-item.passed .test-icon {
        color: #2ed573;
      }
      .test-item.failed .test-icon {
        color: #ff4757;
      }

      .test-name {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.8);
      }

      .test-diff {
        margin-top: 0.5rem;
      }

      .diff-row {
        margin-bottom: 0.35rem;
      }

      .diff-label {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.4);
      }

      .test-diff pre {
        background: rgba(0, 0, 0, 0.3);
        padding: 0.35rem 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        margin: 0.15rem 0 0;
        white-space: pre-wrap;
        color: #e0e0e0;
      }

      .all-passed-banner {
        margin-top: 0.75rem;
        padding: 0.75rem;
        background: rgba(46, 213, 115, 0.12);
        border: 1px solid rgba(46, 213, 115, 0.25);
        border-radius: 8px;
        text-align: center;
        color: #2ed573;
        font-weight: 600;
        font-size: 1rem;
      }
    `,
  ],
})
export class TestResultsComponent {
  @Input() result: SubmissionResult | null = null;
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();
}
