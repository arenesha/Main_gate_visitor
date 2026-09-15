"""
app.py — Gatekeeper: Main Gate Visitor Authorization System (Flask)
Serves Frontend Web Pages + In-Memory Visitor & Gate API Endpoints
"""

import os
import random
import logging
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from notifications import send_authorization_notifications

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gate.app")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

# ---------------------------------------------------------------------------
# In-Memory & Config Store
# ---------------------------------------------------------------------------
AUTHORIZATION_PIN = os.getenv("AUTHORIZATION_PIN", "1234").strip()
ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "admin123").strip()

authorizations: dict = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _generate_auth_id() -> str:
    now = datetime.now()
    return f"AUTH-{now.strftime('%Y%m%d')}-{now.strftime('%H%M%S')}"


def _generate_pin() -> str:
    return str(random.randint(1000, 9999))


def _check_expired(auth_time_iso: str) -> bool:
    """Returns True if authorization is older than 24 hours."""
    try:
        auth_dt = datetime.fromisoformat(auth_time_iso)
        if auth_dt.tzinfo is None:
            auth_dt = auth_dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - auth_dt) > timedelta(hours=24)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Frontend Page Routes
# ---------------------------------------------------------------------------
@app.route("/")
@app.route("/index.html")
def index_page():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/gate")
@app.route("/gate-verification.html")
def gate_page():
    return send_from_directory(FRONTEND_DIR, "gate-verification.html")


@app.route("/admin")
@app.route("/admin.html")
def admin_page():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.route("/<path:filename>")
def serve_static(filename):
    file_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIR, filename)
    return jsonify({"error": "File not found", "path": filename}), 404


# ---------------------------------------------------------------------------
# API: Visitor Authorization (Supports frontend & REST endpoints)
# ---------------------------------------------------------------------------
@app.route("/api/authorize-entry", methods=["POST"])
@app.route("/api/authorize", methods=["POST"])
@app.route("/authorize", methods=["POST"])
def authorize():
    global AUTHORIZATION_PIN
    data = request.get_json(silent=True) or {}
    visitor_names = data.get("visitor_names", [])

    if isinstance(visitor_names, str):
        visitor_names = [visitor_names]

    visitor_names = [str(n).strip() for n in visitor_names if str(n).strip()]

    if not visitor_names:
        return jsonify({
            "success": False,
            "authorization_status": "NOT AUTHORIZED",
            "message": "Please enter at least one visitor name.",
            "error": "visitor_names is required"
        }), 400

    pin = str(data.get("pin") or "").strip()
    if pin and pin != AUTHORIZATION_PIN:
        return jsonify({
            "success": False,
            "authorization_status": "NOT AUTHORIZED",
            "message": "Invalid authorization PIN"
        }), 400

    auth_id = _generate_auth_id()
    auth_pin = pin or _generate_pin()
    auth_time = _now_iso()

    # Store in memory
    authorizations[auth_id] = {
        "auth_id": auth_id,
        "visitor_names": visitor_names,
        "pin": auth_pin,
        "status": "pending",
        "auth_time": auth_time,
        "verified_time": None
    }

    logger.info(f"[AUTHORIZE] Created | ID={auth_id} | PIN={auth_pin} | Visitors={visitor_names} | Time={auth_time}")

    # Dispatch email + SMS
    notif_results = send_authorization_notifications(
        visitor_names=visitor_names,
        auth_id=auth_id,
        auth_pin=auth_pin,
        auth_time=auth_time
    )

    return jsonify({
        "success": True,
        "authorization_status": "AUTHORIZED",
        "auth_id": auth_id,
        "auth_pin": auth_pin,
        "status": "pending",
        "auth_time": auth_time,
        "visitor_names": visitor_names,
        "message": "Visitor entry authorized successfully",
        "notifications": {
            "email": notif_results.get("email", {}),
            "sms": notif_results.get("sms", {})
        }
    }), 200


# ---------------------------------------------------------------------------
# API: Gate Verification
# ---------------------------------------------------------------------------
@app.route("/api/verify-entry", methods=["POST"])
@app.route("/api/verify", methods=["POST"])
@app.route("/gate/verify", methods=["POST"])
def gate_verify():
    data = request.get_json(silent=True) or {}
    auth_id = str(data.get("auth_id") or "").strip()
    entered_pin = str(data.get("pin") or "").strip()
    visitor_names_req = data.get("visitor_names", [])

    timestamp = _now_iso()
    logger.info(f"[VERIFY] Attempt | ID={auth_id} | PIN={entered_pin} | Time={timestamp}")

    record = None
    if auth_id:
        record = authorizations.get(auth_id)
    elif visitor_names_req:
        # Search by visitor names
        req_set = set(str(n).strip().lower() for n in (visitor_names_req if isinstance(visitor_names_req, list) else [visitor_names_req]))
        for r in authorizations.values():
            rec_set = set(str(n).strip().lower() for n in r["visitor_names"])
            if req_set == rec_set or req_set.issubset(rec_set):
                record = r
                auth_id = r["auth_id"]
                break

    if not record:
        logger.warning(f"[VERIFY] DENIED | Reason: Authorization not found")
        return jsonify({
            "success": False,
            "status": "denied",
            "entry_status": "ENTRY NOT AUTHORIZED",
            "reason": "Authorization record not found for the given visitor/PIN",
            "message": "Authorization record not found. Please verify visitor names and PIN.",
            "visitor_names": []
        }), 404

    visitor_names = record["visitor_names"]

    # 1. Check if already verified
    if record["status"] == "verified":
        logger.warning(f"[VERIFY] DENIED | Reason: Already verified | ID={auth_id}")
        return jsonify({
            "success": False,
            "status": "denied",
            "entry_status": "ENTRY ALREADY COMPLETED",
            "reason": "Already verified",
            "message": f"This authorization was already used at {record['verified_time']}",
            "visitor_names": visitor_names,
            "verified_time": record["verified_time"]
        }), 400

    # 2. PIN match
    if entered_pin and entered_pin != record["pin"] and entered_pin != AUTHORIZATION_PIN:
        logger.warning(f"[VERIFY] DENIED | Reason: PIN mismatch | ID={auth_id}")
        return jsonify({
            "success": False,
            "status": "denied",
            "entry_status": "ENTRY NOT AUTHORIZED",
            "reason": "PIN mismatch",
            "message": "Incorrect PIN provided.",
            "visitor_names": visitor_names
        }), 400

    # 3. Expiration check (24 hours)
    if _check_expired(record["auth_time"]):
        record["status"] = "expired"
        logger.warning(f"[VERIFY] DENIED | Reason: Authorization expired | ID={auth_id}")
        return jsonify({
            "success": False,
            "status": "denied",
            "entry_status": "ENTRY NOT AUTHORIZED",
            "reason": "Authorization expired",
            "message": "Authorization expired (valid for 24 hours only).",
            "visitor_names": visitor_names
        }), 400

    # 4. Mark verified
    record["status"] = "verified"
    record["verified_time"] = timestamp

    logger.info(f"[VERIFY] ✅ SUCCESS | ID={auth_id} | Visitors={visitor_names} | Time={timestamp}")

    return jsonify({
        "success": True,
        "status": "verified",
        "entry_status": "ENTRY AUTHORIZED",
        "reason": "Entry authorized",
        "message": "Entry authorized successfully",
        "visitor_names": visitor_names,
        "auth_id": auth_id,
        "verified_time": timestamp
    }), 200


# ---------------------------------------------------------------------------
# API: Status Polling
# ---------------------------------------------------------------------------
@app.route("/gate/status/<auth_id>", methods=["GET"])
def gate_status(auth_id: str):
    auth_id = (auth_id or "").strip()
    record = authorizations.get(auth_id)

    if not record:
        return jsonify({"error": "Authorization not found", "auth_id": auth_id, "status": "not_found"}), 404

    if record["status"] == "pending" and _check_expired(record["auth_time"]):
        record["status"] = "expired"

    return jsonify({
        "auth_id": auth_id,
        "visitor_names": record["visitor_names"],
        "status": record["status"],
        "auth_time": record["auth_time"],
        "verified_time": record["verified_time"]
    }), 200


# ---------------------------------------------------------------------------
# API: Admin Change PIN
# ---------------------------------------------------------------------------
@app.route("/api/admin/change-pin", methods=["POST"])
def admin_change_pin():
    global AUTHORIZATION_PIN
    data = request.get_json(silent=True) or {}
    current_pin = str(data.get("current_pin") or "").strip()
    new_pin = str(data.get("new_pin") or "").strip()
    confirm_new_pin = str(data.get("confirm_new_pin") or "").strip()
    admin_secret = str(data.get("admin_secret") or "").strip()

    if admin_secret and admin_secret != ADMIN_SECRET:
        return jsonify({"success": False, "message": "Invalid administrator secret key"}), 403

    if current_pin != AUTHORIZATION_PIN:
        return jsonify({"success": False, "message": "Current PIN is incorrect"}), 400

    if not (4 <= len(new_pin) <= 6 and new_pin.isdigit()):
        return jsonify({"success": False, "message": "New PIN must be between 4 and 6 digits"}), 400

    if new_pin != confirm_new_pin:
        return jsonify({"success": False, "message": "New PIN and confirmation do not match"}), 400

    AUTHORIZATION_PIN = new_pin
    logger.info("Authorization PIN successfully updated by admin.")
    return jsonify({"success": True, "message": "Authorization PIN updated successfully"}), 200


# ---------------------------------------------------------------------------
# GET /health & /api/health
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "gatekeeper",
        "active_authorizations": len(authorizations)
    }), 200


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8003"))
    logger.info(f"Gatekeeper starting on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
