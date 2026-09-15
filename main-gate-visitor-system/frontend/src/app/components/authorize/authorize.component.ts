import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AuthorizeResponse } from '../../services/api.service';

@Component({
  selector: 'app-authorize',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="header-section">
        <h2>MAIN GATE VISITOR AUTHORIZATION</h2>
        <p class="subtitle">Enter visitor name(s) and the authorization PIN to initiate gate clearance.</p>
      </div>

      <!-- SCREEN 1: Input Form (Only Visitor Name(s) and Authorization PIN) -->
      <form *ngIf="!isLoading && !authResult && !errorMessage" (ngSubmit)="submitAuthorization()">
        <div class="form-group">
          <label class="form-label">
            Visitor Name(s) <span class="required">*</span>
          </label>
          <div *ngFor="let name of visitorNames; let i = index; trackBy: trackByIndex" class="visitor-row">
            <input
              type="text"
              class="form-control"
              [(ngModel)]="visitorNames[i]"
              [name]="'visitor_' + i"
              placeholder="e.g. John Smith"
              required
            />
            <button
              type="button"
              class="btn-icon"
              *ngIf="visitorNames.length > 1"
              (click)="removeVisitor(i)"
              title="Remove visitor"
            >
              ✕
            </button>
          </div>
          <button type="button" class="btn-secondary btn-add" (click)="addVisitor()">
            + Add Another Visitor
          </button>
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

        <button type="submit" class="btn-primary" [disabled]="!isFormValid()">
          AUTHORIZE ENTRY
        </button>
      </form>

      <!-- SCREEN 2: Loading State -->
      <div *ngIf="isLoading" class="state-container loading-state">
        <div class="spinner"></div>
        <h3>AUTHORIZING VISITOR ENTRY...</h3>
        <p>Verifying PIN and notifying Main Gate Security via real-time Email & SMS.</p>
      </div>

      <!-- SCREEN 3: Success State -->
      <div *ngIf="authResult && authResult.success" class="state-container success-state">
        <div class="badge-success">ENTRY AUTHORIZED</div>

        <div class="auth-id-box">
          <span class="auth-label">Authorization ID:</span>
          <span class="auth-value">{{ authResult.authorizationId }}</span>
        </div>

        <div class="visitors-list-container" *ngIf="submittedVisitors.length">
          <span class="auth-label">Visitors:</span>
          <div class="visitor-chip" *ngFor="let name of submittedVisitors">
            {{ name }}
          </div>
        </div>

        <div class="status-grid">
          <div class="status-item" [ngClass]="isSecurityEmailSent() ? 'status-sent' : 'status-failed'">
            <span class="status-title">Email Notification:</span>
            <div class="status-details-stack">
              <span class="status-badge" *ngIf="isSecurityEmailSent()">✓ Security Email Sent</span>
              <span class="status-badge" *ngIf="!isSecurityEmailSent()">✗ Security Email Failed</span>
              <ng-container *ngFor="let v of getVisitorEmails()">
                <span class="status-badge" *ngIf="v.success">✓ Visitor Email ({{ v.name }}): Sent</span>
                <span class="status-badge" *ngIf="!v.success">✗ Visitor Email ({{ v.name }}): Failed</span>
              </ng-container>
            </div>
          </div>

          <div class="status-item" [ngClass]="isSmsSent() ? 'status-sent' : 'status-failed'">
            <span class="status-title">SMS Notification:</span>
            <div class="status-details-stack">
              <ng-container *ngFor="let v of getVisitorSms()">
                <span class="status-badge" *ngIf="v.success">✓ Visitor SMS ({{ v.name }}): Sent</span>
                <span class="status-badge" *ngIf="!v.success">✗ Visitor SMS ({{ v.name }}): Failed</span>
              </ng-container>
              <ng-container *ngIf="getVisitorSms().length === 0">
                <span class="status-badge" *ngIf="isSmsSent()">✓ Visitor SMS Sent</span>
                <span class="status-badge" *ngIf="!isSmsSent()">✗ Visitor SMS Failed</span>
              </ng-container>
            </div>
          </div>

          <div class="status-item status-pending">
            <span class="status-title">Gate Verification:</span>
            <span class="status-badge">PENDING VERIFICATION</span>
          </div>
        </div>

        <div class="time-container" *ngIf="authorizationTime">
          <span class="time-label">Authorization Time: <strong>{{ authorizationTime }}</strong></span>
        </div>

        <div class="info-note">
          Please have visitors present this Authorization ID at the Main Gate security counter for arrival verification.
        </div>

        <button type="button" class="btn-secondary" (click)="resetForm()">
          Authorize Another Entry
        </button>
      </div>

      <!-- Failure State (Invalid PIN) -->
      <div *ngIf="errorMessage" class="state-container error-state">
        <div class="badge-error">AUTHORIZATION NOT AUTHORIZED</div>
        <p class="error-detail">{{ errorMessage }}</p>
        <button type="button" class="btn-secondary" (click)="resetForm()">
          Try Again
        </button>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: #1e293b;
      border-radius: 12px;
      padding: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      margin: 2rem auto;
    }
    .header-section {
      text-align: center;
      margin-bottom: 2rem;
    }
    .header-section h2 {
      color: #f8fafc;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 0.9rem;
      margin-top: 0.5rem;
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    .form-label {
      display: block;
      color: #cbd5e1;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .required {
      color: #ef4444;
    }
    .visitor-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .form-control {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-control:focus {
      border-color: #38bdf8;
    }
    .pin-input {
      letter-spacing: 4px;
      font-size: 1.2rem;
    }
    .btn-icon {
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0 0.85rem;
      cursor: pointer;
    }
    .btn-primary {
      width: 100%;
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: white;
      font-weight: 700;
      border: none;
      padding: 0.9rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      letter-spacing: 0.5px;
      transition: transform 0.1s, opacity 0.2s;
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 0.5rem;
    }
    .btn-add {
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }
    .state-container {
      text-align: center;
      padding: 2rem 1rem;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .badge-success {
      display: inline-block;
      background: rgba(22, 163, 74, 0.2);
      color: #4ade80;
      border: 1px solid #16a34a;
      padding: 0.4rem 1.2rem;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 1.1rem;
      margin-bottom: 1.25rem;
    }
    .badge-error {
      display: inline-block;
      background: rgba(220, 38, 38, 0.2);
      color: #f87171;
      border: 1px solid #dc2626;
      padding: 0.4rem 1.2rem;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    .auth-id-box {
      background: #0f172a;
      border: 1px solid #334155;
      padding: 0.8rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .auth-label {
      color: #94a3b8;
      font-size: 0.85rem;
    }
    .auth-value {
      font-family: monospace;
      font-weight: 700;
      color: #38bdf8;
      font-size: 1.1rem;
    }
    .status-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      text-align: left;
    }
    .status-item {
      display: flex;
      justify-content: space-between;
      padding: 0.6rem 0.8rem;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .status-sent {
      background: rgba(22, 163, 74, 0.1);
      color: #4ade80;
    }
    .status-failed {
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
    }
    .status-pending {
      background: rgba(234, 179, 8, 0.1);
      color: #facc15;
    }
    .status-badge {
      font-weight: 700;
    }
    .info-note {
      background: rgba(15, 23, 42, 0.6);
      padding: 0.8rem;
      border-radius: 6px;
      font-size: 0.85rem;
      color: #cbd5e1;
      margin-bottom: 1.5rem;
    }
    .error-detail {
      color: #cbd5e1;
      margin-bottom: 1.5rem;
    }
  `]
})
export class AuthorizeComponent {
  visitorNames: string[] = [''];
  pin: string = '';

  submittedVisitors: string[] = [];
  authorizationTime: string = '';

  isLoading = false;
  authResult: AuthorizeResponse | null = null;
  errorMessage = '';

  constructor(private api: ApiService) {}

  trackByIndex(index: number): number {
    return index;
  }

  addVisitor(): void {
    this.visitorNames.push('');
  }

  removeVisitor(index: number): void {
    if (this.visitorNames.length > 1) {
      this.visitorNames.splice(index, 1);
    }
  }

  isFormValid(): boolean {
    const hasNames = this.visitorNames.some(n => n.trim().length > 0);
    return hasNames && this.pin.trim().length > 0;
  }

  isSecurityEmailSent(): boolean {
    return Boolean(
      this.authResult?.emailSent ||
      this.authResult?.emailStatus === 'SENT' ||
      this.authResult?.email?.status === 'sent' ||
      this.authResult?.email?.security === true
    );
  }

  isEmailSent(): boolean {
    return Boolean(
      this.authResult?.emailSent ||
      this.authResult?.emailStatus === 'SENT' ||
      this.authResult?.email?.status === 'sent'
    );
  }

  isSmsSent(): boolean {
    return Boolean(
      this.authResult?.smsSent ||
      this.authResult?.smsStatus === 'SENT' ||
      this.authResult?.sms?.status === 'sent'
    );
  }

  getVisitorEmails(): any[] {
    return this.authResult?.email?.visitors || [];
  }

  getVisitorSms(): any[] {
    return this.authResult?.sms?.visitors || [];
  }

  submitAuthorization(): void {
    if (!this.isFormValid()) return;

    this.isLoading = true;
    this.authResult = null;
    this.errorMessage = '';

    const names = this.visitorNames.map(n => n.trim()).filter(Boolean);
    this.submittedVisitors = [...names];
    this.authorizationTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    this.api.authorizeVisitor({ visitorNames: names, pin: this.pin.trim() }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.authResult = res;
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401) {
          this.errorMessage = 'Invalid authorization PIN.';
        } else {
          this.errorMessage = err.error?.message || 'Server error during authorization.';
        }
      }
    });
  }

  resetForm(): void {
    this.visitorNames = [''];
    this.pin = '';
    this.submittedVisitors = [];
    this.authorizationTime = '';
    this.isLoading = false;
    this.authResult = null;
    this.errorMessage = '';
  }
}
