-- Migration: 0002_email_logs.sql
-- Table to track real email delivery to both Company and Guard recipients

CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_type TEXT NOT NULL, -- 'COMPANY' or 'GUARD'
    subject TEXT NOT NULL,
    status TEXT NOT NULL, -- 'SENT' or 'FAILED'
    provider_message_id TEXT,
    error_message TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);

CREATE INDEX IF NOT EXISTS idx_email_logs_invitation_id ON email_logs(invitation_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
