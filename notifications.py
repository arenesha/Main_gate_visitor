"""
notifications.py — Real-Time Email (SendGrid) + SMS (Twilio) for Gate Authorization
"""

import os
import re
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("gate.notifications")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

def is_valid_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, (email or "").strip()))

def is_valid_e164(phone: str) -> bool:
    return bool(re.match(r'^\+[1-9]\d{6,14}$', (phone or "").strip()))

# ---------------------------------------------------------------------------
# Email via SendGrid
# ---------------------------------------------------------------------------

def send_email_notification(visitor_names: list, auth_id: str, auth_pin: str, auth_time: str) -> dict:
    """Send real email via SendGrid. Returns {"status": "sent"/"failed", "error": None/<exact reason>}"""

    api_key    = os.getenv("SENDGRID_API_KEY", "").strip()
    sender     = os.getenv("SENDER_EMAIL", "").strip()
    recipient  = os.getenv("GATE_SECURITY_EMAIL", "").strip()

    # Validate config
    if not api_key or api_key.startswith("SG.your"):
        msg = "SENDGRID_API_KEY not configured in .env"
        logger.error(f"[EMAIL] SKIP — {msg}")
        return {"status": "failed", "error": msg}

    if not is_valid_email(sender):
        msg = f"SENDER_EMAIL '{sender}' is not a valid email address"
        logger.error(f"[EMAIL] SKIP — {msg}")
        return {"status": "failed", "error": msg}

    if not is_valid_email(recipient):
        msg = f"GATE_SECURITY_EMAIL '{recipient}' is not a valid email address"
        logger.error(f"[EMAIL] SKIP — {msg}")
        return {"status": "failed", "error": msg}

    names_str = ", ".join(visitor_names)
    subject   = f"[GATEKEEPER] Visitor Authorization — {auth_id}"
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
      <div style="background:#1a1a2e;padding:24px;text-align:center">
        <h1 style="color:#00d4aa;margin:0;font-size:22px">🔐 GATEKEEPER</h1>
        <p style="color:#aaa;margin:4px 0 0">Main Gate Visitor Authorization</p>
      </div>
      <div style="padding:28px;background:#fff">
        <h2 style="color:#333;margin-top:0">Entry Authorization Issued</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;width:40%"><strong>Authorization ID</strong></td>
              <td style="padding:10px;border-bottom:1px solid #eee;font-family:monospace;color:#1a1a2e"><strong>{auth_id}</strong></td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666"><strong>Visitor(s)</strong></td>
              <td style="padding:10px;border-bottom:1px solid #eee">{names_str}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666"><strong>Authorization PIN</strong></td>
              <td style="padding:10px;border-bottom:1px solid #eee;font-family:monospace;font-size:20px;color:#e74c3c"><strong>{auth_pin}</strong></td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666"><strong>Status</strong></td>
              <td style="padding:10px;border-bottom:1px solid #eee;color:#27ae60"><strong>PENDING VERIFICATION</strong></td></tr>
          <tr><td style="padding:10px;color:#666"><strong>Authorized At</strong></td>
              <td style="padding:10px">{auth_time}</td></tr>
        </table>
        <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:16px;margin-top:20px">
          <strong>⚠️ Gate Security Action Required</strong><br>
          Visitor will present Authorization ID <strong>{auth_id}</strong> at the Main Gate.<br>
          Ask for PIN <strong>{auth_pin}</strong> to verify entry.
        </div>
      </div>
      <div style="background:#f5f5f5;padding:12px;text-align:center;color:#999;font-size:12px">
        Gatekeeper — Main Gate Visitor Authorization System
      </div>
    </div>
    """

    text_body = (
        f"GATEKEEPER ALERT\n"
        f"Authorization ID: {auth_id}\n"
        f"Visitor(s): {names_str}\n"
        f"PIN: {auth_pin}\n"
        f"Status: PENDING VERIFICATION\n"
        f"Time: {auth_time}\n"
        f"Action: Verify visitor at Main Gate using PIN above."
    )

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=sender,
            to_emails=recipient,
            subject=subject,
            html_content=html_body,
            plain_text_content=text_body
        )
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)

        if response.status_code in (200, 202):
            logger.info(f"[EMAIL] ✅ Sent to {recipient} | Auth ID: {auth_id} | HTTP {response.status_code}")
            return {"status": "sent", "error": None}
        else:
            msg = f"SendGrid returned HTTP {response.status_code}: {response.body}"
            logger.error(f"[EMAIL] ❌ {msg}")
            return {"status": "failed", "error": msg}

    except Exception as exc:
        raw = str(exc)
        # Extract meaningful error from SendGrid exception body
        if hasattr(exc, 'body'):
            try:
                import json
                body = json.loads(exc.body)
                errors = body.get("errors", [])
                if errors:
                    raw = f"{errors[0].get('message', raw)} (field: {errors[0].get('field', 'n/a')})"
            except Exception:
                raw = str(exc.body)
        logger.error(f"[EMAIL] ❌ Exception: {raw}")
        return {"status": "failed", "error": raw}


# ---------------------------------------------------------------------------
# SMS via Twilio
# ---------------------------------------------------------------------------

def send_sms_notification(visitor_names: list, auth_id: str, auth_pin: str, auth_time: str) -> dict:
    """Send real SMS via Twilio. Returns {"status": "sent"/"failed", "error": None/<exact reason>}"""

    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    from_number = os.getenv("TWILIO_FROM_NUMBER", "").strip()
    to_number   = os.getenv("GATE_SECURITY_PHONE", "").strip()

    # Validate config
    if not account_sid or account_sid.startswith("your") or account_sid.startswith("AC_your"):
        msg = "TWILIO_ACCOUNT_SID not configured in .env"
        logger.error(f"[SMS] SKIP — {msg}")
        return {"status": "failed", "error": msg}

    if not auth_token or auth_token.startswith("your"):
        msg = "TWILIO_AUTH_TOKEN not configured in .env"
        logger.error(f"[SMS] SKIP — {msg}")
        return {"status": "failed", "error": msg}

    if not is_valid_e164(from_number):
        msg = f"TWILIO_FROM_NUMBER '{from_number}' must be in E.164 format (e.g. +12015551234)"
        logger.error(f"[SMS] SKIP — {msg}")
        return {"status": "failed", "error": msg}

    if not is_valid_e164(to_number):
        msg = f"GATE_SECURITY_PHONE '{to_number}' must be in E.164 format (e.g. +919876543210)"
        logger.error(f"[SMS] SKIP — {msg}")
        return {"status": "failed", "error": msg}

    names_str = ", ".join(visitor_names)
    sms_body = (
        f"[GATEKEEPER] VISITOR ALERT\n"
        f"ID: {auth_id}\n"
        f"Visitor: {names_str}\n"
        f"PIN: {auth_pin}\n"
        f"Time: {auth_time}\n"
        f"Action: Verify at Main Gate."
    )

    try:
        from twilio.rest import Client
        from twilio.base.exceptions import TwilioRestException

        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=sms_body,
            from_=from_number,
            to=to_number
        )
        logger.info(f"[SMS] ✅ Sent to {to_number} | SID: {message.sid} | Auth ID: {auth_id}")
        return {"status": "sent", "error": None}

    except Exception as exc:
        raw = str(exc)
        # Extract Twilio error code and message
        if hasattr(exc, 'code') and hasattr(exc, 'msg'):
            raw = f"Twilio {exc.code} — {exc.msg}"
        elif hasattr(exc, 'code'):
            raw = f"Twilio error {exc.code}: {str(exc)}"
        logger.error(f"[SMS] ❌ Exception: {raw}")
        return {"status": "failed", "error": raw}


# ---------------------------------------------------------------------------
# Combined Dispatcher
# ---------------------------------------------------------------------------

def send_authorization_notifications(visitor_names: list, auth_id: str, auth_pin: str, auth_time: str) -> dict:
    """
    Send both email + SMS simultaneously (independent — one failure does not block the other).
    Returns: {"email": {...}, "sms": {...}}
    """
    logger.info(f"[NOTIFY] Dispatching notifications | Auth ID: {auth_id} | Visitors: {visitor_names}")

    email_result = send_email_notification(visitor_names, auth_id, auth_pin, auth_time)
    sms_result   = send_sms_notification(visitor_names, auth_id, auth_pin, auth_time)

    logger.info(f"[NOTIFY] Results | Email: {email_result['status']} | SMS: {sms_result['status']}")
    return {"email": email_result, "sms": sms_result}
