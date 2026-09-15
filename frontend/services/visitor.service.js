/**
 * visitor.service.js
 * Central API client for the Main Gate Visitor Entry Authorization System.
 */

const API_BASE_URL = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1")
  ? "" // Same origin
  : "";

const VisitorService = {
  /**
   * Step 1 & 2: Authorize visitor entry
   * @param {string[]} visitorNames
   * @param {string} pin
   */
  async authorizeVisitor(visitorNames, pin) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/visitor/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorNames, pin })
      });
      const data = await response.json();
      return { status: response.status, ok: response.ok, data };
    } catch (error) {
      console.error("Network error during authorization:", error);
      return {
        status: 0,
        ok: false,
        data: { success: false, message: "Network connection error. Server is unreachable." }
      };
    }
  },

  /**
   * Step 4: Gate Security Verification
   * @param {string[]} visitorNames
   * @param {string} pin
   */
  async verifyGateEntry(visitorNames, pin) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/gate/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorNames, pin })
      });
      const data = await response.json();
      return { status: response.status, ok: response.ok, data };
    } catch (error) {
      console.error("Network error during gate verification:", error);
      return {
        status: 0,
        ok: false,
        data: { success: false, entryStatus: "ENTRY NOT AUTHORIZED", message: "Network connection error." }
      };
    }
  },

  /**
   * Step 5: Read Excel records
   */
  async getExcelRecords() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/gate/records`);
      const data = await response.json();
      return { status: response.status, ok: response.ok, data };
    } catch (error) {
      console.error("Network error fetching Excel records:", error);
      return { status: 0, ok: false, data: { success: false, records: [] } };
    }
  },

  /**
   * Get direct download link for visitor_entries.xlsx
   */
  getExcelDownloadUrl() {
    return `${API_BASE_URL}/api/gate/download-excel`;
  },

  /**
   * Change authorization PIN
   */
  async changePin(currentPin, newPin) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/change-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin })
      });
      const data = await response.json();
      return { status: response.status, ok: response.ok, data };
    } catch (error) {
      console.error("Network error during PIN change:", error);
      return {
        status: 0,
        ok: false,
        data: { success: false, message: "Network connection error." }
      };
    }
  },

  /**
   * Get system status
   */
  async getAdminStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/status`);
      const data = await response.json();
      return { status: response.status, ok: response.ok, data };
    } catch (error) {
      return { status: 0, ok: false, data: { success: false } };
    }
  }
};

window.VisitorService = VisitorService;
