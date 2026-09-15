/**
 * Gatekeeper Frontend Client Logic
 */

// Toast feedback system
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success'
        ? '<polyline points="20 6 9 17 4 12"></polyline>'
        : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// PIN Toggle Helper
function setupPinToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  });
}

// Helper: Extract clean visitor names array from container
function getVisitorNames(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const inputs = container.querySelectorAll('.visitor-input');
  const names = [];
  inputs.forEach(inp => {
    const val = inp.value.strip ? inp.value.trim() : inp.value;
    if (val) names.push(val);
  });
  return names;
}

// Setup Dynamic Visitor Rows
function setupDynamicVisitorList(containerId, addBtnId) {
  const container = document.getElementById(containerId);
  const addBtn = document.getElementById(addBtnId);
  if (!container || !addBtn) return;

  function updateRows() {
    const rows = container.querySelectorAll('.visitor-row');
    rows.forEach((row, idx) => {
      const inp = row.querySelector('.visitor-input');
      if (inp) inp.placeholder = `Visitor ${idx + 1} Name (e.g. Rahul Sharma)`;
      const rm = row.querySelector('.btn-remove-row');
      if (rm) rm.style.display = rows.length > 1 ? 'flex' : 'none';
    });
  }

  addBtn.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'visitor-row';
    row.innerHTML = `
      <div class="input-wrapper" style="flex:1;">
        <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <input type="text" class="form-control visitor-input" placeholder="Visitor Name" required autocomplete="off">
      </div>
      <button type="button" class="btn-remove-row" title="Remove Visitor">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
      row.remove();
      updateRows();
    });

    container.appendChild(row);
    updateRows();
    row.querySelector('.visitor-input').focus();
  });

  updateRows();
}

// Global escape HTML function
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
