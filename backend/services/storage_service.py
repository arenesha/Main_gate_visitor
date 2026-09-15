import os
import json
import logging
from typing import List, Dict, Any, Tuple, Optional, Union
from datetime import datetime
import threading

logger = logging.getLogger("gatekeeper_auth")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
STORE_FILE = os.path.join(STORAGE_DIR, "store.json")
_lock = threading.Lock()

class StorageService:
    def __init__(self):
        os.makedirs(STORAGE_DIR, exist_ok=True)
        self._initial_pin = os.getenv("AUTHORIZATION_PIN", "").strip()
        self._state: Dict[str, Any] = {
            "current_pin": self._initial_pin,
            "authorizations": []
        }
        self._load_store()

    def _load_store(self) -> None:
        if os.path.exists(STORE_FILE):
            try:
                with open(STORE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._state["current_pin"] = data.get("current_pin", self._initial_pin)
                    self._state["authorizations"] = data.get("authorizations", [])
            except Exception as e:
                logger.error(f"Error loading store.json: {e}")
                self._save_store()
        else:
            self._save_store()

    def _save_store(self) -> None:
        try:
            with open(STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._state, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving store.json: {e}")

    @staticmethod
    def _normalize_names(names: List[str]) -> List[str]:
        return [n.strip() for n in names if n and n.strip()]

    @staticmethod
    def _canonical_key(names: List[str]) -> Tuple[str, ...]:
        return tuple(sorted([n.strip().lower() for n in names if n and n.strip()]))

    def get_current_pin(self) -> str:
        with _lock:
            return self._state["current_pin"]

    def verify_pin(self, pin: str) -> bool:
        with _lock:
            return str(pin).strip() == self._state["current_pin"]

    def _is_valid_pin_format(self, pin: str) -> Tuple[bool, str]:
        p = str(pin).strip()
        if not p.isdigit():
            return False, "Authorization PIN must contain numbers only."
        if len(p) < 4 or len(p) > 6:
            return False, "Authorization PIN must be between 4 and 6 digits."
        return True, ""

    def change_pin(self, current_pin: str, new_pin: str, confirm_new_pin: str) -> Tuple[bool, str]:
        with _lock:
            if str(current_pin).strip() != self._state["current_pin"]:
                return False, "Current PIN is incorrect."

            valid, err_msg = self._is_valid_pin_format(new_pin)
            if not valid:
                return False, err_msg

            if new_pin.strip() != confirm_new_pin.strip():
                return False, "New PIN and confirmation do not match."
            if new_pin.strip() == self._state["current_pin"]:
                return False, "New PIN must be different from current PIN."

            self._state["current_pin"] = new_pin.strip()
            self._save_store()
            return True, "PIN updated successfully."

    def create_authorization(self, visitors: Union[List[Dict[str, str]], List[str]], pin: str, contact: Optional[str] = None) -> Tuple[bool, str, List[Dict[str, str]]]:
        clean_visitors = []
        if visitors and isinstance(visitors[0], dict):
            for v in visitors:
                name = str(v.get("name", "")).strip()
                c = str(v.get("contact", "")).strip()
                if name:
                    clean_visitors.append({"name": name, "contact": c})
        else:
            names = [str(n).strip() for n in visitors if str(n).strip()]
            for n in names:
                clean_visitors.append({"name": n, "contact": contact.strip() if contact else ""})

        if not clean_visitors:
            return False, "At least one visitor name is required.", []

        valid_pin, pin_err = self._is_valid_pin_format(pin)
        if not valid_pin:
            return False, pin_err, clean_visitors

        if not self.verify_pin(pin):
            return False, "Invalid authorization PIN.", clean_visitors

        with _lock:
            auth_entry = {
                "id": len(self._state["authorizations"]) + 1,
                "visitors": clean_visitors,
                "visitor_names": [v["name"] for v in clean_visitors],
                "pin": pin.strip(),
                "created_at": datetime.now().isoformat(),
                "authorization_status": "AUTHORIZED",
                "completed": False,
                "completed_at": None
            }
            self._state["authorizations"].append(auth_entry)
            self._save_store()

        return True, "Authorization created successfully.", clean_visitors

    def verify_gate_entry(self, visitor_names: List[str], pin: str) -> Tuple[bool, str, str, List[str]]:
        """
        Verifies visitor entry at the gate.
        Returns: (is_authorized, entry_verdict, message, cleaned_names)
        """
        clean_names = self._normalize_names(visitor_names)
        if not clean_names:
            return False, "ENTRY NOT AUTHORIZED", "Visitor name cannot be empty.", []

        target_key = self._canonical_key(clean_names)

        with _lock:
            # Check matching records (newest first)
            matching = [
                rec for rec in reversed(self._state["authorizations"])
                if self._canonical_key(rec["visitor_names"]) == target_key
            ]

            if not matching:
                # Also support single name match inside group authorization if individual arrives
                if len(clean_names) == 1:
                    single_name = clean_names[0].lower()
                    matching = [
                        rec for rec in reversed(self._state["authorizations"])
                        if any(single_name == v.lower() for v in rec["visitor_names"])
                    ]

            if not matching:
                return False, "ENTRY NOT AUTHORIZED", "No authorization record found for the provided name(s).", clean_names

            # Find record matching supplied PIN or current PIN
            matched_rec = None
            for rec in matching:
                if rec["pin"] == pin.strip() or self._state["current_pin"] == pin.strip():
                    matched_rec = rec
                    break

            if not matched_rec:
                return False, "ENTRY NOT AUTHORIZED", "Invalid authorization PIN for visitor entry.", clean_names

            if matched_rec["completed"]:
                return False, "ENTRY NOT AUTHORIZED", "This visitor authorization has already been completed.", clean_names

            # Mark as completed
            matched_rec["completed"] = True
            matched_rec["completed_at"] = datetime.now().isoformat()
            self._save_store()

            return True, "ENTRY AUTHORIZED", "Visitor entry authorized successfully.", matched_rec["visitor_names"]

    def get_pending_count(self) -> int:
        with _lock:
            return sum(1 for rec in self._state.get("authorizations", []) if not rec.get("completed"))

storage_service = StorageService()
