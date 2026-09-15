/**
 * Controller for Gate Verification (gate.html)
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("gate-verify-form");
  const container = document.getElementById("gate-visitor-container");
  const btnAdd = document.getElementById("btn-add-gate-visitor");
  const countBadge = document.getElementById("gate-visitor-count");
  const pinInput = document.getElementById("gate-pin");
  const btnTogglePin = document.getElementById("btn-toggle-gate-pin");
  const btnVerify = document.getElementById("btn-gate-verify");

  const verdictAuthorized = document.getElementById("verdict-authorized");
  const verdictDenied = document.getElementById("verdict-denied");
  const authVerdictNames = document.getElementById("auth-verdict-names");
  const authVerdictTime = document.getElementById("auth-verdict-time");
  const deniedVerdictNames = document.getElementById("denied-verdict-names");
  const deniedReasonText = document.getElementById("denied-reason-text");

  function updateCounts() {
    const rows = container.querySelectorAll(".visitor-row");
    const count = rows.length;
    countBadge.textContent = `${count} Visitor${count > 1 ? "s" : ""}`;

    rows.forEach((row, idx) => {
      const input = row.querySelector(".gate-visitor-input");
      const removeBtn = row.querySelector(".btn-remove-gate-visitor");
      if (input) input.placeholder = `Visitor ${idx + 1} Name`;
      if (removeBtn) removeBtn.style.display = count > 1 ? "flex" : "none";
    });
  }

  function addRow(val = "") {
    const row = document.createElement("div");
    row.className = "visitor-row";
    row.innerHTML = `
      <div class="input-with-icon">
        <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <input type="text" class="text-input gate-visitor-input" required value="${val}">
      </div>
      <button type="button" class="btn-icon-danger btn-remove-gate-visitor" title="Remove">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    row.querySelector(".btn-remove-gate-visitor").addEventListener("click", () => {
      row.remove();
      updateCounts();
    });

    container.appendChild(row);
    updateCounts();
    row.querySelector(".gate-visitor-input").focus();
  }

  btnAdd.addEventListener("click", () => addRow());

  container.querySelectorAll(".btn-remove-gate-visitor").forEach((btn) => {
    btn.addEventListener("click", function () {
      this.closest(".visitor-row").remove();
      updateCounts();
    });
  });

  btnTogglePin.addEventListener("click", () => {
    const isPass = pinInput.type === "password";
    pinInput.type = isPass ? "text" : "password";
  });

  function hideVerdicts() {
    verdictAuthorized.classList.remove("show");
    verdictDenied.classList.remove("show");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideVerdicts();

    const inputs = container.querySelectorAll(".gate-visitor-input");
    const names = [];
    inputs.forEach((inp) => {
      const v = inp.value.trim();
      if (v) names.push(v);
    });

    const pin = pinInput.value.trim();

    if (names.length === 0 || !pin) return;

    btnVerify.disabled = true;
    btnVerify.classList.add("loading");

    try {
      const res = await window.VisitorService.verifyGateEntry(names, pin);
      const data = res.data;

      if (data.entryStatus === "ENTRY AUTHORIZED") {
        authVerdictNames.textContent = (data.visitorNames || names).join(", ");
        authVerdictTime.textContent = `${data.entryDate || ""} ${data.entryTime || ""}`;
        verdictAuthorized.classList.add("show");
        verdictAuthorized.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        deniedVerdictNames.textContent = names.join(", ");
        deniedReasonText.textContent = data.message || "Invalid PIN or unauthorized visitor.";
        verdictDenied.classList.add("show");
        verdictDenied.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (err) {
      console.error(err);
      deniedVerdictNames.textContent = names.join(", ");
      deniedReasonText.textContent = "Network error communicating with server.";
      verdictDenied.classList.add("show");
    } finally {
      btnVerify.disabled = false;
      btnVerify.classList.remove("loading");
    }
  });

  updateCounts();
});
