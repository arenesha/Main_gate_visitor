/**
 * Controller for Admin PIN Change & System Status (admin.html)
 */

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("change-pin-form");
  const currentPinInput = document.getElementById("current-pin");
  const newPinInput = document.getElementById("new-pin");
  const confirmNewPinInput = document.getElementById("confirm-new-pin");
  const btnChangePin = document.getElementById("btn-change-pin");

  const adminSuccessCard = document.getElementById("admin-success-card");
  const adminDangerCard = document.getElementById("admin-danger-card");
  const adminSuccessText = document.getElementById("admin-success-text");
  const adminDangerText = document.getElementById("admin-danger-text");

  const statTotal = document.getElementById("stat-total");
  const statEmail = document.getElementById("stat-email");
  const statSms = document.getElementById("stat-sms");

  function hideFeedback() {
    adminSuccessCard.classList.remove("show");
    adminDangerCard.classList.remove("show");
  }

  // Load system stats
  async function loadSystemStatus() {
    try {
      const res = await window.VisitorService.getAdminStatus();
      if (res.ok && res.data) {
        statTotal.textContent = res.data.totalAuthorizations || 0;
        statEmail.innerHTML = res.data.emailRecipientConfigured
          ? `<span style="color: var(--emerald-400);">● Configured</span>`
          : `<span style="color: var(--text-muted);">○ Mock Mode</span>`;
        statSms.innerHTML = res.data.smsRecipientConfigured
          ? `<span style="color: var(--emerald-400);">● Configured</span>`
          : `<span style="color: var(--text-muted);">○ Mock Mode</span>`;
      }
    } catch (e) {
      console.error("Status load failed", e);
    }
  }

  loadSystemStatus();

  // Form submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFeedback();

    const currentPin = currentPinInput.value.trim();
    const newPin = newPinInput.value.trim();
    const confirmNewPin = confirmNewPinInput.value.trim();

    if (!currentPin || !newPin) {
      adminDangerText.textContent = "Please fill in all PIN fields.";
      adminDangerCard.classList.add("show");
      return;
    }

    if (newPin !== confirmNewPin) {
      adminDangerText.textContent = "New PIN and confirmation PIN do not match.";
      adminDangerCard.classList.add("show");
      return;
    }

    if (newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      adminDangerText.textContent = "New PIN must be between 4 and 8 digits.";
      adminDangerCard.classList.add("show");
      return;
    }

    btnChangePin.disabled = true;
    btnChangePin.classList.add("loading");

    try {
      const response = await window.VisitorService.changePin(currentPin, newPin);
      const resData = response.data;

      if (response.ok && resData.success) {
        adminSuccessText.textContent = resData.message || "Authorization PIN updated successfully.";
        adminSuccessCard.classList.add("show");
        form.reset();
      } else {
        adminDangerText.textContent = resData.message || "Current PIN is incorrect.";
        adminDangerCard.classList.add("show");
      }
    } catch (err) {
      adminDangerText.textContent = "Network error. Failed to update PIN.";
      adminDangerCard.classList.add("show");
    } finally {
      btnChangePin.disabled = false;
      btnChangePin.classList.remove("loading");
    }
  });
});
