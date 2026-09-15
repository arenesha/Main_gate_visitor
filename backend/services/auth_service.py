import os
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import threading

logger = logging.getLogger("auth_service")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
STORE_FILE = os.path.join(DATA_DIR, "auth_store.json")
_lock = threading.Lock()


class AuthService:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self._initial_pin = os.getenv("AUTHORIZATION_PIN", "1234").strip()
        self._admin_secret = os.getenv("ADMIN_SECRET_KEY", "admin123").strip()
        self._state: Dict[str, Any] = {
            "current_pin": self._initial_pin,
            "authorizations": []
        }
        self._load_store()

    def _load_store(self) -> None:
        """Load persistent authorization state and PIN from disk."""
        if os.path.exists(STORE_FILE):
            try:
                with open(STORE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._state["current_pin"] = data.get("current_pin", self._initial_pin)
                    self._state["authorizations"] = data.get("authorizations", [])
                    logger.info("Loaded authorization store from disk.")
            except Exception as e:
                logger.error(f"Error loading auth_store.json: {e}")
                self._save_store()
        else:
            self._save_store()

    def _save_store(self) -> None:
        """Save authorization state and PIN to disk."""
        try:
            with open(STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._state, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving auth_store.json: {e}")

    @staticmethod
    def _normalize_names(names: List[str]) -> List[str]:
        """Normalize a list of visitor names for consistent comparison."""
        cleaned = [name.strip() for name in names if name and name.strip()]
        return cleaned

    @staticmethod
    def _canonical_name_key(names: List[str]) -> Tuple[str, ...]:
        """Produce a sorted tuple of lowercased names for matching."""
        return tuple(sorted([name.strip().lower() for name in names if name and name.strip()]))

    def get_current_pin(self) -> str:
        """Return the current active authorization PIN (internal use only)."""
        with _lock:
            return self._state["current_pin"]

    def verify_pin(self, pin: str) -> bool:
        """Verify if a PIN matches the current active authorization PIN."""
        with _lock:
            return str(pin).strip() == self._state["current_pin"]

    def change_pin(self, current_pin: str, new_pin: str, confirm_new_pin: str, admin_secret: Optional[str] = None) -> Tuple[bool, str]:
        """
        Update the active authorization PIN.
        Validates current PIN, ensures new PIN matches confirmation,
        and verifies admin secret if configured.
        """
        with _lock:
            # Check admin secret if configured
            if self._admin_secret and admin_secret:
                if admin_secret.strip() != self._admin_secret:
                    return False, "Invalid administrator secret key"

            if str(current_pin).strip() != self._state["current_pin"]:
                return False, "Current PIN is incorrect"

            if not new_pin or not new_pin.strip():
                return False, "New PIN cannot be empty"

            if new_pin.strip() != confirm_new_pin.strip():
                return False, "New PIN and confirmation PIN do not match"

            if new_pin.strip() == self._state["current_pin"]:
                return False, "New PIN must be different from current PIN"

            self._state["current_pin"] = new_pin.strip()
            self._save_store()
            logger.info("Authorization PIN changed successfully by administrator.")
            return True, "PIN updated successfully"

    def authorize_visitor_entry(self, visitor_names: List[str], pin: str) -> Tuple[bool, str, List[str]]:
        """
        Authorize visitor entry if PIN is valid.
        Creates an authorized entry record.
        """
        clean_names = self._normalize_names(visitor_names)
        if not clean_names:
            return False, "At least one visitor name is required", []

        if not self.verify_pin(pin):
            return False, "Invalid authorization PIN", clean_names

        with _lock:
            entry_record = {
                "id": len(self._state["authorizations"]) + 1,
                "visitor_names": clean_names,
                "pin": pin.strip(),
                "created_at": datetime.now().isoformat(),
                "authorization_status": "AUTHORIZED",
                "completed": False,
                "completed_at": None
            }
            self._state["authorizations"].append(entry_record)
            self._save_store()

        logger.info(f"Entry authorized for {clean_names}")
        return True, "Visitor entry authorized successfully", clean_names

    def verify_and_complete_entry(self, visitor_names: List[str], pin: str) -> Tuple[bool, str, str]:
        """
        Verify visitor names and PIN at the Main Gate.
        Returns: (success, entry_status, message)
        Possible entry_status values:
        - 'ENTRY AUTHORIZED'
        - 'ENTRY ALREADY COMPLETED'
        - 'ENTRY NOT AUTHORIZED'
        """
        clean_names = self._normalize_names(visitor_names)
        if not clean_names:
            return False, "ENTRY NOT AUTHORIZED", "Visitor names cannot be empty"

        # Check PIN matches current active PIN or PIN used when authorized
        target_key = self._canonical_name_key(clean_names)

        with _lock:
            # Look for matching authorization entries (check latest first)
            matching_records = [
                rec for rec in reversed(self._state["authorizations"])
                if self._canonical_name_key(rec["visitor_names"]) == target_key
            ]

            if not matching_records:
                return False, "ENTRY NOT AUTHORIZED", "No authorization record found for the specified visitor name(s)"

            # Check matching record's PIN or active PIN
            matched_rec = None
            for rec in matching_records:
                if rec["pin"] == pin.strip() or self._state["current_pin"] == pin.strip():
                    matched_rec = rec
                    break

            if not matched_rec:
                return False, "ENTRY NOT AUTHORIZED", "Invalid authorization PIN"

            if matched_rec["completed"]:
                return False, "ENTRY ALREADY COMPLETED", "This visitor entry has already been completed"

            # Mark as completed
            matched_rec["completed"] = True
            matched_rec["completed_at"] = datetime.now().isoformat()
            self._save_store()

            logger.info(f"Gate verification successful for {clean_names}. Marked completed.")
            return True, "ENTRY AUTHORIZED", "Entry authorized successfully"

    def get_authorizations_count(self) -> int:
        with _lock:
            return len(self._state.get("authorizations", []))


# Global singleton service
auth_service = AuthService()
