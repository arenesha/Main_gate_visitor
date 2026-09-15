import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, GateVerifyResponse } from '../../services/api.service';

@Component({
  selector: 'app-gate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="header-section">
        <h2>MAIN GATE VERIFICATION</h2>
        <p class="subtitle">Security Counter Clearance — Enter the Authorization ID and PIN to verify entry.</p>
      </div>

      <!-- Verification Input Form (Only Authorization ID and Authorization PIN) -->
      <form *ngIf="!isLoading && !verifyResult && !errorMessage" (ngSubmit)="verifyEntry()">
        <div class="form-group">
          <label class="form-label">
            Authorization ID <span class="required">*</span>
          </label>
          <input
            type="text"
            class="form-control"
            [(ngModel)]="authorizationId"
            name="authorizationId"
            placeholder="e.g. AUTH-20260913-8F42K1"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">
            Authorization PIN <span class="required">*</span>
          </label>
          <input
            type="password"
            class="form-control pin-input"
            [(ngModel)]="pin"
            name="pin"
            placeholder="••••"
            required
          />
        </div>

        <button type="submit" class="btn-primary" [disabled]="!authorizationId.trim() || !pin.trim()">
          VERIFY ENTRY
        </button>
      </form>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="state-container loading-state">
        <div class="spinner"></div>
        <h3>VERIFYING...</h3>
        <p>Checking database record, expiration window, and single-use status.</p>
      </div>

      <!-- SCREEN: ENTRY AUTHORIZED -->
      <div *ngIf="verifyResult && verifyResult.success" class="state-container success-state">
        <div class="badge-authorized">✓ ENTRY AUTHORIZED</div>

        <div class="details-box">
          <div class="detail-row">
            <span class="detail-label">Visitor Name(s):</span>
            <span class="detail-value names">{{ getVisitorNamesDisplay() }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Authorization ID:</span>
            <span class="detail-value mono">{{ verifyResult.authorizationId }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value valid">AUTHORIZED & ENTERED</span>
          </div>
          <div class="detail-row" *ngIf="verifyResult.entryDate">
            <span class="detail-label">Entry Date:</span>
            <span class="detail-value">{{ verifyResult.entryDate }}</span>
          </div>
          <div class="detail-row" *ngIf="verifyResult.entryTime">
            <span class="detail-label">Entry Time:</span>
            <span class="detail-value">{{ verifyResult.entryTime }}</span>
          </div>
        </div>

        <div class="excel-notice">
          ✓ ENTRY RECORDED SUCCESSFULLY (Logged to SQLite and Excel automatically)
        </div>

        <button type="button" class="btn-secondary" (click)="reset()">
          Verify Next Visitor
        </button>
      </div>

      <!-- SCREEN: ENTRY NOT AUTHORIZED -->
      <div *ngIf="errorMessage" class="state-container error-state">
        <div class="badge-denied">✕ ENTRY NOT AUTHORIZED</div>
        <p class="error-reason">{{ errorMessage }}</p>
        <div class="security-advisory">
          Gate entry denied. No record appended to Excel log. Please re-check the Authorization ID and PIN.
        </div>
        <button type="button" class="btn-secondary" (click)="reset()">
          Try Again
        </button>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      max-width: 560px;
      margin: 0 auto;
    }
    .header-section { margin-bottom: 24px; text-align: center; }
    h2 { margin: 0 0 8px; font-size: 1.25rem; font-weight: 700; color: #0f172a; }
    .subtitle { margin: 0; font-size: 0.875rem; color: #64748b; line-height: 1.4; }
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; margin-bottom: 6px; font-size: 0.875rem; font-weight: 600; color: #334155; }
    .required { color: #ef4444; }
    .form-control {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.95rem;
      color: #0f172a;
      box-sizing: border-box;
    }
    .pin-input { font-family: monospace; letter-spacing: 4px; font-size: 1.1rem; }
    .btn-primary {
      width: 100%;
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 12px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-secondary {
      width: 100%;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 10px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 16px;
    }
    .state-container { text-align: center; padding: 12px 0; }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .badge-authorized {
      display: inline-block;
      background: #10b981;
      color: #ffffff;
      padding: 8px 24px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 1.1rem;
      margin-bottom: 20px;
    }
    .badge-denied {
      display: inline-block;
      background: #ef4444;
      color: #ffffff;
      padding: 8px 24px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 1.1rem;
      margin-bottom: 16px;
    }
    .details-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      text-align: left;
      margin-bottom: 16px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.875rem;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; font-weight: 500; }
    .detail-value { color: #0f172a; font-weight: 600; }
    .detail-value.names { color: #2563eb; }
    .detail-value.mono { font-family: monospace; }
    .detail-value.valid { color: #10b981; }
    .excel-notice {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      padding: 10px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .error-reason { font-size: 1rem; color: #b91c1c; font-weight: 600; margin-bottom: 12px; }
    .security-advisory {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 12px;
      border-radius: 6px;
      font-size: 0.85rem;
    }
  `]
})
export class GateComponent {
  authorizationId = '';
  pin = '';
  isLoading = false;
  verifyResult: GateVerifyResponse | null = null;
  errorMessage = '';

  constructor(private api: ApiService) {}

  verifyEntry() {
    if (!this.authorizationId.trim() || !this.pin.trim()) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.verifyResult = null;

    this.api.verifyGate({
      authorizationId: this.authorizationId.trim(),
      pin: this.pin.trim()
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.entryStatus === 'ENTRY AUTHORIZED') {
          this.verifyResult = res;
        } else {
          this.errorMessage = res.message || 'Authorization ID or PIN does not match records.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Server connection failed.';
      }
    });
  }

  getVisitorNamesDisplay(): string {
    if (!this.verifyResult || !this.verifyResult.visitorNames) return '-';
    if (Array.isArray(this.verifyResult.visitorNames)) {
      return this.verifyResult.visitorNames.join(', ');
    }
    return String(this.verifyResult.visitorNames);
  }

  reset() {
    this.authorizationId = '';
    this.pin = '';
    this.verifyResult = null;
    this.errorMessage = '';
    this.isLoading = false;
  }
}
