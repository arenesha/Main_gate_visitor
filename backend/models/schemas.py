from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class AuthorizeEntryRequest(BaseModel):
    visitor_names: List[str] = Field(
        ..., 
        min_length=1, 
        description="List of visitor name(s)"
    )
    pin: str = Field(..., min_length=1, description="Authorization PIN")

    @field_validator("visitor_names")
    @classmethod
    def validate_visitor_names(cls, v: List[str]) -> List[str]:
        cleaned = [name.strip() for name in v if name and name.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty visitor name must be provided")
        return cleaned

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Authorization PIN cannot be empty")
        return cleaned


class AuthorizeEntryResponse(BaseModel):
    success: bool
    authorization_status: str
    message: str
    visitor_names: Optional[List[str]] = None


class VerifyEntryRequest(BaseModel):
    visitor_names: List[str] = Field(
        ..., 
        min_length=1, 
        description="List of visitor name(s) to verify"
    )
    pin: str = Field(..., min_length=1, description="Authorization PIN")

    @field_validator("visitor_names")
    @classmethod
    def validate_visitor_names(cls, v: List[str]) -> List[str]:
        cleaned = [name.strip() for name in v if name and name.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty visitor name must be provided")
        return cleaned

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Authorization PIN cannot be empty")
        return cleaned


class VerifyEntryResponse(BaseModel):
    success: bool
    entry_status: str
    message: str


class ChangePinRequest(BaseModel):
    current_pin: str = Field(..., min_length=1, description="Current authorization PIN")
    new_pin: str = Field(..., min_length=1, description="New authorization PIN")
    confirm_new_pin: str = Field(..., min_length=1, description="Confirmation of new authorization PIN")
    admin_secret: Optional[str] = Field(None, description="Administrator secret key for elevated authorization")

    @field_validator("current_pin", "new_pin", "confirm_new_pin")
    @classmethod
    def validate_pins(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("PIN fields cannot be empty")
        return cleaned


class ChangePinResponse(BaseModel):
    success: bool
    message: str


class HealthResponse(BaseModel):
    status: str
    version: str
    active_authorizations_count: int
