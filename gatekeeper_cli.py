"""
=====================================================================
 MAIN GATE VISITOR ENTRY AUTHORIZATION SYSTEM
=====================================================================
Flow:
  1. Enter Visitor Name(s)
  2. Authorize using PIN (admin can change PIN anytime)
  3. On successful authorization -> auto email to Main Gate Security
     + auto email/SMS to the visitor (if contact given)
  4. Main Gate re-enters PIN to verify -> ENTRY AUTHORIZED / NOT AUTHORIZED
  5. On authorized entry -> auto-save record to Excel (no manual entry)

Only two visitor inputs are used: Visitor Name(s) and the PIN.
(An OPTIONAL visitor contact field is offered only for the "notify
visitor" feature — leave it blank and it is simply skipped.)
=====================================================================
"""

import json
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from datetime import datetime

try:
    from openpyxl import Workbook, load_workbook
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False

# Optional SMS support (Twilio). If not installed / not configured,
# SMS step is skipped automatically — no crash.
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False


CONFIG_FILE = "config.json"
EXCEL_FILE = "visitor_entry_log.xlsx"


# ---------------------------------------------------------------------
# CONFIG HANDLING  (PIN + email/SMS credentials, admin-editable)
# ---------------------------------------------------------------------

DEFAULT_CONFIG = {
    "admin_pin": "1234",
    "security_email": "security@example.com",

    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "sender_email": "your_email@gmail.com",
    "sender_email_app_password": "your_app_password",

    "twilio_account_sid": "",
    "twilio_auth_token": "",
    "twilio_from_number": ""
}


def load_config():
    if not os.path.exists(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
            # Ensure keys exist
            for k, v in DEFAULT_CONFIG.items():
                if k not in data:
                    data[k] = v
            return data
    except Exception:
        return DEFAULT_CONFIG.copy()


def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)


def change_pin(config):
    """Admin-only PIN change."""
    print("\n--- CHANGE AUTHORIZATION PIN (ADMIN) ---")
    current = input("Enter CURRENT admin PIN: ").strip()
    if current != config["admin_pin"]:
        print(">> Incorrect current PIN. PIN not changed.\n")
        return config
    new_pin = input("Enter NEW PIN: ").strip()
    confirm_pin = input("Confirm NEW PIN: ").strip()
    if new_pin != confirm_pin or not new_pin:
        print(">> PIN mismatch or empty. PIN not changed.\n")
        return config
    config["admin_pin"] = new_pin
    save_config(config)
    print(">> PIN successfully updated.\n")
    return config


# ---------------------------------------------------------------------
# STEP 1 — ENTER VISITOR NAMES
# ---------------------------------------------------------------------

def get_visitor_names():
    print("\n--- STEP 1: ENTER VISITOR NAME(S) ---")
    raw = input("Enter visitor name(s), comma-separated if multiple: ").strip()
    names = [n.strip() for n in raw.split(",") if n.strip()]
    if not names:
        print(">> No names entered.")
        return []
    print(f">> Visitors captured: {', '.join(names)}")
    return names


# ---------------------------------------------------------------------
# STEP 2 — PIN AUTHORIZATION
# ---------------------------------------------------------------------

def authorize_with_pin(config):
    print("\n--- STEP 2: AUTHORIZATION ---")
    entered_pin = input("Enter Authorization PIN: ").strip()
    if entered_pin == config["admin_pin"]:
        print(">> Authorization SUCCESSFUL.")
        return True, entered_pin
    print(">> Authorization FAILED. Incorrect PIN.")
    return False, entered_pin


# ---------------------------------------------------------------------
# STEP 3 — AUTOMATED EMAIL TO SECURITY + NOTIFY VISITOR (EMAIL/SMS)
# ---------------------------------------------------------------------

def send_email(config, to_address, subject, body):
    sender = config.get("sender_email", "").strip()
    password = config.get("sender_email_app_password", "").strip()
    smtp_server = config.get("smtp_server", "smtp.gmail.com")
    smtp_port = int(config.get("smtp_port", 587))

    if not sender or not password or password == "your_app_password":
        print(f">> Email credentials unconfigured. Skipping SMTP dispatch to {to_address}.")
        return False

    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = to_address

        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls(context=context)
            server.login(sender, password)
            server.sendmail(sender, to_address, msg.as_string())
        print(f">> Real email sent to {to_address}")
        return True
    except Exception as e:
        print(f">> Email FAILED to {to_address}: {e}")
        return False


def send_sms(config, to_number, body):
    if not TWILIO_AVAILABLE:
        print(">> Twilio library not installed. SMS step skipped.")
        return False
    sid = config.get("twilio_account_sid", "").strip()
    token = config.get("twilio_auth_token", "").strip()
    from_num = config.get("twilio_from_number", "").strip()

    if not (sid and token and from_num):
        print(">> Twilio not configured. SMS step skipped.")
        return False
    try:
        client = TwilioClient(sid, token)
        client.messages.create(
            body=body,
            from_=from_num,
            to=to_number
        )
        print(f">> SMS sent to {to_number}")
        return True
    except Exception as e:
        print(f">> SMS FAILED to {to_number}: {e}")
        return False


def notify_security(config, names, auth_status, pin):
    subject = "Visitor Entry Authorization Request"
    body = (
        f"Visitor Name(s): {', '.join(names)}\n"
        f"Authorization Status: {auth_status}\n"
        f"Authorization PIN: {pin}\n"
        f"Requested At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    )
    send_email(config, config["security_email"], subject, body)


def notify_visitor(config, names, auth_status):
    print("\n--- STEP 3b: NOTIFY VISITOR (OPTIONAL) ---")
    contact = input(
        "Visitor email or phone number (leave blank to skip): "
    ).strip()
    if not contact:
        print(">> No visitor contact given. Skipping visitor notification.")
        return

    subject = "Your Gate Entry Authorization Status"
    body = (
        f"Dear {', '.join(names)},\n\n"
        f"Your entry request has been {auth_status}.\n"
        f"Please carry a valid ID and be ready to verify your PIN at the Main Gate.\n"
    )

    if "@" in contact:
        send_email(config, contact, subject, body)
    else:
        send_sms(config, contact, f"Gate Entry Status: {auth_status}. "
                                   f"Have your PIN ready at the Main Gate.")


# ---------------------------------------------------------------------
# STEP 4 — MAIN GATE VERIFICATION
# ---------------------------------------------------------------------

def gate_verification(config, expected_pin):
    print("\n--- STEP 4: MAIN GATE VERIFICATION ---")
    gate_pin = input("[Security] Re-enter PIN shown by visitor: ").strip()
    if gate_pin == expected_pin and gate_pin == config["admin_pin"]:
        print(">> ENTRY AUTHORIZED")
        return "ENTRY AUTHORIZED"
    print(">> ENTRY NOT AUTHORIZED")
    return "ENTRY NOT AUTHORIZED"


# ---------------------------------------------------------------------
# STEP 5 — AUTOMATIC EXCEL RECORD
# ---------------------------------------------------------------------

def init_excel_if_needed():
    if not OPENPYXL_AVAILABLE:
        print(">> openpyxl not installed. Skipping Excel save.")
        return False

    if not os.path.exists(EXCEL_FILE):
        wb = Workbook()
        ws = wb.active
        ws.title = "Visitor Log"
        ws.append([
            "Visitor Name(s)", "Entry Date", "Entry Time",
            "Authorization Status", "Entry Status"
        ])
        wb.save(EXCEL_FILE)
    return True


def save_to_excel(names, auth_status, entry_status):
    if not init_excel_if_needed():
        return

    wb = load_workbook(EXCEL_FILE)
    ws = wb["Visitor Log"]

    now = datetime.now()
    ws.append([
        ", ".join(names),
        now.strftime("%Y-%m-%d"),
        now.strftime("%H:%M:%S"),
        auth_status,
        entry_status
    ])
    wb.save(EXCEL_FILE)
    print(f">> Record saved to {EXCEL_FILE}")


# ---------------------------------------------------------------------
# MAIN DRIVER — FULL FLOW
# ---------------------------------------------------------------------

def run_flow(config):
    names = get_visitor_names()
    if not names:
        return

    authorized, entered_pin = authorize_with_pin(config)
    auth_status = "AUTHORIZED" if authorized else "NOT AUTHORIZED"

    # Step 3: notify security regardless, so they always have a record
    notify_security(config, names, auth_status, entered_pin)
    notify_visitor(config, names, auth_status)

    if not authorized:
        # No valid PIN -> stop before gate step, but still log the attempt
        save_to_excel(names, auth_status, "ENTRY NOT AUTHORIZED")
        return

    # Step 4: gate verification
    entry_status = gate_verification(config, entered_pin)

    # Step 5: log only successful/attempted authorized entries
    save_to_excel(names, auth_status, entry_status)


def main_menu():
    config = load_config()
    while True:
        print("\n===================================")
        print(" MAIN GATE VISITOR ENTRY SYSTEM")
        print("===================================")
        print("1. New Visitor Entry")
        print("2. Change Authorization PIN (Admin)")
        print("3. Exit")
        choice = input("Select an option: ").strip()

        if choice == "1":
            run_flow(config)
        elif choice == "2":
            config = change_pin(config)
        elif choice == "3":
            print("Exiting system. Goodbye.")
            break
        else:
            print(">> Invalid option.")


if __name__ == "__main__":
    main_menu()
