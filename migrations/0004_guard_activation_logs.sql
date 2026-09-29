-- Migration: 0004_guard_activation_logs.sql
-- Track Guard activation emails and prevent duplicate dispatches

CREATE TABLE IF NOT EXISTS guard_activation_logs (
    id TEXT PRIMARY KEY,
    guard_id TEXT NOT NULL,
    guard_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL, -- 'SENT' or 'FAILED'
    provider_message_id TEXT,
    error_message TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (guard_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_guard_activation_email ON guard_activation_logs(guard_email);
CREATE INDEX IF NOT EXISTS idx_guard_activation_guard_id ON guard_activation_logs(guard_id);
