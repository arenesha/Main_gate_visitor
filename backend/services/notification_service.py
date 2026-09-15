import os
import smtplib
import socket
import re
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Union, Optional, Tuple, Dict, Any

from dotenv import load_dotenv

logger = logging.getLogger("notification_service")

def _refresh_env():
    env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    if os.path.exists(env_file):
        load_dotenv(env_file, override=True)

def is_email(contact: str) -> bool:
    if not contact:
        return False
    c = contact.strip()
    return "@" in c and "." in c.split("@")[-1]

def normalize_phone_number(phone: str) -> str:
    """Normalize phone numbers to E.164 format."""
    p = re.sub(r"[^\d+]", "", phone.strip())
    if not p.startswith("+"):
        if len(p) == 10:
            p = "+91" + p
        else:
            p = "+" + p
    return p

def _get_security_email() -> str:
    _refresh_env()
    return os.getenv("SECURITY_EMAIL", os.getenv("MAIN_GATE_EMAIL", "")).strip()

def _is_smtp_configured() -> bool:
    _refresh_env()
    host = os.getenv("SMTP_HOST", "").strip()
    return bool(host and host not in ("smtp.example.com", "localhost", "none", ""))

def _is_twilio_configured() -> bool:
    _refresh_env()
    sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    tok = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    from_num = os.getenv("TWILIO_FROM_NUMBER", "").strip()
    return bool(sid and tok and from_num and not sid.startswith("ACXX") and not "your_" in sid)

def send_security_notification(visitor_names: List[str], pin: str) -> Dict[str, Any]:
    """
    Notifies Main Gate Security by Email OR SMS (or both if configured).
    Contains:
      - Names of all visitors in this authorization
      - Authorization status (AUTHORIZED)
      - Authorization PIN
    """
    names_str = ", ".join(visitor_names) if isinstance(visitor_names, list) else str(visitor_names)
    sec_email = _get_security_email()
    sec_phone = os.getenv("SECURITY_PHONE", os.getenv("MAIN_GATE_PHONE", "")).strip()

    subject = "Visitor Entry Authorization — Gatekeeper"
    body = (
        f"GATEKEEPER VISITOR AUTHORIZATION NOTICE\n\n"
        f"Visitor Name(s): {names_str}\n"
        f"Authorization Status: AUTHORIZED\n"
        f"Authorization PIN: {pin}\n\n"
        f"Please verify the visitor name and PIN at the main gate counter upon arrival.\n"
    )

    results = {}

    # 1. Email delivery to Main Gate Security
    if _is_smtp_configured():
        smtp_host = os.getenv("SMTP_HOST", "").strip()
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USERNAME", "").strip()
        smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
        from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user).strip()

        to_email = sec_email or smtp_user
        try:
            msg = MIMEMultipart()
            msg["From"] = from_email
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=12)
                server.starttls()

            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)

            server.send_message(msg)
            server.quit()
            logger.info(f"Security email sent successfully to {to_email}")
            results["email"] = {"success": True, "message": f"Security email sent to {to_email}."}
        except smtplib.SMTPAuthenticationError as e:
            err = f"SMTP Authentication failed (Code {e.smtp_code}): {e.smtp_error.decode('utf-8', errors='ignore') if isinstance(e.smtp_error, bytes) else str(e)}"
            logger.error(f"Security email error: {err}")
            results["email"] = {"success": False, "message": err}
        except socket.gaierror as e:
            err = f"SMTP connection failed: Host '{smtp_host}' not found ({e})"
            logger.error(f"Security email error: {err}")
            results["email"] = {"success": False, "message": err}
        except Exception as e:
            err = f"Security email error: {str(e)}"
            logger.error(f"Security email error: {err}", exc_info=True)
            results["email"] = {"success": False, "message": err}
    else:
        log_dest = sec_email or "security@example.com"
        logger.info(f"[SIMULATED SECURITY EMAIL DISPATCH]\nTo: {log_dest}\nSubject: {subject}\n{body}")
        results["email"] = {"success": True, "message": f"Simulated security email logged locally to {log_dest} (SMTP unconfigured)."}

    # 2. SMS delivery to Security if phone configured
    if sec_phone:
        norm_sec_phone = normalize_phone_number(sec_phone)
        sec_sms_text = f"Gatekeeper Alert: New entry AUTHORIZED for {names_str}. PIN: {pin}."
        if _is_twilio_configured():
            sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
            tok = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
            from_num = os.getenv("TWILIO_FROM_NUMBER", "").strip()
            try:
                from twilio.rest import Client
                client = Client(sid, tok)
                m = client.messages.create(body=sec_sms_text, from_=from_num, to=norm_sec_phone)
                results["sms"] = {"success": True, "message": f"Security SMS sent to {norm_sec_phone} (SID: {m.sid})."}
            except Exception as e:
                err = f"Security SMS error: {getattr(e, 'msg', str(e))}"
                logger.error(err)
                results["sms"] = {"success": False, "message": err}
        else:
            logger.info(f"[SIMULATED SECURITY SMS DISPATCH]\nTo: {norm_sec_phone}\nText: {sec_sms_text}")
            results["sms"] = {"success": True, "message": f"Simulated security SMS logged locally to {norm_sec_phone}."}

    return results

def send_individual_visitor_notification(visitor_name: str, contact: str, pin: str) -> Tuple[bool, str]:
    """
    Notifies a SINGLE visitor at their OWN contact only.
    Contains:
      - That visitor's OWN name only (not group names)
      - Authorization PIN
      - Instructions for gate arrival
    """
    if not contact or not contact.strip():
        return False, "No contact provided."

    c = contact.strip()
    v_name = visitor_name.strip() if visitor_name else "Visitor"

    if is_email(c):
        # Visitor Email notification
        subject = "Your Gatekeeper Entry Authorization"
        body = (
            f"Hello {v_name},\n\n"
            f"Your visitor entry through the Main Gate has been AUTHORIZED.\n\n"
            f"Authorization PIN: {pin}\n\n"
            f"Please present this PIN to security at the gate counter upon arrival.\n"
        )

        if _is_smtp_configured():
            smtp_host = os.getenv("SMTP_HOST", "").strip()
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USERNAME", "").strip()
            smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
            from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user).strip()

            try:
                msg = MIMEMultipart()
                msg["From"] = from_email
                msg["To"] = c
                msg["Subject"] = subject
                msg.attach(MIMEText(body, "plain"))

                if smtp_port == 465:
                    server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12)
                else:
                    server = smtplib.SMTP(smtp_host, smtp_port, timeout=12)
                    server.starttls()

                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)

                server.send_message(msg)
                server.quit()
                logger.info(f"Visitor email sent successfully to {c}")
                return True, f"Visitor email sent successfully to {c}."
            except smtplib.SMTPAuthenticationError as e:
                err = f"SMTP Auth Error: {e.smtp_error.decode('utf-8', errors='ignore') if isinstance(e.smtp_error, bytes) else str(e)}"
                logger.error(f"Visitor email failed: {err}")
                return False, err
            except socket.gaierror as e:
                err = f"SMTP Host Error: Host '{smtp_host}' unreachable ({e})"
                logger.error(err)
                return False, err
            except Exception as e:
                err = f"Visitor email error: {str(e)}"
                logger.error(err)
                return False, err
        else:
            logger.info(f"[SIMULATED VISITOR EMAIL DISPATCH]\nTo: {c}\nSubject: {subject}\n{body}")
            return True, f"Simulated visitor email logged locally to {c} (SMTP unconfigured)."

    else:
        # Visitor SMS notification
        phone_digits = re.sub(r"[^\d]", "", c)
        phone_10 = phone_digits[-10:] if len(phone_digits) >= 10 else phone_digits
        phone_e164 = normalize_phone_number(c)
        sms_text = f"Gatekeeper: Hello {v_name}, your entry is AUTHORIZED. PIN: {pin}. Present this PIN at the main gate."

        fast2sms_key = os.getenv("FAST2SMS_API_KEY", "").strip()
        if fast2sms_key and not fast2sms_key.startswith("your_"):
            try:
                import requests
                url = "https://www.fast2sms.com/dev/bulkV2"
                headers = {"authorization": fast2sms_key}
                payload = {
                    "route": "q",
                    "message": sms_text,
                    "language": "english",
                    "flash": 0,
                    "numbers": phone_10
                }
                resp = requests.post(url, headers=headers, data=payload, timeout=12)
                res_data = resp.json()
                if res_data.get("return") is True:
                    logger.info(f"Fast2SMS sent to {phone_10}")
                    return True, f"SMS delivered successfully to {phone_10} via Fast2SMS."
                else:
                    err = f"Fast2SMS Error: {res_data.get('message')}"
                    logger.error(err)
                    return False, err
            except Exception as e:
                err = f"Fast2SMS dispatch error: {str(e)}"
                logger.error(err)
                return False, err

        elif _is_twilio_configured():
            sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
            tok = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
            from_num = os.getenv("TWILIO_FROM_NUMBER", "").strip()
            try:
                from twilio.rest import Client
                client = Client(sid, tok)
                m = client.messages.create(body=sms_text, from_=from_num, to=phone_e164)
                logger.info(f"Twilio SMS dispatched to {phone_e164}, SID: {m.sid}")
                return True, f"Twilio SMS sent to {phone_e164} (SID: {m.sid})."
            except Exception as e:
                err = f"Twilio SMS error: {getattr(e, 'msg', str(e))}"
                logger.error(f"Twilio SMS failed to {phone_e164}: {err}")
                return False, err
        else:
            logger.info(f"[SIMULATED VISITOR SMS DISPATCH]\nTo: {phone_e164}\nText: {sms_text}")
            return True, f"Simulated visitor SMS logged locally to {phone_e164} (Twilio unconfigured)."

def debug_notifications_status() -> Dict[str, Any]:
    """
    Reports which env vars are set (true/false only) and performs one real test
    send per configured channel, returning the literal result.
    """
    env_keys = [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USERNAME",
        "SMTP_PASSWORD",
        "SMTP_FROM_EMAIL",
        "SECURITY_EMAIL",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_FROM_NUMBER"
    ]

    # Normalize check for SECURITY_EMAIL (support MAIN_GATE_EMAIL too)
    env_vars_set = {}
    for k in env_keys:
        val = os.getenv(k, "").strip()
        if k == "SECURITY_EMAIL" and not val:
            val = os.getenv("MAIN_GATE_EMAIL", "").strip()
        # Mark false if it's default example or blank
        is_set = bool(val and not val.endswith("example.com") and not val.startswith("your-") and not val.startswith("ACXX"))
        env_vars_set[k] = is_set

    # Real Test Send - Email Channel
    email_configured = _is_smtp_configured()
    if email_configured:
        sec_email = _get_security_email()
        smtp_host = os.getenv("SMTP_HOST", "").strip()
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USERNAME", "").strip()
        smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
        from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user).strip()
        to_email = sec_email or smtp_user

        try:
            msg = MIMEMultipart()
            msg["From"] = from_email
            msg["To"] = to_email
            msg["Subject"] = "Gatekeeper SMTP Diagnostic Test"
            msg.attach(MIMEText("This is a live diagnostic test email from Gatekeeper.", "plain"))

            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                server.starttls()

            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)

            server.send_message(msg)
            server.quit()
            email_result = {"success": True, "message": f"Real test email successfully delivered to {to_email} via {smtp_host}:{smtp_port}."}
        except smtplib.SMTPAuthenticationError as e:
            email_result = {"success": False, "message": f"SMTP Authentication Error: {e.smtp_error.decode('utf-8', errors='ignore') if isinstance(e.smtp_error, bytes) else str(e)}"}
        except socket.gaierror as e:
            email_result = {"success": False, "message": f"SMTP DNS Error: Host '{smtp_host}' could not be resolved ({e})."}
        except Exception as e:
            email_result = {"success": False, "message": f"SMTP Connection/Send Error: {str(e)}"}
    else:
        email_result = {"success": False, "message": "Email not tested: SMTP_HOST is not configured with live credentials."}

    # Real Test Send - SMS Channel
    sms_configured = _is_twilio_configured()
    if sms_configured:
        sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        tok = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        from_num = os.getenv("TWILIO_FROM_NUMBER", "").strip()
        test_to = os.getenv("SECURITY_PHONE", from_num).strip()
        test_to_norm = normalize_phone_number(test_to)

        try:
            from twilio.rest import Client
            client = Client(sid, tok)
            m = client.messages.create(
                body="Gatekeeper Diagnostic Test: SMS channel active.",
                from_=from_num,
                to=test_to_norm
            )
            sms_result = {"success": True, "message": f"Real test SMS sent to {test_to_norm} (SID: {m.sid})."}
        except Exception as e:
            err_detail = getattr(e, "msg", str(e))
            sms_result = {"success": False, "message": f"Twilio SMS Error: {err_detail}"}
    else:
        sms_result = {"success": False, "message": "SMS not tested: TWILIO credentials are not configured in .env."}

    return {
        "env_vars_set": env_vars_set,
        "email_test": {
            "channel": "email",
            "configured": email_configured,
            "success": email_result["success"],
            "literal_result": email_result["message"]
        },
        "sms_test": {
            "channel": "sms",
            "configured": sms_configured,
            "success": sms_result["success"],
            "literal_result": sms_result["message"]
        }
    }

# Backward compatibility alias
def send_security_email(visitor_names: Union[List[str], str], pin: str) -> Tuple[bool, str]:
    names_list = visitor_names if isinstance(visitor_names, list) else [str(visitor_names)]
    res = send_security_notification(names_list, pin)
    email_res = res.get("email", {"success": True, "message": "Done"})
    return email_res["success"], email_res["message"]

def send_visitor_notification(visitor_names: Union[List[str], str], contact: Optional[str], pin: str) -> Tuple[bool, str]:
    if not contact:
        return False, "No contact provided"
    first_name = visitor_names[0] if isinstance(visitor_names, list) and visitor_names else str(visitor_names)
    return send_individual_visitor_notification(first_name, contact, pin)
