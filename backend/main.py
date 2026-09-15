import os
import logging
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

# Load environment variables before importing services
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from models.schemas import (
    AuthorizeEntryRequest,
    AuthorizeEntryResponse,
    VerifyEntryRequest,
    VerifyEntryResponse,
    ChangePinRequest,
    ChangePinResponse,
    HealthResponse
)
from services.auth_service import auth_service
from services.email_service import send_security_email, send_visitor_email
from services.sms_service import send_visitor_sms
from services.excel_service import save_entry_to_excel

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main_gate_api")

app = FastAPI(
    title="Main Gate Visitor Entry Authorization System",
    version="1.0.0",
    description="Backend API for Visitor Entry Authorization, Gate Verification, and Excel Logging."
)

# Enable CORS for local development and frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Clean user-friendly error formatting for validation errors."""
    error_messages = []
    for err in exc.errors():
        field = " -> ".join([str(loc) for loc in err["loc"] if loc != "body"])
        error_messages.append(f"{field}: {err['msg']}" if field else err["msg"])
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Validation error: " + "; ".join(error_messages)
        }
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all to prevent exposing stack traces to the client."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "An internal server error occurred. Please contact the administrator."
        }
    )


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint to verify backend status."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        active_authorizations_count=auth_service.get_authorizations_count()
    )


@app.post("/api/authorize-entry", response_model=AuthorizeEntryResponse)
async def authorize_entry(payload: AuthorizeEntryRequest):
    """
    Step 2 - PIN Authorization.
    Verifies the authorization PIN.
    If valid:
      - Creates authorized entry record.
      - Dispatches email to Main Gate Security.
      - Dispatches visitor notification (Email and/or SMS).
      - Returns status AUTHORIZED.
    If invalid:
      - Returns status NOT AUTHORIZED without sending notifications.
    """
    success, message, clean_names = auth_service.authorize_visitor_entry(
        visitor_names=payload.visitor_names,
        pin=payload.pin
    )

    if not success:
        return AuthorizeEntryResponse(
            success=False,
            authorization_status="NOT AUTHORIZED",
            message="Invalid authorization PIN" if "PIN" in message else message,
            visitor_names=None
        )

    # Step 3 - Automatic Notification
    try:
        send_security_email(
            visitor_names=clean_names,
            authorization_status="AUTHORIZED",
            pin=payload.pin
        )
    except Exception as e:
        logger.error(f"Failed to dispatch security email: {e}")

    try:
        send_visitor_email(
            visitor_names=clean_names,
            authorization_status="AUTHORIZED"
        )
    except Exception as e:
        logger.error(f"Failed to dispatch visitor email: {e}")

    try:
        send_visitor_sms(
            visitor_names=clean_names,
            authorization_status="AUTHORIZED"
        )
    except Exception as e:
        logger.error(f"Failed to dispatch visitor SMS: {e}")

    return AuthorizeEntryResponse(
        success=True,
        authorization_status="AUTHORIZED",
        message="Visitor entry authorized successfully",
        visitor_names=clean_names
    )


@app.post("/api/verify-entry", response_model=VerifyEntryResponse)
async def verify_entry(payload: VerifyEntryRequest):
    """
    Step 4 & 5 - Main Gate Verification & Excel Recording.
    Verifies visitor names and PIN.
    Checks:
      - PIN is correct.
      - Visitor names match an authorized entry.
      - Authorization has not already been completed.
    If valid:
      - Marks entry as completed.
      - Automatically logs the record into visitor_entries.xlsx.
      - Returns ENTRY AUTHORIZED.
    If already completed:
      - Returns ENTRY ALREADY COMPLETED (no duplicate Excel record).
    If invalid PIN or names:
      - Returns ENTRY NOT AUTHORIZED.
    """
    success, entry_status, message = auth_service.verify_and_complete_entry(
        visitor_names=payload.visitor_names,
        pin=payload.pin
    )

    if not success:
        return VerifyEntryResponse(
            success=False,
            entry_status=entry_status,
            message=message
        )

    # Automatic Excel recording with server local date/time
    now = datetime.now()
    entry_date = now.strftime("%Y-%m-%d")
    entry_time = now.strftime("%H:%M:%S")

    try:
        save_entry_to_excel(
            visitor_names=payload.visitor_names,
            entry_date=entry_date,
            entry_time=entry_time,
            authorization_status="AUTHORIZED",
            entry_status="ENTRY AUTHORIZED"
        )
    except Exception as e:
        logger.error(f"Excel write error: {e}")
        # Note: we return successful gate verification even if file write has issues,
        # but log the failure securely.

    return VerifyEntryResponse(
        success=True,
        entry_status="ENTRY AUTHORIZED",
        message="Entry authorized successfully"
    )


@app.post("/api/admin/change-pin", response_model=ChangePinResponse)
async def change_pin(payload: ChangePinRequest):
    """
    Admin-only endpoint to update the authorization PIN.
    Validates current PIN, ensures new PIN matches confirmation,
    and checks administrator secret.
    """
    success, message = auth_service.change_pin(
        current_pin=payload.current_pin,
        new_pin=payload.new_pin,
        confirm_new_pin=payload.confirm_new_pin,
        admin_secret=payload.admin_secret
    )

    return ChangePinResponse(
        success=success,
        message=message
    )


# Serve frontend static files
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
