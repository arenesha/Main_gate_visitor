import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Users, IndianRupee, RefreshCw, CheckCircle2, 
  BarChart3, Filter, Search, ArrowUpRight, TrendingUp, AlertCircle, Trash2,
  FileSpreadsheet, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminSlotAnalytics() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [error, setError] = useState(null);
  const [resetting, setResetting] = useState(false);

  const fetchAnalytics = async (date) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/booking/analytics?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data);
      } else {
        setError(data.error || 'Failed to load slot analytics');
      }
    } catch (err) {
      setError('Failed to fetch analytics from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetBookings = async () => {
    if (!window.confirm('Are you sure you want to reset all slots to 0/10 booked and clear all test bookings?')) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/admin/booking/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchAnalytics(selectedDate);
      } else {
        alert(data.error || 'Failed to reset slots.');
      }
    } catch (e) {
      alert('Error connecting to server.');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm(`Are you sure you want to delete booking ${bookingId}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/booking/${bookingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchAnalytics(selectedDate);
      } else {
        alert(data.error || 'Failed to delete booking.');
      }
    } catch (e) {
      alert('Error connecting to server.');
    }
  };

  const handleExportToExcel = () => {
    if (!analyticsData) return;

    // 1. Sheet 1: Daily Summary
    const summaryRows = [
      { 'Metric': 'Report Date', 'Value': selectedDate },
      { 'Metric': 'Total Slots Configured', 'Value': 24 },
      { 'Metric': 'Total Daily Capacity', 'Value': summary.max_total_capacity },
      { 'Metric': 'Total Students Booked', 'Value': summary.total_booked_positions },
      { 'Metric': 'Daily Utilization %', 'Value': `${((summary.total_booked_positions / summary.max_total_capacity) * 100).toFixed(1)}%` },
      { 'Metric': 'Base Revenue Collected (INR)', 'Value': Number(summary.total_base_collected.toFixed(2)) },
      { 'Metric': 'CGST 9% Collected (INR)', 'Value': Number(summary.total_cgst_collected.toFixed(2)) },
      { 'Metric': 'SGST 9% Collected (INR)', 'Value': Number(summary.total_sgst_collected.toFixed(2)) },
      { 'Metric': 'Total GST 18% Collected (INR)', 'Value': Number(summary.total_gst_collected.toFixed(2)) },
      { 'Metric': 'Grand Total Collected (INR)', 'Value': Number(summary.grand_total_collected.toFixed(2)) }
    ];

    // 2. Sheet 2: 24 Slots Breakdown
    const slotsRows = (slots || []).map(s => ({
      'Slot #': s.slot_index,
      'Time Slot': s.time_slot,
      'Max Capacity': s.capacity,
      'Booked Count': s.booked,
      'Available Seats': s.available,
      'Base Revenue (INR)': Number(s.base_amount_collected.toFixed(2)),
      'CGST 9% (INR)': Number(s.cgst_collected.toFixed(2)),
      'SGST 9% (INR)': Number(s.sgst_collected.toFixed(2)),
      'Total GST 18% (INR)': Number(s.gst_collected.toFixed(2)),
      'Total Collected (INR)': Number(s.total_collected.toFixed(2)),
      'Slot Status': s.status
    }));

    // Template empty row to preserve all columns when 0 bookings
    const emptyReceiptsRow = {
      'Booking ID': '',
      'Student Name': '',
      'Student Email': '',
      'Student Phone': '',
      'Slots Booked': '',
      'Base Fee (INR)': '',
      'GST Amount (INR)': '',
      'Total Paid (INR)': '',
      'Payment Status': '',
      'Booking Status': '',
      'Razorpay Payment ID': '',
      'Booking Date': selectedDate,
      'Created At': ''
    };

    // 3. Sheet 3: Student Bookings & Audit Logs
    const bookingsRows = (bookings && bookings.length > 0)
      ? bookings.map(b => ({
          'Booking ID': b.id,
          'Student Name': b.student_name,
          'Student Email': b.student_email,
          'Student Phone': b.student_phone || 'N/A',
          'Slots Booked': b.slots_display || '',
          'Base Fee (INR)': Number((b.base_amount || 0).toFixed(2)),
          'GST Amount (INR)': Number((b.gst_amount || 0).toFixed(2)),
          'Total Paid (INR)': Number((b.total_amount || 0).toFixed(2)),
          'Payment Status': b.payment_status,
          'Booking Status': b.booking_status,
          'Razorpay Payment ID': b.razorpay_payment_id || 'N/A',
          'Booking Date': b.booking_date,
          'Created At': b.created_at || ''
        }))
      : [emptyReceiptsRow];

    // Create Excel Workbook
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Report');

    const wsSlots = XLSX.utils.json_to_sheet(slotsRows);
    XLSX.utils.book_append_sheet(wb, wsSlots, '24 Slots Breakdown');

    const wsBookings = XLSX.utils.json_to_sheet(bookingsRows);
    XLSX.utils.book_append_sheet(wb, wsBookings, 'Student Receipts');

    // Auto-fit column widths
    [wsSummary, wsSlots, wsBookings].forEach(ws => {
      ws['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    });

    // Download Excel file
    XLSX.writeFile(wb, `Student_Slot_Bookings_${selectedDate}.xlsx`);
  };

  // Export only the Student Booking Receipts table to Excel
  const handleExportReceiptsOnly = () => {
    const emptyReceiptsRow = {
      'Booking ID': '',
      'Student Name': '',
      'Student Email': '',
      'Student Phone': '',
      'Slots Booked': '',
      'Base Fee (INR)': '',
      'GST Amount (INR)': '',
      'Total Paid (INR)': '',
      'Payment Status': '',
      'Booking Status': '',
      'Razorpay Payment ID': '',
      'Booking Date': selectedDate,
      'Created At': ''
    };

    const bookingsRows = (bookings && bookings.length > 0)
      ? bookings.map(b => ({
          'Booking ID': b.id,
          'Student Name': b.student_name,
          'Student Email': b.student_email,
          'Student Phone': b.student_phone || 'N/A',
          'Slots Booked': b.slots_display || '',
          'Base Fee (INR)': Number((b.base_amount || 0).toFixed(2)),
          'GST Amount (INR)': Number((b.gst_amount || 0).toFixed(2)),
          'Total Paid (INR)': Number((b.total_amount || 0).toFixed(2)),
          'Payment Status': b.payment_status,
          'Booking Status': b.booking_status,
          'Razorpay Payment ID': b.razorpay_payment_id || 'N/A',
          'Booking Date': b.booking_date,
          'Created At': b.created_at || ''
        }))
      : [emptyReceiptsRow];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(bookingsRows);
    ws['!cols'] = [
      { wch: 18 }, { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 24 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 24 }, { wch: 14 }, { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Student Booking Receipts');
    XLSX.writeFile(wb, `Student_Booking_Receipts_${selectedDate}.xlsx`);
  };

  useEffect(() => {
    if (selectedDate) {
      fetchAnalytics(selectedDate);
    }
  }, [selectedDate]);

  const summary = analyticsData?.summary || {
    total_slots: 24,
    total_booked_positions: 0,
    max_total_capacity: 240,
    total_base_collected: 0,
    total_cgst_collected: 0,
    total_sgst_collected: 0,
    total_gst_collected: 0,
    grand_total_collected: 0
  };

  const slots = analyticsData?.slots || [];
  const bookings = analyticsData?.bookings || [];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Top Header with Date Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
            Slot Bookings & Revenue Analytics
          </h1>
          <p style={{ color: '#64748B', margin: 0, fontSize: '0.88rem' }}>
            Daily 24-slot performance (12:00 PM – 06:00 PM) • Capacity, taxes, and Razorpay collections
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '6px 14px', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
            <Calendar size={16} color="#64748B" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: 'none', outline: 'none', fontWeight: 700, fontSize: '0.88rem', color: '#0F172A' }}
            />
          </div>

          <button 
            onClick={handleExportToExcel}
            className="btn btn-sm"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: '#047857', 
              color: '#FFFFFF', 
              border: 'none', 
              borderRadius: '8px',
              padding: '6px 14px',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)'
            }}
            title="Download 24-slot breakdown & student receipts as one Excel file (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            Export to Excel (.xlsx)
          </button>

          <button 
            onClick={() => fetchAnalytics(selectedDate)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>

          <button 
            onClick={handleResetBookings}
            disabled={resetting}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', borderColor: '#FECACA' }}
            title="Reset all 24 slots to 0/10 booked and clear all test bookings"
          >
            <Trash2 size={14} />
            {resetting ? 'Resetting...' : 'Reset All Bookings'}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '26px' }}>
        
        {/* Total Revenue Card */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)', color: '#FFFFFF' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#A5B4FC', fontWeight: 700, letterSpacing: '0.04em' }}>
            Total Collected
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, margin: '6px 0 4px 0', color: '#FFFFFF' }}>
            ₹{summary.grand_total_collected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#C7D2FE' }}>
            ₹{summary.total_base_collected.toLocaleString('en-IN')} Base + ₹{summary.total_gst_collected.toLocaleString('en-IN')} GST
          </div>
        </div>

        {/* Booked Students Card */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', background: '#FFFFFF' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em' }}>
            Total Students Booked
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, margin: '6px 0 4px 0', color: '#0F172A' }}>
            {summary.total_booked_positions} <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 500 }}>/ {summary.max_total_capacity}</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#10B981', fontWeight: 600 }}>
            {((summary.total_booked_positions / summary.max_total_capacity) * 100).toFixed(1)}% Daily Utilization
          </div>
        </div>

        {/* Base Revenue Card */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', background: '#FFFFFF' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em' }}>
            Base Revenue (₹500 / slot)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, margin: '6px 0 4px 0', color: '#0284C7' }}>
            ₹{summary.total_base_collected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
            Excludes 18% GST component
          </div>
        </div>

        {/* Total Taxes Card */}
        <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', background: '#FFFFFF' }}>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em' }}>
            GST Collected (18%)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, margin: '6px 0 4px 0', color: '#D97706' }}>
            ₹{summary.total_gst_collected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
            CGST: ₹{summary.total_cgst_collected.toFixed(2)} | SGST: ₹{summary.total_sgst_collected.toFixed(2)}
          </div>
        </div>

      </div>

      {/* 24-Slots Schedule & Revenue Table */}
      <div className="glass-card" style={{ borderRadius: '18px', overflow: 'hidden', background: '#FFFFFF', marginBottom: '32px' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Slot Breakdown (24 Slots • 15 Minutes Duration)
            </h2>
            <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '0.8rem' }}>
              Detailed financial metrics per slot on {selectedDate}
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 18px' }}>#</th>
                <th style={{ padding: '12px 18px' }}>Time Slot</th>
                <th style={{ padding: '12px 18px' }}>Capacity</th>
                <th style={{ padding: '12px 18px' }}>Booked</th>
                <th style={{ padding: '12px 18px' }}>Available</th>
                <th style={{ padding: '12px 18px' }}>Base Amount</th>
                <th style={{ padding: '12px 18px' }}>CGST (9%)</th>
                <th style={{ padding: '12px 18px' }}>SGST (9%)</th>
                <th style={{ padding: '12px 18px' }}>GST (18%)</th>
                <th style={{ padding: '12px 18px' }}>Total Collected</th>
                <th style={{ padding: '12px 18px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {slots.map(s => {
                const isFull = s.status === 'FULL' || s.booked >= s.capacity;
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9', background: isFull ? '#FFF1F2' : 'transparent' }}>
                    <td style={{ padding: '12px 18px', color: '#94A3B8', fontWeight: 600 }}>
                      {s.slot_index}
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0F172A' }}>
                      {s.time_slot}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#475569' }}>
                      {s.capacity}
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 800, color: s.booked > 0 ? '#4338CA' : '#64748B' }}>
                      {s.booked}
                    </td>
                    <td style={{ padding: '12px 18px', color: s.available > 0 ? '#059669' : '#DC2626', fontWeight: 700 }}>
                      {s.available}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#334155' }}>
                      ₹{s.base_amount_collected.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748B' }}>
                      ₹{s.cgst_collected.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748B' }}>
                      ₹{s.sgst_collected.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748B' }}>
                      ₹{s.gst_collected.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0F172A' }}>
                      ₹{s.total_collected.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      {isFull ? (
                        <span style={{ background: '#FEE2E2', color: '#DC2626', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                          FULL (10/10)
                        </span>
                      ) : (
                        <span style={{ background: '#DCFCE7', color: '#15803D', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                          AVAILABLE
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmed Bookings Audit Table */}
      <div className="glass-card" style={{ borderRadius: '18px', overflow: 'hidden', background: '#FFFFFF' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Student Booking Receipts ({bookings.length})
            </h2>
            <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '0.8rem' }}>
              Razorpay transaction audit logs for {selectedDate}
            </p>
          </div>

          <button
            onClick={handleExportReceiptsOnly}
            className="btn btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 14px',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
            }}
            title="Download Student Booking Receipts table as Excel (.xlsx)"
          >
            <Download size={14} />
            Export Receipts to Excel (.xlsx)
          </button>
        </div>

        {bookings.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
            No student bookings recorded on {selectedDate} yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 18px' }}>Booking ID</th>
                  <th style={{ padding: '12px 18px' }}>Student Name</th>
                  <th style={{ padding: '12px 18px' }}>Email & Phone</th>
                  <th style={{ padding: '12px 18px' }}>Slots Booked</th>
                  <th style={{ padding: '12px 18px' }}>Total Paid</th>
                  <th style={{ padding: '12px 18px' }}>Payment Status</th>
                  <th style={{ padding: '12px 18px' }}>Booking Status</th>
                  <th style={{ padding: '12px 18px' }}>Razorpay Payment ID</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontWeight: 800, color: '#4338CA' }}>
                      {b.id}
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0F172A' }}>
                      {b.student_name}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748B' }}>
                      <div>{b.student_email}</div>
                      <div style={{ fontSize: '0.74rem' }}>{b.student_phone || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '12px 18px', color: '#0284C7', fontWeight: 600 }}>
                      {b.slots_display}
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 800, color: '#10B981' }}>
                      ₹{b.total_amount?.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ 
                        background: b.payment_status === 'PAID' ? '#DCFCE7' : '#FEE2E2', 
                        color: b.payment_status === 'PAID' ? '#15803D' : '#DC2626',
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.72rem', 
                        fontWeight: 800 
                      }}>
                        {b.payment_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ 
                        background: b.booking_status === 'CONFIRMED' ? '#EEF2FF' : '#FEF3C7', 
                        color: b.booking_status === 'CONFIRMED' ? '#4338CA' : '#B45309',
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.72rem', 
                        fontWeight: 800 
                      }}>
                        {b.booking_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#475569' }}>
                      {b.razorpay_payment_id || 'N/A'}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteBooking(b.id)}
                        style={{
                          background: '#FEE2E2',
                          color: '#DC2626',
                          border: '1px solid #FECACA',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title={`Delete booking ${b.id}`}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
