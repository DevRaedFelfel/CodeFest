import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-qr-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (qrBase64) {
      <div class="qr-container">
        <img [src]="'data:image/png;base64,' + qrBase64" alt="QR Code" class="qr-image" />
        @if (shareableLink) {
          <div class="link-row">
            <input type="text" [value]="shareableLink" readonly class="link-input" #linkInput />
            <button class="btn-copy" (click)="copyLink(linkInput)">
              {{ copied ? 'Copied!' : 'Copy Link' }}
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .qr-container { text-align: center; }
    .qr-image {
      width: 200px; height: 200px; border-radius: 0.75rem;
      background: white; padding: 0.5rem;
    }
    .link-row {
      display: flex; gap: 0.5rem; margin-top: 1rem; justify-content: center;
    }
    .link-input {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.7); padding: 0.4rem 0.6rem; border-radius: 0.4rem;
      font-size: 0.8rem; width: 280px; text-overflow: ellipsis;
    }
    .btn-copy {
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      color: white; padding: 0.4rem 0.75rem; border-radius: 0.4rem;
      cursor: pointer; font-size: 0.8rem; white-space: nowrap;
    }
    .btn-copy:hover { background: rgba(255,255,255,0.15); }
  `]
})
export class QrDisplayComponent {
  @Input() qrBase64: string | null = null;
  @Input() shareableLink: string | null = null;
  copied = false;

  copyLink(input: HTMLInputElement): void {
    navigator.clipboard.writeText(input.value).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    });
  }
}
