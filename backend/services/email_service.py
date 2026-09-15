import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Union

logger = logging.getLogger("email_service")


def get_email_config():
    return {
        "smtp_host": os.getenv("SMTP_HOST", "smtp.example.com"),
        "smtp_port": int(os.getenv("SMTP_PORT", "587")),
        "smtp_user": os.getenv("SMTP_USERNAME", ""),
        "smtp_password": os.getenv("SMTP_PASSWORD", ""),
        "from_email": os.getenv("SMTP_FROM_EMAIL", "security-system@example.com"),
        "main_gate_email": os.getenv("MAIN_GATE_EMAIL", "security@example.com"),
        "visitor_email": os.getenv("VISITOR_NOTIFICATION_EMAIL", "visitor@example.com"),
        "visitor_email_enabled": os.getenv("VISITOR_NOTIFICATION_ENABLED", "true").lower() in ("true", "1", "yes"),
    }


def format_names_list(visitor_names: Union[List[str], str]) -> str:
    if isinstance(visitor_names, list):
        return "\n".join(visitor_names)
    return str(visitor_names)


def _send_smtp(to_email: str, subject: str, body_text: str) -> bool:
    """Internal helper to dispatch email via SMTP with fallback logging."""
    config = get_email_config()
    smtp_host = config["smtp_host"]
    smtp_port = config["smtp_port"]
    smtp_user = config["smtp_user"]
    smtp_pass = config["smtp_password"]
    from_email = config["from_email"]

    # If SMTP host is dummy/unconfigured, simulate dispatch gracefully
    if not smtp_host or smtp_host in ("smtp.example.com", "localhost", ""):
        logger.info(
            f"[SIMULATED EMAIL DISPATCH]\n"
            f"To: {to_email}\n"
            f"From: {from_email}\n"
            f"Subject: {subject}\n"
            f"Body:\n{body_text}\n"
            f"----------------------------------------"
        )
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = from_email
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body_text, "plain"))

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            server.starttls()

        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)

        server.send_message(msg)
        server.quit()
        logger.info(f"Email successfully dispatched to {to_email}")
        return True
    except Exception as e:
        logger.warning(
            f"SMTP dispatch to {to_email} failed: {e}. Logged notification locally:\n"
            f"Subject: {subject}\n{body_text}"
        )
        return False


def send_security_email(visitor_names: Union[List[str], str], authorization_status: str, pin: str) -> bool:
    """
    Send an email notification to Main Gate Security.
    Email must contain:
    - Visitor Name(s)
    - Authorization Status
    - Authorization PIN
    """
    config = get_email_config()
    recipient = config["main_gate_email"]
    subject = "Visitor Entry Authorization"

    names_formatted = format_names_list(visitor_names)
    body = (
        f"Visitor Entry Authorization\n\n"
        f"Visitor Name(s):\n"
        f"{names_formatted}\n\n"
        f"Authorization Status:\n"
        f"{authorization_status}\n\n"
        f"Authorization PIN:\n"
        f"{pin}\n"
    )

    return _send_smtp(to_email=recipient, subject=subject, body_text=body)


def send_visitor_email(visitor_names: Union[List[str], str], authorization_status: str) -> bool:
    """
    Send an authorization confirmation email to the preconfigured visitor email address.
    Does NOT require the visitor's email on the main visitor-entry screen.
    """
    config = get_email_config()
    if not config["visitor_email_enabled"]:
        logger.info("Visitor email notification is disabled by configuration.")
        return False

    recipient = config["visitor_email"]
    subject = "Your Main Gate Entry Has Been Authorized"
    names_formatted = format_names_list(visitor_names)

    body = (
        f"Visitor Entry Notice\n\n"
        f"Your entry through the Main Gate has been authorized.\n\n"
        f"Visitor Name(s):\n"
        f"{names_formatted}\n\n"
        f"Status:\n"
        f"{authorization_status}\n\n"
        f"Please provide your name and authorization PIN at the Main Gate security counter for verification.\n"
    )

    return _send_smtp(to_email=recipient, subject=subject, body_text=body)
