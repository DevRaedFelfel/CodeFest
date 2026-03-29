import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            @for (col of columns; track col.key) {
              <th>{{ col.label }}</th>
            }
            @if (actions.length > 0) {
              <th>Actions</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of data; track row[trackBy]) {
            <tr>
              @for (col of columns; track col.key) {
                <td>
                  @if (col.render) {
                    <span [innerHTML]="col.render(row)"></span>
                  } @else {
                    {{ row[col.key] }}
                  }
                </td>
              }
              @if (actions.length > 0) {
                <td class="actions-cell">
                  @for (action of actions; track action.label) {
                    <button
                      class="btn-action"
                      [class]="'btn-action btn-' + (action.type || 'default')"
                      (click)="action.handler(row)"
                    >
                      {{ action.label }}
                    </button>
                  }
                </td>
              }
            </tr>
          }
          @if (data.length === 0) {
            <tr><td [attr.colspan]="columns.length + (actions.length > 0 ? 1 : 0)" class="empty">No data</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.5); font-size: 0.8rem; font-weight: 500; text-transform: uppercase;
    }
    td {
      padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 0.9rem; color: rgba(255,255,255,0.8);
    }
    .empty { text-align: center; color: rgba(255,255,255,0.3); padding: 2rem; }
    .actions-cell { display: flex; gap: 0.5rem; }
    .btn-action {
      padding: 0.3rem 0.6rem; border: 1px solid rgba(255,255,255,0.15);
      background: transparent; color: rgba(255,255,255,0.7); border-radius: 0.3rem;
      cursor: pointer; font-size: 0.75rem;
    }
    .btn-action:hover { background: rgba(255,255,255,0.05); }
    .btn-danger { border-color: rgba(239,68,68,0.3); color: #f87171; }
    .btn-danger:hover { background: rgba(239,68,68,0.1); }
    .btn-success { border-color: rgba(34,197,94,0.3); color: #4ade80; }
    .btn-success:hover { background: rgba(34,197,94,0.1); }
  `]
})
export class DataTableComponent {
  @Input() columns: { key: string; label: string; render?: (row: any) => string }[] = [];
  @Input() data: any[] = [];
  @Input() actions: { label: string; type?: string; handler: (row: any) => void }[] = [];
  @Input() trackBy = 'id';
}
