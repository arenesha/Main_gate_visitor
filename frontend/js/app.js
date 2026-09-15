/**
 * Main Controller for Visitor Authorization Page (index.html)
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("authorization-form");
  const visitorContainer = document.getElementById("visitor-rows-container");
  const btnAddVisitor = document.getElementById("btn-add-visitor");
  const btnClearVisitors = document.getElementById("btn-clear-visitors");
  const visitorCountBadge = document.getElementById("visitor-count-badge");
  const pinInput = document.getElementById("auth-pin");
  const btnTogglePin = document.getElementById("btn-toggle-pin");
  const btnAuthorize = document.getElementById("btn-authorize");

  const resultSuccessCard = document.getElementById("result-success-card");
  const resultDangerCard = document.getElementById("result-danger-card");
  const successMsgText = document.getElementById("success-msg-text");
  const dangerMsgText = document.getElementById("danger-msg-text");

  const resVisitorsList = document.getElementById("res-visitors-list");
  const resDate = document.getElementById("res-date");
  const resTime = document.getElementById("res-time");
  const resEmailTag = document.getElementById("res-email-tag");
  const resSmsTag = document.getElementById("res-sms-tag");

  // -------------------------------------------------------------
  // Dynamic Visitor Rows Management
  // -------------------------------------------------------------
  function updateVisitorRows() {
    const rows = visitorContainer.querySelectorAll(".visitor-row");
    const count = rows.length;

    visitorCountBadge.textContent = `${count} Visitor${count > 1 ? "s" : ""}`;

    rows.forEach((row, index) => {
      const input = row.querySelector(".visitor-input");
      const removeBtn = row.querySelector(".btn-remove-visitor");

      if (input) {
        input.placeholder = `Visitor ${index + 1} Name (e.g. ${index === 0 ? "Rahul Patil" : index === 1 ? "Sneha Sharma" : "Amit Kumar"})`;
      }

      if (removeBtn) {
        // Show delete button only if there is more than 1 row
        removeBtn.style.display = count > 1 ? "flex" : "none";
      }
    });
  }

  function addVisitorRow(initialValue = "") {
    const row = document.createElement("div");
    row.className = "visitor-row";
    row.innerHTML = `
      <div class="input-with-icon">
        <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <input type="text" class="text-input visitor-input" required value="${escapeHtml(initialValue)}">
      </div>
      <button type="button" class="btn-icon-danger btn-remove-visitor" title="Remove Visitor">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    const removeBtn = row.querySelector(".btn-remove-visitor");
    removeBtn.addEventListener("click", () => {
      row.remove();
      updateVisitorRows();
    });

    visitorContainer.appendChild(row);
    updateVisitorRows();

    const input = row.querySelector(".visitor-input");
    if (input) input.focus();
  }

  btnAddVisitor.addEventListener("click", () => {
    addVisitorRow();
  });

  btnClearVisitors.addEventListener("click", () => {
    visitorContainer.innerHTML = "";
    addVisitorRow();
    pinInput.value = "";
    hideResultCards();
  });

  // Attach delete listeners to pre-existing rows
  visitorContainer.querySelectorAll(".btn-remove-visitor").forEach((btn) => {
    btn.addEventListener("click", function () {
      this.closest(".visitor-row").remove();
      updateVisitorRows();
    });
  });

  // -------------------------------------------------------------
  // Toggle PIN Visibility
  // -------------------------------------------------------------
  btnTogglePin.addEventListener("click", () => {
    const isPassword = pinInput.type === "password";
    pinInput.type = isPassword ? "text" : "password";
    btnTogglePin.innerHTML = isPassword
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  });

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function hideResultCards() {
    resultSuccessCard.classList.remove("show");
    resultDangerCard.classList.remove("show");
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // -------------------------------------------------------------
  // Form Submission
  // -------------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideResultCards();

    // Collect all non-empty visitor names
    const inputs = visitorContainer.querySelectorAll(".visitor-input");
    const visitorNames = [];
    inputs.forEach((input) => {
      const val = input.value.trim();
      if (val) visitorNames.push(val);
    });

    if (visitorNames.length === 0) {
      dangerMsgText.textContent = "Please enter at least one visitor name.";
      resultDangerCard.classList.add("show");
      return;
    }

    const pin = pinInput.value.trim();
    if (!pin) {
      dangerMsgText.textContent = "Authorization PIN is required.";
      resultDangerCard.classList.add("show");
      return;
    }

    // Set button loading state
    btnAuthorize.disabled = true;
    btnAuthorize.classList.add("loading");

    try {
      const response = await window.VisitorService.authorizeVisitor(visitorNames, pin);
      const resData = response.data;

      if (response.ok && resData.success) {
        // --- SUCCESS FLOW ---
        successMsgText.textContent = resData.message || "Visitor entry authorized successfully.";
        resVisitorsList.textContent = resData.visitorNames.join(", ");
        resDate.textContent = resData.date || new Date().toLocaleDateString();
        resTime.textContent = resData.time || new Date().toLocaleTimeString();

        // Email Notification Status Badge
        if (resData.emailSent) {
          resEmailTag.innerHTML = `<span class="status-tag status-sent">✓ Email notification sent to Main Gate Security</span>`;
        } else {
          resEmailTag.innerHTML = `<span class="status-tag status-failed">✗ Security email notification failed</span>`;
        }

        // SMS Notification Status Badge
        if (resData.smsSent) {
          resSmsTag.innerHTML = `<span class="status-tag status-sent">✓ SMS notification sent</span>`;
        } else {
          resSmsTag.innerHTML = `<span class="status-tag status-failed">✗ SMS notification failed</span>`;
        }

        resultSuccessCard.classList.add("show");
        resultSuccessCard.scrollIntoView({ behavior: "smooth", block: "nearest" });

        // Clear PIN for security
        pinInput.value = "";
      } else {
        // --- FAILURE / INVALID PIN FLOW ---
        const errorMsg = resData.message || "Invalid authorization PIN.";
        dangerMsgText.textContent = errorMsg;
        resultDangerCard.classList.add("show");
        resultDangerCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (err) {
      console.error("Submission error:", err);
      dangerMsgText.textContent = "Network error. Unable to communicate with the authorization server.";
      resultDangerCard.classList.add("show");
    } finally {
      btnAuthorize.disabled = false;
      btnAuthorize.classList.remove("loading");
    }
  });

  // Initial setup
  updateVisitorRows();
});
