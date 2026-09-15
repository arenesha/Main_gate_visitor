/**
 * Controller for Excel Records Log Page (history.html)
 */

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("excel-table-body");
  const btnRefresh = document.getElementById("btn-refresh-excel");

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function loadExcelRecords() {
    try {
      const res = await window.VisitorService.getExcelRecords();
      if (res.ok && res.data && res.data.records) {
        const records = res.data.records;
        if (records.length === 0) {
          tableBody.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">
                No gate check records in visitor_entries.xlsx yet. Perform a gate verification to generate the first record.
              </td>
            </tr>
          `;
          return;
        }

        tableBody.innerHTML = records
          .map((rec, index) => {
            const isAuthorized = rec.entryStatus === "ENTRY AUTHORIZED";
            const badgeClass = isAuthorized
              ? "background: rgba(16, 185, 129, 0.2); color: var(--emerald-400);"
              : "background: rgba(244, 63, 94, 0.2); color: var(--rose-400);";

            return `
              <tr>
                <td style="font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #60a5fa;">#${rec.rowId || index + 1}</td>
                <td><strong>${escapeHtml(rec.visitorNames)}</strong></td>
                <td style="color: var(--text-secondary);">${escapeHtml(rec.entryDate)}</td>
                <td style="color: var(--text-secondary);">${escapeHtml(rec.entryTime)}</td>
                <td><span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${escapeHtml(rec.authorizationStatus)}</span></td>
                <td><span style="${badgeClass} padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em;">${escapeHtml(rec.entryStatus)}</span></td>
              </tr>
            `;
          })
          .join("");
      }
    } catch (e) {
      console.error("Failed to load Excel records:", e);
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--rose-400); padding: 30px;">
            Error reading visitor_entries.xlsx records.
          </td>
        </tr>
      `;
    }
  }

  btnRefresh.addEventListener("click", () => {
    loadExcelRecords();
  });

  loadExcelRecords();
});
