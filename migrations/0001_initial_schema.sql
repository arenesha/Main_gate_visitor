-- Migration: 0001_initial_schema.sql
-- Cloudflare D1 Database schema for Main Gate Visitor Management System

CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    visitor_name TEXT NOT NULL,
    visitor_phone TEXT,
    visitor_email TEXT,
    purpose TEXT NOT NULL,
    host_name TEXT NOT NULL,
    host_department TEXT,
    vehicle_number TEXT,
    entry_code TEXT NOT NULL,
    qr_token TEXT NOT NULL UNIQUE,
    valid_from TEXT NOT NULL,
    valid_until TEXT NOT NULL,
    entry_type TEXT NOT NULL DEFAULT 'SINGLE',
    max_entries INTEGER DEFAULT 1,
    entries_used INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_qr_token ON invitations(qr_token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_created_at ON invitations(created_at);

CREATE TABLE IF NOT EXISTS gate_verifications (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL,
    verification_method TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    verified_by TEXT DEFAULT 'Main Gate Officer',
    verified_at TEXT NOT NULL,
    ip_address TEXT,
    FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);

CREATE INDEX IF NOT EXISTS idx_verifications_invitation_id ON gate_verifications(invitation_id);
CREATE INDEX IF NOT EXISTS idx_verifications_verified_at ON gate_verifications(verified_at);
