-- Migration: 0005_student_slot_bookings.sql
-- Slot-wise Student Booking System with Razorpay Integration (12 PM - 6 PM, 15-min slots, max 10 students, ₹500 base + 18% GST = ₹590)

CREATE TABLE IF NOT EXISTS student_slots (
    id TEXT PRIMARY KEY,
    slot_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    slot_label TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 10,
    booked_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'FULL'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(slot_date, slot_index)
);

CREATE TABLE IF NOT EXISTS student_bookings (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL,
    student_phone TEXT,
    booking_date TEXT NOT NULL,
    slots_count INTEGER NOT NULL DEFAULT 1,
    slot_ids_json TEXT NOT NULL,
    slots_display TEXT NOT NULL,
    base_amount REAL NOT NULL DEFAULT 500.00,
    cgst_amount REAL NOT NULL DEFAULT 45.00,
    sgst_amount REAL NOT NULL DEFAULT 45.00,
    gst_amount REAL NOT NULL DEFAULT 90.00,
    total_amount REAL NOT NULL DEFAULT 590.00,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    payment_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'FAILED', 'CANCELLED'
    booking_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED', 'FAILED'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_slot_reservations (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    slot_date TEXT NOT NULL,
    student_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES student_bookings(id),
    FOREIGN KEY (slot_id) REFERENCES student_slots(id)
);

CREATE INDEX IF NOT EXISTS idx_student_slots_date ON student_slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_student_bookings_date ON student_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_student_bookings_order_id ON student_bookings(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_student_bookings_status ON student_bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_student_slot_reservations_slot ON student_slot_reservations(slot_id);
