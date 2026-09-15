/**
 * Main Gate Visitor Entry Authorization System - Client Logic
 */

// Determine API Base URL (supports direct file view, custom port, or FastAPI static serving)
const API_BASE_URL = (window.location.protocol === 'file:' || window.location.port !== '8003')
  ? 'http://localhost:8003'
  : '';

// Helper: Toggle PIN visibility
function setupPinToggle(toggleBtnId, pinInputId) {
  const toggleBtn = document.getElementById(toggleBtnId);
  const pinInput = document.getElementById(pinInputId);
  if (!toggleBtn || !pinInput) return;

  toggleBtn.addEventListener('click', () => {
    const isPassword = pinInput.type === 'password';
    pinInput.type = isPassword ? 'text' : 'password';
    toggleBtn.setAttribute('aria-label', isPassword ? 'Hide PIN' : 'Show PIN');
    toggleBtn.innerHTML = isPassword
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  });
}

// Helper: Manage dynamic visitor list rows
function setupDynamicVisitorList(containerId, addBtnId) {
  const container = document.getElementById(containerId);
  const addBtn = document.getElementById(addBtnId);
  if (!container || !addBtn) return;

  function updatePlaceholders() {
    const rows = container.querySelectorAll('.visitor-row');
    rows.forEach((row, index) => {
      const input = row.querySelector('.visitor-input');
      if (input) {
        input.placeholder = `Visitor ${index + 1} Name (e.g. Rahul Sharma)`;
      }
      const removeBtn = row.querySelector('.btn-remove-row');
      if (removeBtn) {
        // Only show remove button if more than 1 row
        removeBtn.style.display = rows.length > 1 ? 'flex' : 'none';
      }
    });
  }

  addBtn.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'visitor-row';
    row.innerHTML = `
      <div class="input-icon-wrapper">
        <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <input type="text" class="form-control visitor-input" placeholder="Visitor Name" autocomplete="off">
      </div>
      <button type="button" class="btn-remove-row" title="Remove Visitor" aria-label="Remove Visitor">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;
    const removeBtn = row.querySelector('.btn-remove-row');
    removeBtn.addEventListener('click', () => {
      row.remove();
      updatePlaceholders();
    });

    container.appendChild(row);
    updatePlaceholders();
    const newInput = row.querySelector('.visitor-input');
    if (newInput) newInput.focus();
  });

  // Initial placeholder update
  updatePlaceholders();
}

// Extract clean visitor names array from container
function getVisitorNames(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const inputs = container.querySelectorAll('.visitor-input');
  const names = [];
  inputs.forEach(input => {
    const val = input.value.trim();
    if (val) names.push(val);
  });
  return names;
}

// -------------------------------------------------------------
// 1. PAGE: VISITOR ENTRY AUTHORIZATION (index.html)
// -------------------------------------------------------------
function initAuthorizationPage() {
  const form = document.getElementById('authorization-form');
  if (!form) return;

  setupDynamicVisitorList('visitor-list-container', 'btn-add-visitor');
  setupPinToggle('btn-toggle-pin', 'auth-pin');

  const submitBtn = document.getElementById('btn-authorize-entry');
  const resultBox = document.getElementById('auth-result-box');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    resultBox.className = 'result-box';
    resultBox.innerHTML = '';

    const visitorNames = getVisitorNames('visitor-list-container');
    const pin = document.getElementById('auth-pin').value.trim();

    if (visitorNames.length === 0) {
      showAuthError('Please enter at least one visitor name.');
      return;
    }

    if (!pin) {
      showAuthError('Please enter the authorization PIN.');
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE_URL}/api/authorize-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_names: visitorNames, pin: pin })
      });

      const data = await response.json();

      if (data.success && data.authorization_status === 'AUTHORIZED') {
        const namesFormatted = (data.visitor_names && data.visitor_names.length)
          ? data.visitor_names.join(', ')
          : visitorNames.join(', ');

        resultBox.className = 'result-box status-success show';
        resultBox.innerHTML = `
          <div class="result-header">
            <div class="result-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div class="result-title">AUTHORIZATION SUCCESSFUL</div>
          </div>
          <div class="result-details">
            <div class="detail-row">
              <span class="detail-label">Visitor Name(s)</span>
              <span class="detail-value">${escapeHtml(namesFormatted)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Authorization Status</span>
              <span class="detail-value badge-authorized">${escapeHtml(data.authorization_status)}</span>
            </div>
          </div>
          <div class="notification-feedback">
            <div class="notification-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Notification sent to Main Gate Security.</span>
            </div>
            <div class="notification-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Visitor notification sent successfully.</span>
            </div>
          </div>
        `;
      } else {
        showAuthError(data.message || 'Invalid authorization PIN');
      }
    } catch (err) {
      showAuthError('Failed to connect to authorization server. Ensure backend is running.');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  function showAuthError(msg) {
    resultBox.className = 'result-box status-danger show';
    resultBox.innerHTML = `
      <div class="result-header">
        <div class="result-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
        <div class="result-title">NOT AUTHORIZED</div>
      </div>
      <div class="result-details">
        <div class="detail-row">
          <span class="detail-label">Authorization Status</span>
          <span class="detail-value" style="color: var(--status-danger);">NOT AUTHORIZED</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Details</span>
          <span class="detail-value">${escapeHtml(msg)}</span>
        </div>
      </div>
    `;
  }
}

// -------------------------------------------------------------
// 2. PAGE: MAIN GATE VERIFICATION (gate-verification.html)
// -------------------------------------------------------------
function initVerificationPage() {
  const form = document.getElementById('verification-form');
  if (!form) return;

  setupDynamicVisitorList('verify-visitor-list-container', 'btn-add-verify-visitor');
  setupPinToggle('btn-toggle-verify-pin', 'verify-pin');

  const submitBtn = document.getElementById('btn-verify-entry');
  const resultBox = document.getElementById('verify-result-box');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    resultBox.className = 'result-box';
    resultBox.innerHTML = '';

    const visitorNames = getVisitorNames('verify-visitor-list-container');
    const pin = document.getElementById('verify-pin').value.trim();

    if (visitorNames.length === 0) {
      displayGateResult('ENTRY NOT AUTHORIZED', 'Please enter at least one visitor name.', 'status-danger');
      return;
    }

    if (!pin) {
      displayGateResult('ENTRY NOT AUTHORIZED', 'Please enter the authorization PIN.', 'status-danger');
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_names: visitorNames, pin: pin })
      });

      const data = await response.json();

      if (data.entry_status === 'ENTRY AUTHORIZED') {
        displayGateResult(
          'ENTRY AUTHORIZED',
          'Verification successful. Gate entry recorded automatically in Excel.',
          'status-success'
        );
      } else if (data.entry_status === 'ENTRY ALREADY COMPLETED') {
        displayGateResult(
          'ENTRY ALREADY COMPLETED',
          data.message || 'This visitor authorization has already passed the gate.',
          'status-warning'
        );
      } else {
        displayGateResult(
          'ENTRY NOT AUTHORIZED',
          data.message || 'Invalid visitor authorization.',
          'status-danger'
        );
      }
    } catch (err) {
      displayGateResult(
        'ENTRY NOT AUTHORIZED',
        'Could not connect to security server. Ensure backend is running.',
        'status-danger'
      );
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  function displayGateResult(title, message, statusClass) {
    resultBox.className = `result-box ${statusClass} show`;

    let iconSvg = '';
    if (statusClass === 'status-success') {
      iconSvg = `<polyline points="20 6 9 17 4 12"></polyline>`;
    } else if (statusClass === 'status-warning') {
      iconSvg = `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>`;
    } else {
      iconSvg = `<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>`;
    }

    resultBox.innerHTML = `
      <div class="result-header">
        <div class="result-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${iconSvg}</svg>
        </div>
        <div class="result-title">${title}</div>
      </div>
      <div class="result-details">
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">${title}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Details</span>
          <span class="detail-value">${escapeHtml(message)}</span>
        </div>
      </div>
    `;
  }
}

// -------------------------------------------------------------
// 3. PAGE: ADMIN PIN CONFIGURATION (admin.html)
// -------------------------------------------------------------
function initAdminPage() {
  const form = document.getElementById('admin-pin-form');
  if (!form) return;

  setupPinToggle('btn-toggle-current-pin', 'current-pin');
  setupPinToggle('btn-toggle-new-pin', 'new-pin');
  setupPinToggle('btn-toggle-confirm-pin', 'confirm-pin');

  const submitBtn = document.getElementById('btn-change-pin');
  const resultBox = document.getElementById('admin-result-box');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    resultBox.className = 'result-box';
    resultBox.innerHTML = '';

    const currentPin = document.getElementById('current-pin').value.trim();
    const newPin = document.getElementById('new-pin').value.trim();
    const confirmPin = document.getElementById('confirm-pin').value.trim();
    const adminSecret = document.getElementById('admin-secret')
      ? document.getElementById('admin-secret').value.trim()
      : '';

    if (!currentPin || !newPin || !confirmPin) {
      showAdminResult(false, 'Please fill in all PIN fields.');
      return;
    }

    if (newPin !== confirmPin) {
      showAdminResult(false, 'New PIN and Confirm New PIN do not match.');
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_pin: currentPin,
          new_pin: newPin,
          confirm_new_pin: confirmPin,
          admin_secret: adminSecret || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        showAdminResult(true, 'PIN UPDATED SUCCESSFULLY');
        form.reset();
      } else {
        showAdminResult(false, `PIN UPDATE FAILED: ${data.message || 'Invalid details'}`);
      }
    } catch (err) {
      showAdminResult(false, 'PIN UPDATE FAILED: Server connection error');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  function showAdminResult(isSuccess, message) {
    resultBox.className = `result-box ${isSuccess ? 'status-success' : 'status-danger'} show`;
    resultBox.innerHTML = `
      <div class="result-header">
        <div class="result-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            ${isSuccess
              ? '<polyline points="20 6 9 17 4 12"></polyline>'
              : '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'}
          </svg>
        </div>
        <div class="result-title">${isSuccess ? 'PIN UPDATED SUCCESSFULLY' : 'PIN UPDATE FAILED'}</div>
      </div>
      <div class="result-details">
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">${escapeHtml(message)}</span>
        </div>
      </div>
    `;
  }
}

// Utility: HTML escaping
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Auto-initialize based on elements present on current page
document.addEventListener('DOMContentLoaded', () => {
  initAuthorizationPage();
  initVerificationPage();
  initAdminPage();
});
