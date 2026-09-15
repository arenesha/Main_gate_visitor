import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService, Visitor, EntryRecord } from '../../services/api.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-container">
      <div class="header-section">
        <h2>ADMINISTRATION CONTROL CENTER</h2>
        <p class="subtitle">Manage visitor directory, gate-wide authorization PIN, and live entry logs.</p>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-nav">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab === 'visitors'"
          (click)="setTab('visitors')"
        >
          👥 Visitor Directory
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab === 'entries'"
          (click)="setTab('entries')"
        >
          📊 Entry Records (Excel/DB)
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab === 'pin'"
          (click)="setTab('pin')"
        >
          🔑 Authorization PIN
        </button>
      </div>

      <!-- TAB 1: VISITOR DIRECTORY -->
      <div *ngIf="activeTab === 'visitors'" class="tab-content">
        <div class="action-bar">
          <input
            type="text"
            class="search-input"
            placeholder="Search visitor by name, email, or phone..."
            [(ngModel)]="searchQuery"
            (input)="loadVisitors()"
          />
          <button type="button" class="btn-primary" (click)="openAddVisitorModal()">
            + Add New Visitor
          </button>
        </div>

        <div *ngIf="visitorMessage" class="alert-box" [ngClass]="visitorMessageType">
          {{ visitorMessage }}
        </div>

        <div class="table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Visitor Name</th>
                <th>Email Address</th>
                <th>Phone Number</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let v of visitors">
                <td class="font-bold">{{ v.name }}</td>
                <td>{{ v.email || '—' }}</td>
                <td>{{ v.phone || '—' }}</td>
                <td>
                  <span class="status-badge" [class.active]="v.active" [class.inactive]="!v.active">
                    {{ v.active ? 'Active' : 'Disabled' }}
                  </span>
                </td>
                <td style="text-align: right;">
                  <button type="button" class="btn-sm btn-edit" (click)="editVisitor(v)">Edit</button>
                  <button type="button" class="btn-sm btn-delete" (click)="deleteVisitor(v.id!)">Delete</button>
                </td>
              </tr>
              <tr *ngIf="visitors.length === 0">
                <td colspan="5" class="empty-state">No visitors found in directory.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Add/Edit Visitor Modal -->
        <div *ngIf="showVisitorModal" class="modal-backdrop">
          <div class="modal-card">
            <h3>{{ editingVisitorId ? 'Edit Visitor' : 'Add Visitor to Directory' }}</h3>
            <div class="form-group">
              <label>Visitor Name <span class="required">*</span></label>
              <input type="text" class="form-control" [(ngModel)]="visitorForm.name" required />
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" class="form-control" [(ngModel)]="visitorForm.email" placeholder="e.g. visitor@company.com" />
            </div>
            <div class="form-group">
              <label>Phone Number (SMS)</label>
              <input type="text" class="form-control" [(ngModel)]="visitorForm.phone" placeholder="e.g. +1234567890" />
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" [(ngModel)]="visitorForm.active" /> Active in Directory
              </label>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="closeVisitorModal()">Cancel</button>
              <button type="button" class="btn-primary" (click)="saveVisitor()">Save Visitor</button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: ENTRY RECORDS DASHBOARD -->
      <div *ngIf="activeTab === 'entries'" class="tab-content">
        <div class="action-bar" style="justify-content: space-between;">
          <p class="subtitle" style="margin: 0; align-self: center;">
            Records verified at Main Gate and appended to <code>visitor-entry-records.xlsx</code>.
          </p>
          <button type="button" class="btn-secondary" (click)="loadEntries()">
            🔄 Refresh Records
          </button>
        </div>

        <div class="table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Visitor Name(s)</th>
                <th>Authorization ID</th>
                <th>Entry Date</th>
                <th>Entry Time</th>
                <th>Auth Status</th>
                <th>Entry Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of entries">
                <td class="font-bold">{{ entry.visitorNames }}</td>
                <td class="mono">{{ entry.authorizationId }}</td>
                <td>{{ entry.entryDate }}</td>
                <td>{{ entry.entryTime }}</td>
                <td>
                  <span class="badge-tag tag-auth">{{ entry.authorizationStatus }}</span>
                </td>
                <td>
                  <span class="badge-tag tag-entered">{{ entry.entryStatus }}</span>
                </td>
              </tr>
              <tr *ngIf="entries.length === 0">
                <td colspan="6" class="empty-state">No gate entry records found yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 3: ADMIN PIN MANAGEMENT -->
      <div *ngIf="activeTab === 'pin'" class="tab-content" style="max-width: 480px; margin: 0 auto;">
        <div class="card" style="padding: 24px;">
          <h3 style="margin-top: 0; font-size: 1.1rem; color: #0f172a;">Change Authorization PIN</h3>
          <p class="subtitle" style="margin-bottom: 20px;">
            Updates the gate-wide PIN stored with bcrypt hashing in the database.
          </p>

          <div *ngIf="pinMessage" class="alert-box" [ngClass]="pinMessageType">
            {{ pinMessage }}
          </div>

          <form (ngSubmit)="submitPinChange()">
            <div class="form-group">
              <label class="form-label">Current PIN <span class="required">*</span></label>
              <input type="password" class="form-control pin-input" [(ngModel)]="pinForm.currentPin" name="currentPin" required />
            </div>
            <div class="form-group">
              <label class="form-label">New PIN (4–6 digits) <span class="required">*</span></label>
              <input type="password" class="form-control pin-input" [(ngModel)]="pinForm.newPin" name="newPin" maxlength="6" required />
            </div>
            <div class="form-group">
              <label class="form-label">Confirm New PIN <span class="required">*</span></label>
              <input type="password" class="form-control pin-input" [(ngModel)]="pinForm.confirmNewPin" name="confirmNewPin" maxlength="6" required />
            </div>
            <button type="submit" class="btn-primary" [disabled]="!isPinFormValid()">
              CHANGE PIN
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-container {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px 16px;
    }
    .header-section { margin-bottom: 24px; text-align: center; }
    h2 { font-size: 1.35rem; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .subtitle { font-size: 0.875rem; color: #64748b; }
    .tabs-nav {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 24px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
    }
    .tab-btn {
      background: none;
      border: none;
      font-size: 0.95rem;
      font-weight: 600;
      color: #64748b;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
    }
    .tab-btn.active {
      background: #eff6ff;
      color: #2563eb;
    }
    .action-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .search-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.9rem;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      text-align: left;
    }
    .data-table th {
      background: #f8fafc;
      padding: 12px 16px;
      font-weight: 600;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    .font-bold { font-weight: 600; color: #0f172a; }
    .mono { font-family: monospace; font-size: 0.8rem; color: #2563eb; }
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-badge.active { background: #ecfdf5; color: #059669; }
    .status-badge.inactive { background: #fef2f2; color: #dc2626; }
    .badge-tag {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .tag-auth { background: #eff6ff; color: #2563eb; }
    .tag-entered { background: #ecfdf5; color: #059669; }
    .empty-state { text-align: center; color: #94a3b8; padding: 24px; }
    .btn-sm {
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      margin-left: 6px;
      border: 1px solid transparent;
    }
    .btn-edit { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
    .btn-delete { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
    .alert-box {
      padding: 12px;
      border-radius: 6px;
      font-size: 0.875rem;
      margin-bottom: 16px;
    }
    .alert-box.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .alert-box.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-card {
      background: #ffffff;
      padding: 24px;
      border-radius: 10px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
    }
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.85rem; color: #334155; }
    .form-control {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-sizing: border-box;
    }
    .pin-input { font-family: monospace; letter-spacing: 4px; }
    .checkbox-group { display: flex; align-items: center; font-size: 0.85rem; }
    .required { color: #ef4444; }
  `]
})
export class AdminComponent implements OnInit {
  activeTab: 'visitors' | 'entries' | 'pin' = 'visitors';

  // Visitor Directory
  visitors: Visitor[] = [];
  searchQuery = '';
  showVisitorModal = false;
  editingVisitorId: number | null = null;
  visitorForm: Visitor = { name: '', email: '', phone: '', active: 1 };
  visitorMessage = '';
  visitorMessageType: 'success' | 'error' = 'success';

  // Entry Records
  entries: EntryRecord[] = [];

  // PIN Form
  pinForm = { currentPin: '', newPin: '', confirmNewPin: '' };
  pinMessage = '';
  pinMessageType: 'success' | 'error' = 'success';

  constructor(private api: ApiService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    const path = window.location.pathname;
    if (path.includes('pin')) this.activeTab = 'pin';
    else if (path.includes('entries')) this.activeTab = 'entries';
    else this.activeTab = 'visitors';

    this.loadVisitors();
    this.loadEntries();
  }

  setTab(tab: 'visitors' | 'entries' | 'pin') {
    this.activeTab = tab;
    this.visitorMessage = '';
    this.pinMessage = '';
    if (tab === 'visitors') this.loadVisitors();
    if (tab === 'entries') this.loadEntries();
  }

  loadVisitors() {
    this.api.getVisitors(this.searchQuery).subscribe({
      next: (res) => {
        if (res.success) this.visitors = res.visitors;
      },
      error: (err) => console.error('Failed to load visitors:', err)
    });
  }

  openAddVisitorModal() {
    this.editingVisitorId = null;
    this.visitorForm = { name: '', email: '', phone: '', active: 1 };
    this.showVisitorModal = true;
  }

  editVisitor(v: Visitor) {
    this.editingVisitorId = v.id!;
    this.visitorForm = { name: v.name, email: v.email || '', phone: v.phone || '', active: !!v.active };
    this.showVisitorModal = true;
  }

  closeVisitorModal() {
    this.showVisitorModal = false;
  }

  saveVisitor() {
    if (!this.visitorForm.name.trim()) return;

    if (this.editingVisitorId) {
      this.api.updateVisitor(this.editingVisitorId, this.visitorForm).subscribe({
        next: (res) => {
          this.closeVisitorModal();
          this.visitorMessage = 'Visitor updated successfully.';
          this.visitorMessageType = 'success';
          this.loadVisitors();
        },
        error: (err) => {
          this.visitorMessage = err.error?.message || 'Failed to update visitor.';
          this.visitorMessageType = 'error';
        }
      });
    } else {
      this.api.createVisitor(this.visitorForm).subscribe({
        next: (res) => {
          this.closeVisitorModal();
          this.visitorMessage = 'Visitor created successfully.';
          this.visitorMessageType = 'success';
          this.loadVisitors();
        },
        error: (err) => {
          this.visitorMessage = err.error?.message || 'Failed to create visitor.';
          this.visitorMessageType = 'error';
        }
      });
    }
  }

  deleteVisitor(id: number) {
    if (!confirm('Are you sure you want to delete this visitor?')) return;
    this.api.deleteVisitor(id).subscribe({
      next: () => {
        this.visitorMessage = 'Visitor deleted successfully.';
        this.visitorMessageType = 'success';
        this.loadVisitors();
      },
      error: (err) => {
        this.visitorMessage = err.error?.message || 'Failed to delete visitor.';
        this.visitorMessageType = 'error';
      }
    });
  }

  loadEntries() {
    this.api.getEntries().subscribe({
      next: (res) => {
        if (res.success) this.entries = res.entries;
      },
      error: (err) => console.error('Failed to load entry records:', err)
    });
  }

  isPinFormValid(): boolean {
    return (
      this.pinForm.currentPin.trim().length > 0 &&
      this.pinForm.newPin.trim().length >= 4 &&
      this.pinForm.newPin === this.pinForm.confirmNewPin
    );
  }

  submitPinChange() {
    if (!this.isPinFormValid()) return;
    this.pinMessage = '';

    this.api.changePin(this.pinForm).subscribe({
      next: (res) => {
        this.pinMessage = res.message || 'Authorization PIN changed successfully.';
        this.pinMessageType = 'success';
        this.pinForm = { currentPin: '', newPin: '', confirmNewPin: '' };
      },
      error: (err) => {
        this.pinMessage = err.error?.message || 'Failed to change PIN.';
        this.pinMessageType = 'error';
      }
    });
  }
}
