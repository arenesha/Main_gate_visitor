"""
Gatekeeper - Gate Verification Module (Python / Flask + SQLite)
===============================================================
Handles Main Gate security verification when visitors present their Authorization ID.
Validates PIN, 24-hour expiration window, and updates status in real-time.
"""

import os
import sqlite3
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple
from flask import Flask, request, jsonify

# -----------------------------------------------------------------------------
# Configuration & Logging Setup
# -----------------------------------------------------------------------------
DB_PATH = os.environ.get("DB_PATH", "gatekeeper.sqlite")
LOG_FORMAT = "%(asctime)s [%(levelname)s] [GATE_SECURITY] %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger("gate_verification")

app = Flask(__name__)

# -----------------------------------------------------------------------------
# Database Initialization & Helpers
# -----------------------------------------------------------------------------
def get_db_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Creates a connection to SQLite database with Row factory."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = DB_PATH) -> None:
    """Initializes the authorizations table if it does not already exist."""
    conn = get_db_connection(db_path)
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS authorizations (
                    auth_id TEXT PRIMARY KEY,
                    visitor_name TEXT NOT NULL,
                    pin TEXT NOT NULL,
                    auth_time DATETIME NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    verified_time DATETIME,
                    verified_by TEXT
                )
            """)
        logger.info(f"Database initialized at: {db_path}")
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# Helper: Create Authorization (for testing & seeding)
# -----------------------------------------------------------------------------
def create_authorization(
    visitor_name: str,
    pin: str,
    auth_id: Optional[str] = None,
    auth_time: Optional[datetime] = None,
    db_path: str = DB_PATH
) -> str:
    """
    Helper function to insert a new visitor authorization into the database.
    Generates AUTH-YYYYMMDD-XXXXXX if auth_id is not provided.
    """
    if not auth_id:
        now_utc = datetime.now(timezone.utc)
        date_str = now_utc.strftime("%Y%m%d")
        import random
        random_suffix = f"{random.randint(100000, 999999)}"
        auth_id = f"AUTH-{date_str}-{random_suffix}"

    if auth_time is None:
        auth_time = datetime.now(timezone.utc)

    auth_time_str = auth_time.isoformat()

    conn = get_db_connection(db_path)
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO authorizations (auth_id, visitor_name, pin, auth_time, status)
                VALUES (?, ?, ?, ?, 'pending')
                """,
                (auth_id, visitor_name, str(pin), auth_time_str)
            )
        logger.info(f"Created authorization: ID={auth_id}, Visitor='{visitor_name}', Time={auth_time_str}")
        return auth_id
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# Core Verification Function
# -----------------------------------------------------------------------------
def verify_gate_entry(
    auth_id: str,
    entered_pin: str,
    gate_staff_id: str,
    db_path: str = DB_PATH
) -> Dict[str, Any]:
    """
    Verifies a visitor authorization at the Main Gate.

    Verification Rules:
    1. Look up auth_id in the database -> 'Invalid Auth ID' if not found.
    2. Check if already verified -> 'Already verified'.
    3. Check entered_pin matches stored PIN -> 'PIN mismatch'.
    4. Check authorization hasn't expired (24-hour limit) -> 'Authorization expired'.
    5. If all valid:
       - Update status to 'verified'
       - Set verified_time to current ISO timestamp
       - Set verified_by to gate_staff_id
       - Return status: 'verified', reason: 'Entry authorized'

    Returns:
        dict: {
            "status": "verified" | "denied",
            "reason": str,
            "visitor_name": str or None,
            "verified_time": str or None,
            "auth_id": str
        }
    """
    auth_id = (auth_id or "").strip()
    entered_pin = str(entered_pin or "").strip()
    gate_staff_id = (gate_staff_id or "").strip() or "MAIN_GATE_STAFF"

    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()

    if not auth_id:
        logger.warning(f"Verification FAILED: Missing Auth ID | Staff: {gate_staff_id}")
        return {
            "status": "denied",
            "reason": "Invalid Auth ID",
            "visitor_name": None,
            "verified_time": None,
            "auth_id": auth_id
        }

    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM authorizations WHERE auth_id = ?", (auth_id,))
        row = cursor.fetchone()

        # 1. Check if auth_id exists
        if not row:
            logger.warning(f"Verification FAILED: Auth ID '{auth_id}' not found in database | Staff: {gate_staff_id}")
            return {
                "status": "denied",
                "reason": "Invalid Auth ID",
                "visitor_name": None,
                "verified_time": None,
                "auth_id": auth_id
            }

        visitor_name = row["visitor_name"]
        stored_pin = str(row["pin"]).strip()
        current_status = row["status"]
        stored_auth_time_str = row["auth_time"]
        stored_verified_time = row["verified_time"]

        # 2. Check if already verified
        if current_status == "verified":
            logger.warning(
                f"Verification REJECTED: Auth ID '{auth_id}' already verified at {stored_verified_time} "
                f"by '{row['verified_by']}' | Attempted by: {gate_staff_id}"
            )
            return {
                "status": "denied",
                "reason": "Already verified",
                "visitor_name": visitor_name,
                "verified_time": stored_verified_time,
                "auth_id": auth_id
            }

        # 3. Check PIN match
        if entered_pin != stored_pin:
            logger.warning(
                f"Verification FAILED: PIN mismatch for Auth ID '{auth_id}' | Visitor: '{visitor_name}' | Staff: {gate_staff_id}"
            )
            return {
                "status": "denied",
                "reason": "PIN mismatch",
                "visitor_name": visitor_name,
                "verified_time": None,
                "auth_id": auth_id
            }

        # 4. Check 24-hour expiration
        try:
            auth_dt = datetime.fromisoformat(stored_auth_time_str)
            if auth_dt.tzinfo is None:
                auth_dt = auth_dt.replace(tzinfo=timezone.utc)
        except Exception:
            # Fallback if SQLite stored non-iso string
            auth_dt = datetime.strptime(stored_auth_time_str[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)

        expiration_window = timedelta(hours=24)
        if now_utc - auth_dt > expiration_window:
            with conn:
                conn.execute(
                    "UPDATE authorizations SET status = 'expired' WHERE auth_id = ?",
                    (auth_id,)
                )
            logger.warning(
                f"Verification FAILED: Auth ID '{auth_id}' expired (created {stored_auth_time_str}) | Staff: {gate_staff_id}"
            )
            return {
                "status": "denied",
                "reason": "Authorization expired",
                "visitor_name": visitor_name,
                "verified_time": None,
                "auth_id": auth_id
            }

        # 5. Authorization valid -> Mark as verified
        with conn:
            conn.execute(
                """
                UPDATE authorizations
                SET status = 'verified',
                    verified_time = ?,
                    verified_by = ?
                WHERE auth_id = ?
                """,
                (now_iso, gate_staff_id, auth_id)
            )

        logger.info(
            f"Verification SUCCESS: Entry AUTHORIZED for Visitor='{visitor_name}' | "
            f"Auth ID={auth_id} | Verified At={now_iso} | Staff={gate_staff_id}"
        )

        return {
            "status": "verified",
            "reason": "Entry authorized",
            "visitor_name": visitor_name,
            "verified_time": now_iso,
            "auth_id": auth_id
        }

    finally:
        conn.close()


# -----------------------------------------------------------------------------
# Flask API Routes
# -----------------------------------------------------------------------------
@app.route("/gate/verify", methods=["POST"])
def handle_gate_verify():
    """
    POST /gate/verify
    Body:
        {
            "auth_id": "AUTH-20260913-103816",
            "pin": "1234",
            "gate_staff_id": "GUARD-01"
        }
    Returns:
        JSON with verification result.
    """
    data = request.get_json(silent=True) or {}
    auth_id = data.get("auth_id")
    pin = data.get("pin")
    gate_staff_id = data.get("gate_staff_id", "GATE_STAFF")

    if not auth_id or not pin:
        return jsonify({
            "status": "denied",
            "reason": "Missing required fields: 'auth_id' and 'pin'",
            "visitor_name": None,
            "verified_time": None
        }), 400

    result = verify_gate_entry(
        auth_id=auth_id,
        entered_pin=pin,
        gate_staff_id=gate_staff_id
    )

    status_code = 200 if result["status"] == "verified" else 400
    return jsonify(result), status_code


@app.route("/gate/status/<auth_id>", methods=["GET"])
def handle_gate_status(auth_id: str):
    """
    GET /gate/status/<auth_id>
    Allows frontend to poll the current authorization status in real-time
    (e.g., transitions from 'pending' -> 'verified').
    """
    conn = get_db_connection(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM authorizations WHERE auth_id = ?", (auth_id.strip(),))
        row = cursor.fetchone()

        if not row:
            return jsonify({
                "error": "Authorization not found",
                "auth_id": auth_id,
                "status": "not_found"
            }), 404

        return jsonify({
            "auth_id": row["auth_id"],
            "visitor_name": row["visitor_name"],
            "status": row["status"],
            "auth_time": row["auth_time"],
            "verified_time": row["verified_time"],
            "verified_by": row["verified_by"]
        }), 200
    finally:
        conn.close()


@app.route("/gate/create-test", methods=["POST"])
def handle_create_test_auth():
    """
    Helper route to create a sample authorization for instant testing.
    POST /gate/create-test
    Body: {"visitor_name": "John Doe", "pin": "1234"}
    """
    data = request.get_json(silent=True) or {}
    visitor_name = data.get("visitor_name", "Test Visitor")
    pin = data.get("pin", "1234")

    auth_id = create_authorization(visitor_name=visitor_name, pin=pin)
    return jsonify({
        "message": "Authorization created successfully",
        "auth_id": auth_id,
        "visitor_name": visitor_name,
        "pin": pin,
        "status": "pending"
    }), 201


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "gate_verification"}), 200


# -----------------------------------------------------------------------------
# Module Entry Point
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("GATE_PORT", 5050))
    logger.info(f"Starting Gate Verification Service on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
