import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-live-code-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ studentName }}</h2>
          <button class="close-btn" (click)="close.emit()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="code-section">
            <h3>Current Code</h3>
            <pre class="code-block"><code>{{ code || 'No code submitted yet.' }}</code></pre>
          </div>

          <div class="submissions-section">
            <h3>Submission History</h3>
            @if (submissions.length > 0) {
              <table class="submissions-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Tests Passed</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  @for (sub of submissions; track $index) {
                    <tr [class.passed]="sub.allPassed">
                      <td>{{ formatTime(sub.timestamp) }}</td>
                      <td>{{ sub.testsPassed }} / {{ sub.testsTotal }}</td>
                      <td>{{ sub.pointsAwarded }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="no-data">No submissions yet.</p>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .modal {
        background: linear-gradient(135deg, #1a1640, #2a2555);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        width: 90%;
        max-width: 800px;
        max-height: 85vh;
        overflow-y: auto;
        padding: 1.5rem;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
      }

      .modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
        color: #fff;
      }

      .close-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #fff;
        font-size: 1.5rem;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .close-btn:hover {
        background: rgba(255, 71, 87, 0.3);
      }

      .modal-body h3 {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0 0 0.75rem 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .code-section {
        margin-bottom: 1.5rem;
      }

      .code-block {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 1rem;
        overflow-x: auto;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 0.85rem;
        color: #e0e0e0;
        line-height: 1.5;
        margin: 0;
        max-height: 300px;
        overflow-y: auto;
      }

      .submissions-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }

      .submissions-table th {
        text-align: left;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 500;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .submissions-table td {
        padding: 0.5rem 0.75rem;
        color: rgba(255, 255, 255, 0.7);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .submissions-table tr.passed td {
        color: #2ed573;
      }

      .no-data {
        color: rgba(255, 255, 255, 0.35);
        font-size: 0.85rem;
        text-align: center;
        padding: 1rem;
      }
    `,
  ],
})
export class LiveCodeViewerComponent {
  @Input() studentName = '';
  @Input() code = '';
  @Input() submissions: any[] = [];
  @Output() close = new EventEmitter<void>();

  formatTime(timestamp: string): string {
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '--:--:--';
    }
  }
}
