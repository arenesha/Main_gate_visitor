import os
import logging
import requests
from typing import List, Union

logger = logging.getLogger("sms_service")


def get_sms_config():
    return {
        "sms_enabled": os.getenv("SMS_ENABLED", "false").lower() in ("true", "1", "yes"),
        "sms_provider_url": os.getenv("SMS_PROVIDER_URL", ""),
        "sms_provider_key": os.getenv("SMS_PROVIDER_KEY", ""),
    }


def send_visitor_sms(visitor_names: Union[List[str], str], authorization_status: str) -> bool:
    """
    Send an SMS notification to the preconfigured destination via an SMS gateway/provider.
    If SMS is disabled or fails, authorization flow is NOT interrupted.
    """
    config = get_sms_config()

    if not config["sms_enabled"]:
        logger.debug("SMS service is disabled in configuration. Skipping SMS notification.")
        return False

    provider_url = config["sms_provider_url"]
    provider_key = config["sms_provider_key"]

    if isinstance(visitor_names, list):
        names_str = ", ".join(visitor_names)
    else:
        names_str = str(visitor_names)

    message_text = (
        f"Main Gate Notice: Entry authorized for {names_str}. "
        f"Status: {authorization_status}. Present PIN at security gate."
    )

    if not provider_url:
        logger.info(f"[SIMULATED SMS DISPATCH] SMS would send: '{message_text}'")
        return True

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {provider_key}" if provider_key else ""
        }
        payload = {
            "message": message_text,
            "status": authorization_status
        }
        resp = requests.post(provider_url, json=payload, headers=headers, timeout=5)
        if resp.status_code in (200, 201, 202):
            logger.info("SMS successfully dispatched to provider.")
            return True
        else:
            logger.warning(f"SMS provider responded with status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        logger.warning(f"SMS notification could not be sent: {e}")
        return False
