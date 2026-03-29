import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="upload-area">
      <input type="file" #fileInput (change)="onFileSelected($event)" [accept]="accept" hidden />
      <button class="btn-upload" (click)="fileInput.click()">
        {{ buttonText }}
      </button>
      @if (selectedFile) {
        <span class="file-name">{{ selectedFile.name }}</span>
        <button class="btn-import" (click)="onImport()">Import</button>
      }
      @if (result) {
        <div class="result">
          <span class="result-ok">Imported: {{ result.imported }}</span>
          @if (result.skipped > 0) {
            <span class="result-skip">Skipped: {{ result.skipped }}</span>
          }
          @if (result.errors.length > 0) {
            <span class="result-err">Errors: {{ result.errors.length }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .upload-area { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .btn-upload {
      padding: 0.5rem 1rem; border: 1px dashed rgba(255,255,255,0.2);
      background: transparent; color: rgba(255,255,255,0.7); border-radius: 0.5rem;
      cursor: pointer; font-size: 0.85rem;
    }
    .btn-upload:hover { background: rgba(255,255,255,0.05); }
    .btn-import {
      padding: 0.4rem 0.75rem; background: #667eea; border: none; color: white;
      border-radius: 0.4rem; cursor: pointer; font-size: 0.8rem;
    }
    .file-name { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
    .result { display: flex; gap: 0.75rem; font-size: 0.8rem; }
    .result-ok { color: #4ade80; }
    .result-skip { color: #fbbf24; }
    .result-err { color: #f87171; }
  `]
})
export class FileUploadComponent {
  @Input() buttonText = 'Upload File';
  @Input() accept = '.csv,.json';
  @Output() upload = new EventEmitter<File>();

  selectedFile: File | null = null;
  result: any = null;

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0] || null;
    this.result = null;
  }

  onImport(): void {
    if (this.selectedFile) {
      this.upload.emit(this.selectedFile);
    }
  }

  setResult(result: any): void {
    this.result = result;
    this.selectedFile = null;
  }
}
