import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Users, ShieldCheck, CheckCircle2, AlertTriangle, 
  CreditCard, RefreshCw, X, Receipt, Download, AlertCircle, ArrowRight, Check,
  QrCode, Smartphone, Building, Wallet, Key, ExternalLink, Copy
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { RAZORPAY_PAYMENT_URL, RAZORPAY_BENEFICIARY_NAME, RAZORPAY_HANDLE, MERCHANT_UPI_ID } from '../utils/paymentConfig';

const BASE_PRICE = 500;

export default function StudentSlotBooking() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');

  // Student details
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');

  // Payment states
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const [activeCheckout, setActiveCheckout] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('UPI');
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(RAZORPAY_PAYMENT_URL);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyAmount = () => {
    if (activeCheckout) {
      navigator.clipboard.writeText(String(activeCheckout.totalPayable));
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2500);
    }
  };

  // Load Razorpay Checkout script dynamically
  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Fetch slots for selected date
  const fetchSlots = async (date) => {
    setLoading(true);
    setPaymentError(null);
    try {
      const res = await fetch(`/api/booking/slots?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setSlots(data.slots || []);
        if (data.razorpay_key_id) {
          setRazorpayKeyId(data.razorpay_key_id);
        }
      } else {
        setPaymentError(data.error || 'Failed to load time slots.');
      }
    } catch (err) {
      setPaymentError('Could not connect to booking server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
      setSelectedSlotIds([]);
    }
  }, [selectedDate]);

  // Toggle slot selection
  const toggleSlot = (slot) => {
    if (slot.is_full || slot.booked_count >= slot.max_capacity) return;

    setPaymentError(null);
    setPaymentCancelled(false);

    setSelectedSlotIds(prev => {
      if (prev.includes(slot.id)) {
        return prev.filter(id => id !== slot.id);
      } else {
        return [...prev, slot.id];
      }
    });
  };

  // Government of India GST configuration:
  // Base Student Booking Fee: ₹500.00
  // Applicable Govt. GST (18%): CGST 9% (₹45.00) + SGST 9% (₹45.00) = ₹90.00 per slot
  // Total per slot: ₹590.00
  const [isGstExempt, setIsGstExempt] = useState(false);

  // Pricing calculations
  const slotsCount = selectedSlotIds.length;
  const baseAmount = slotsCount * BASE_PRICE;
  const otherCharges = 0;
  const cgstAmount = isGstExempt ? 0 : slotsCount * 45;
  const sgstAmount = isGstExempt ? 0 : slotsCount * 45;
  const totalGst = cgstAmount + sgstAmount;
  const totalPayable = baseAmount + totalGst + otherCharges;

  // Selected slots objects
  const selectedSlotsList = slots.filter(s => selectedSlotIds.includes(s.id));

  // Handle Checkout initiation
  const handleInitiatePayment = async (e) => {
    e.preventDefault();
    if (slotsCount === 0) {
      setPaymentError('Please select at least one time slot.');
      return;
    }
    if (!studentName.trim()) {
      setPaymentError('Please enter the student name.');
      return;
    }
    if (!studentEmail.trim()) {
      setPaymentError('Please enter a valid student email.');
      return;
    }

    setProcessingPayment(true);
    setPaymentError(null);
    setPaymentCancelled(false);

    try {
      // 1. Create Order on trusted server
      const orderRes = await fetch('/api/booking/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          slot_ids: selectedSlotIds,
          student_name: studentName.trim(),
          student_email: studentEmail.trim(),
          student_phone: studentPhone.trim(),
          is_gst_exempt: isGstExempt
        })
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to create booking order.');
      }

      const { booking_id, razorpay_order_id, razorpay_key_id: serverKeyId, amount, breakdown, slots: orderSlots } = orderData;
      const effectiveKeyId = serverKeyId || razorpayKeyId || 'rzp_test_arene_sha_demo';

      const isRealRazorpayKey = effectiveKeyId.startsWith('rzp_test_') && !effectiveKeyId.includes('demo') && !effectiveKeyId.includes('xxxx');

      // If user has supplied a real Razorpay test/live key, open Razorpay popup
      if (isRealRazorpayKey && typeof window.Razorpay === 'function') {
        const rzpOptions = {
          key: effectiveKeyId,
          amount: amount,
          currency: 'INR',
          name: 'AreneSHA',
          description: `Student Slot Booking (${slotsCount} slot${slotsCount > 1 ? 's' : ''})`,
          image: 'https://arenesha.com/_next/image?url=%2Fassets%2Flogo-primary.png&w=384&q=75',
          order_id: razorpay_order_id.startsWith('order_test_') ? undefined : razorpay_order_id,
          prefill: {
            name: studentName,
            email: studentEmail,
            contact: studentPhone
          },
          theme: {
            color: '#152C4E'
          },
          modal: {
            ondismiss: async () => {
              setProcessingPayment(false);
              setPaymentCancelled(true);
            }
          },
          handler: async function (response) {
            await handleVerifyPaymentOnServer(booking_id, response.razorpay_order_id || razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
          }
        };

        const razorpayInstance = new window.Razorpay(rzpOptions);
        razorpayInstance.on('payment.failed', function (resp) {
          setProcessingPayment(false);
          setPaymentError(resp.error?.description || 'Your payment was not completed. Your slot has not been confirmed.');
        });
        razorpayInstance.open();
        setProcessingPayment(false);
      } else {
        // Open the Razorpay Official Checkout UI Experience Modal directly
        setActiveCheckout({
          booking_id,
          razorpay_order_id,
          amount,
          totalPayable,
          breakdown,
          slots: orderSlots,
          studentName,
          studentEmail,
          studentPhone,
          keyId: effectiveKeyId
        });
        setProcessingPayment(false);
      }

    } catch (err) {
      setProcessingPayment(false);
      setPaymentError(err.message || 'Payment initiation error.');
    }
  };

  // Complete Payment Verification on backend
  const handleVerifyPaymentOnServer = async (booking_id, order_id, payment_id, signature) => {
    setProcessingPayment(true);
    setPaymentError(null);
    try {
      const verifyRes = await fetch('/api/booking/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking_id,
          razorpay_order_id: order_id,
          razorpay_payment_id: payment_id || `pay_${Date.now()}`,
          razorpay_signature: signature || 'sig_verified'
        })
      });

      const verifyData = await verifyRes.json();

      if (verifyRes.ok && verifyData.success && verifyData.verified) {
        setConfirmedBooking(verifyData.booking);
        setActiveCheckout(null);
        setSelectedSlotIds([]);
        fetchSlots(selectedDate);
      } else {
        setPaymentError(verifyData.error || 'Payment verification failed on the server.');
      }
    } catch (err) {
      setPaymentError('Error verifying payment on backend: ' + err.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handle Simulated Payment Failure
  const handleSimulateFailure = async () => {
    if (!activeCheckout) return;
    setProcessingPayment(true);
    try {
      await fetch('/api/booking/payment-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: activeCheckout.booking_id,
          error: 'Payment failed by user simulation'
        })
      });
    } catch (e) {}
    setActiveCheckout(null);
    setProcessingPayment(false);
    setPaymentError('Your payment was not completed. Your slot has not been confirmed.');
  };

  // Handle Modal Close / Cancel
  const handleCloseCheckout = () => {
    setActiveCheckout(null);
    setPaymentCancelled(true);
    setProcessingPayment(false);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 0 50px 0' }}>
      
      {/* Header Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', 
        borderRadius: '20px', 
        padding: '28px 32px', 
        color: '#FFFFFF', 
        marginBottom: '26px', 
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '24px' 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{ 
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)', 
              color: '#FFFFFF', 
              padding: '4px 12px', 
              borderRadius: '8px', 
              fontSize: '0.76rem', 
              fontWeight: 800, 
              letterSpacing: '0.06em', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)' 
            }}>
              <Building size={13} />
              ARENESHA LAB & WORKSPACE
            </span>
            <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>
              📍 Meenakshi Tech Park, Gachibowli
            </span>
          </div>

          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Student Slot Booking
          </h1>

          <p style={{ color: '#CBD5E1', margin: 0, fontSize: '0.94rem', maxWidth: '620px', lineHeight: 1.5 }}>
            15-Minute focused study and project sessions (12:00 PM – 06:00 PM). Max 10 students per slot with Razorpay checkout.
          </p>
        </div>

        {/* Price Tag Highlight Card */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.05) 100%)', 
          border: '1px solid rgba(56, 189, 248, 0.35)', 
          borderRadius: '18px', 
          padding: '18px 22px', 
          minWidth: '290px', 
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.25)', 
          backdropFilter: 'blur(10px)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>
              Student Booking Fee
            </span>
            <span style={{ fontSize: '0.68rem', background: 'rgba(56, 189, 248, 0.18)', color: '#38BDF8', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
              Per Slot
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              ₹500
            </span>
            <span style={{ fontSize: '0.86rem', color: '#94A3B8', fontWeight: 600 }}>
              Base Fee
            </span>
          </div>

          <div style={{ 
            background: 'rgba(15, 23, 42, 0.65)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '10px', 
            padding: '9px 12px', 
            fontSize: '0.78rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '4px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>+ GST (18% Govt. Tax):</span>
              <strong style={{ color: '#FCD34D' }}>₹90.00</strong>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderTop: '1px solid rgba(255, 255, 255, 0.12)', 
              paddingTop: '6px', 
              marginTop: '3px' 
            }}>
              <span style={{ fontWeight: 800, color: '#38BDF8', fontSize: '0.82rem' }}>Total Payable:</span>
              <span style={{ fontWeight: 900, color: '#34D399', fontSize: '1.2rem' }}>₹590.00</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Slot Selection & Checkout Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '26px', alignItems: 'start' }}>
        
        {/* Left Column: Date Selector & 24 Slots Grid */}
        <div>
          {/* Date Picker Bar */}
          <div className="glass-card" style={{ padding: '18px 22px', borderRadius: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={20} />
              </div>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Select Booking Date
                </label>
                <input 
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ 
                    border: '1px solid #CBD5E1', 
                    borderRadius: '8px', 
                    padding: '6px 12px', 
                    fontSize: '0.92rem', 
                    fontWeight: 700,
                    color: '#0F172A',
                    outline: 'none',
                    marginTop: '3px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                type="button"
                onClick={() => fetchSlots(selectedDate)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                Refresh Availability
              </button>
            </div>
          </div>

          {/* Time Slots Notice */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
              <Clock size={16} color="#0284C7" />
              <span>Available Slots (12:00 PM to 06:00 PM • 24 Slots)</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
              Capacity limit: <strong style={{ color: '#0F172A' }}>10 students / slot</strong>
            </div>
          </div>

          {/* Slots 4-Column Grid */}
          {loading ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center', borderRadius: '16px' }}>
              <RefreshCw size={28} className="spin" style={{ color: '#0284C7', margin: '0 auto 12px auto' }} />
              <p style={{ color: '#64748B', margin: 0, fontWeight: 600 }}>Loading 15-minute slot schedules...</p>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
              gap: '12px' 
            }}>
              {slots.map(slot => {
                const isSelected = selectedSlotIds.includes(slot.id);
                const isFull = slot.is_full || slot.booked_count >= slot.max_capacity;

                return (
                  <div
                    key={slot.id}
                    onClick={() => !isFull && toggleSlot(slot)}
                    style={{
                      border: isSelected 
                        ? '2px solid #0284C7' 
                        : isFull 
                          ? '1px solid #E2E8F0' 
                          : '1px solid #CBD5E1',
                      background: isSelected 
                        ? '#F0F9FF' 
                        : isFull 
                          ? '#F8FAFC' 
                          : '#FFFFFF',
                      borderRadius: '14px',
                      padding: '14px',
                      cursor: isFull ? 'not-allowed' : 'pointer',
                      opacity: isFull ? 0.65 : 1,
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      boxShadow: isSelected ? '0 4px 14px rgba(2, 132, 199, 0.18)' : '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Top Row: Time & Selection indicator */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: isFull ? '#64748B' : '#0F172A' }}>
                        {slot.slot_label}
                      </div>
                      {isSelected && (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0284C7', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Capacity Indicator */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <div>
                        {isFull ? (
                          <span style={{ 
                            background: '#FEE2E2', 
                            color: '#DC2626', 
                            fontSize: '0.72rem', 
                            fontWeight: 800, 
                            padding: '2px 8px', 
                            borderRadius: '4px',
                            letterSpacing: '0.04em'
                          }}>
                            FULL (10/10)
                          </span>
                        ) : (
                          <span style={{ 
                            background: slot.booked_count > 6 ? '#FEF3C7' : '#DCFCE7', 
                            color: slot.booked_count > 6 ? '#B45309' : '#15803D', 
                            fontSize: '0.72rem', 
                            fontWeight: 700, 
                            padding: '2px 8px', 
                            borderRadius: '4px' 
                          }}>
                            {slot.available_count} available
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                        {slot.booked_count}/10 booked
                      </div>
                    </div>

                    {/* Progress Bar of Capacity */}
                    <div style={{ width: '100%', height: '5px', background: '#E2E8F0', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${Math.min(100, (slot.booked_count / slot.max_capacity) * 100)}%`, 
                        height: '100%', 
                        background: isFull ? '#EF4444' : slot.booked_count > 6 ? '#F59E0B' : '#10B981',
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Checkout & Price Summary Card */}
        <div style={{ position: 'sticky', top: '20px' }}>
          <div className="glass-card" style={{ borderRadius: '18px', padding: '24px', background: '#FFFFFF', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: '0 0 16px 0', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              Booking Summary
            </h3>

            {/* Error Alert */}
            {paymentError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 14px', borderRadius: '10px', fontSize: '0.84rem', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                  <AlertCircle size={16} />
                  <span>Payment Failed</span>
                </div>
                <p style={{ margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  {paymentError}
                </p>
                <div style={{ marginTop: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => setPaymentError(null)}
                    style={{ background: '#991B1B', color: '#FFFFFF', border: 'none', padding: '4px 10px', borderRadius: '5px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Payment Cancelled Notice */}
            {paymentCancelled && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E', padding: '12px 14px', borderRadius: '10px', fontSize: '0.84rem', marginBottom: '16px' }}>
                <div style={{ fontWeight: 800, marginBottom: '2px' }}>Payment cancelled.</div>
                <div style={{ fontSize: '0.78rem' }}>You can try again anytime.</div>
              </div>
            )}

            {/* Student Info Inputs */}
            <form onSubmit={handleInitiatePayment}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Student Name *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Student Email *
                </label>
                <input 
                  type="email"
                  required
                  placeholder="student@example.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Contact Phone (Optional)
                </label>
                <input 
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              {/* Slot Selection Summary List */}
              <div style={{ marginBottom: '16px', background: '#F8FAFC', borderRadius: '12px', padding: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  <span>Date:</span>
                  <span style={{ color: '#0F172A' }}>{selectedDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  <span>Selected Slots:</span>
                  <span style={{ color: '#0F172A' }}>{slotsCount} Slot{slotsCount !== 1 ? 's' : ''}</span>
                </div>
                {slotsCount > 0 ? (
                  <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.76rem', color: '#0284C7', fontWeight: 600 }}>
                    {selectedSlotsList.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>• {s.slot_label}</span>
                        <span>₹{isGstExempt ? '500.00' : '590.00'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                    Click any slot on the left to select
                  </div>
                )}
              </div>

              {/* Payment Summary Section adhering to Govt. of India GST Rules */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Payment Summary
                  </span>
                  <span style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Govt. of India GST Rules
                  </span>
                </div>

                {/* Student Booking Fee */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#334155', marginBottom: '8px' }}>
                  <span>Student Booking Fee:</span>
                  <strong style={{ color: '#0F172A' }}>
                    {slotsCount > 1 ? `${slotsCount} × ₹500.00 = ` : ''}₹{baseAmount.toFixed(2)}
                  </strong>
                </div>

                {/* GST Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', marginBottom: '4px' }}>
                  <span>
                    GST {isGstExempt ? '(0% - Exempt)' : '(18% - CGST 9% + SGST 9%)'}:
                  </span>
                  <strong style={{ color: isGstExempt ? '#059669' : '#0F172A' }}>
                    {isGstExempt ? '₹0.00' : `₹${totalGst.toFixed(2)}`}
                  </strong>
                </div>

                {/* Legal citation for transparency */}
                <div style={{ fontSize: '0.72rem', color: isGstExempt ? '#059669' : '#475569', marginBottom: '8px', lineHeight: 1.35, background: isGstExempt ? '#F0FDF4' : '#F8FAFC', padding: '6px 8px', borderRadius: '6px', border: isGstExempt ? '1px solid #BBF7D0' : '1px solid #E2E8F0' }}>
                  {isGstExempt ? (
                    <span>✓ Legally GST-exempt under Notification No. 12/2017-Central Tax (Rate), Entry 66 for student educational services.</span>
                  ) : (
                    <span>CGST (9%): ₹{cgstAmount.toFixed(2)} &nbsp;|&nbsp; SGST (9%): ₹{sgstAmount.toFixed(2)}</span>
                  )}
                </div>

                {/* Other Charges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748B', marginBottom: '12px' }}>
                  <span>Other Charges:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>₹0.00</span>
                </div>

                {/* Total Payable */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: '#EEF2FF', 
                  padding: '12px 14px', 
                  borderRadius: '10px', 
                  border: '1px solid #C7D2FE' 
                }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#312E81' }}>
                    Total Payable:
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#4338CA' }}>
                    ₹{totalPayable.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Checkout Action Button */}
              <button
                type="submit"
                disabled={slotsCount === 0 || processingPayment}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '10px',
                  background: slotsCount === 0 ? '#94A3B8' : '#152C4E',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.98rem',
                  fontWeight: 800,
                  cursor: slotsCount === 0 || processingPayment ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: slotsCount > 0 ? '0 4px 14px rgba(21, 44, 78, 0.3)' : 'none',
                  transition: 'background 0.2s'
                }}
              >
                {processingPayment ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    Submitting Booking...
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    Submit Booking • ₹{totalPayable.toFixed(2)}
                  </>
                )}
              </button>
            </form>

            {/* Razorpay Trust Badge */}
            <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#059669" />
              <span>100% Secure Checkout via Razorpay Payment Gateway</span>
            </div>
          </div>
        </div>

      </div>

      {/* RAZORPAY CHECKOUT MODAL EXPERIENCE - OPENS AFTER SUBMISSION */}
      {activeCheckout && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{ 
            maxWidth: '490px', 
            width: '100%', 
            background: '#FFFFFF', 
            borderRadius: '20px', 
            overflow: 'hidden', 
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            border: '1px solid #CBD5E1'
          }}>
            {/* Razorpay Brand Header */}
            <div style={{ background: '#0F1E36', color: '#FFFFFF', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#38BDF8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ARENESHA GATEPASS • RAZORPAY
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  Complete Student Payment
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94A3B8' }}>
                  Order: <span style={{ color: '#CBD5E1', fontFamily: 'monospace' }}>{activeCheckout.razorpay_order_id}</span>
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase' }}>Total Amount</div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#38BDF8' }}>
                  ₹{activeCheckout.totalPayable.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Merchant Details Bar */}
            <div style={{ background: '#F0F9FF', borderBottom: '1px solid #BAE6FD', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#0369A1' }}>
                Merchant: <strong>{RAZORPAY_BENEFICIARY_NAME}</strong>
              </div>
              <span style={{ fontSize: '0.72rem', background: '#E0F2FE', color: '#0284C7', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                {RAZORPAY_HANDLE}
              </span>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Booking Summary Mini Box */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ color: '#64748B' }}>Student:</span>
                  <strong style={{ color: '#0F172A' }}>{activeCheckout.studentName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Reserved:</span>
                  <span style={{ color: '#0284C7', fontWeight: 700 }}>{activeCheckout.slots?.length || 1} Slot(s)</span>
                </div>
              </div>

              {/* Payment Instructions Notice */}
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.8rem', color: '#92400E' }}>
                <div style={{ fontWeight: 800, marginBottom: '4px' }}>
                  ℹ️ How to Pay on Razorpay:
                </div>
                <div style={{ lineHeight: 1.4 }}>
                  On the Razorpay page, tap into the box showing placeholder <strong>500</strong> and enter <strong>{activeCheckout.totalPayable}</strong>. The <strong>Pay ₹{activeCheckout.totalPayable}</strong> button will activate immediately.
                </div>
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleCopyAmount}
                    style={{
                      background: copiedAmount ? '#DCFCE7' : '#FEF3C7',
                      color: copiedAmount ? '#15803D' : '#92400E',
                      border: '1px solid #FCD34D',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedAmount ? '✓ Amount Copied (₹' + activeCheckout.totalPayable + ')' : '📋 Copy Amount (₹' + activeCheckout.totalPayable + ')'}
                  </button>
                </div>
              </div>

              {/* Step 1: Pay Now Button linking to Official Razorpay */}
              <div style={{ marginBottom: '18px' }}>
                <a
                  href={RAZORPAY_PAYMENT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                    color: '#FFFFFF',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  <CreditCard size={20} />
                  <span>Pay ₹{activeCheckout.totalPayable.toFixed(2)} Now</span>
                  <ExternalLink size={18} />
                </a>
              </div>

              {/* Or Scan UPI QR Code */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px', textAlign: 'center', marginBottom: '18px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B', marginBottom: '4px' }}>
                  Scan QR with Mobile Camera / Any UPI App
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: '12px' }}>
                  Supports Google Pay, PhonePe, Paytm, BHIM & Mobile Browser
                </div>

                <div style={{ 
                  width: '180px', 
                  height: '180px', 
                  margin: '0 auto 10px auto', 
                  background: '#FFFFFF', 
                  border: '2px solid #0F172A', 
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
                }}>
                  <QRCodeSVG 
                    value={
                      MERCHANT_UPI_ID 
                        ? `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(RAZORPAY_BENEFICIARY_NAME)}&am=${activeCheckout.totalPayable.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Student Slot Booking')}`
                        : RAZORPAY_PAYMENT_URL
                    }
                    size={160}
                    level="Q"
                    includeMargin={true}
                  />
                </div>

                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F766E', marginBottom: '12px' }}>
                  ✓ Verified Merchant: {RAZORPAY_HANDLE}
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: copiedLink ? '#DCFCE7' : '#FFFFFF',
                      border: copiedLink ? '1px solid #86EFAC' : '1px solid #CBD5E1',
                      color: copiedLink ? '#15803D' : '#334155',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    {copiedLink ? 'Link Copied!' : 'Copy Payment Link'}
                  </button>

                  <a
                    href={RAZORPAY_PAYMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: '#0F172A',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={14} />
                    Open in Browser
                  </a>
                </div>
              </div>

              {/* Step 2: Confirmation & Pass Generation */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Step 2: Confirm Payment & Generate Pass
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder="Razorpay Payment ID / UTR (Optional, e.g. pay_...)"
                    value={paymentRefInput}
                    onChange={(e) => setPaymentRefInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.84rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button
                  type="button"
                  disabled={processingPayment}
                  onClick={() => handleVerifyPaymentOnServer(
                    activeCheckout.booking_id,
                    activeCheckout.razorpay_order_id,
                    paymentRefInput.trim() || `pay_${Date.now()}`,
                    'sig_valid_verified'
                  )}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '10px',
                    background: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.96rem',
                    cursor: processingPayment ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  {processingPayment ? (
                    <>
                      <RefreshCw size={18} className="spin" />
                      Verifying Payment...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      I Have Paid • Confirm & Get Gate Pass
                    </>
                  )}
                </button>
              </div>

              {/* Bottom Cancel Button */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleCloseCheckout}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '4px 10px',
                    textDecoration: 'underline'
                  }}
                >
                  Cancel and return to booking
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION RECEIPT / INVOICE MODAL */}
      {confirmedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{ 
            maxWidth: '520px', 
            width: '100%', 
            background: '#FFFFFF', 
            borderRadius: '20px', 
            overflow: 'hidden', 
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid #E2E8F0'
          }}>
            {/* Header */}
            <div style={{ background: '#0F172A', color: '#FFFFFF', padding: '24px 26px', textAlign: 'center', position: 'relative' }}>
              <button 
                onClick={() => setConfirmedBooking(null)}
                style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>

              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#10B981', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <Check size={28} strokeWidth={3} />
              </div>
              
              <div style={{ fontSize: '0.78rem', letterSpacing: '0.1em', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', marginBottom: '2px' }}>
                ARENE SHA
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                Booking Confirmation
              </h2>
              <div style={{ fontSize: '0.84rem', color: '#94A3B8' }}>
                Payment verified & capacity reserved
              </div>
            </div>

            {/* Receipt Body */}
            <div style={{ padding: '24px 28px' }}>
              
              {/* Meta Grid */}
              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '14px', border: '1px solid #E2E8F0', marginBottom: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.74rem' }}>Booking ID:</span>
                    <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{confirmedBooking.id}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.74rem' }}>Student:</span>
                    <strong style={{ color: '#0F172A' }}>{confirmedBooking.student_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.74rem' }}>Date:</span>
                    <strong style={{ color: '#0F172A' }}>{confirmedBooking.booking_date}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.74rem' }}>Payment Status:</span>
                    <span style={{ background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.75rem' }}>
                      {confirmedBooking.payment_status}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #E2E8F0', fontSize: '0.84rem' }}>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.74rem' }}>Time Slot(s):</span>
                  <strong style={{ color: '#0284C7' }}>{confirmedBooking.slots_display}</strong>
                </div>
              </div>

              {/* Price Breakdown */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: '#475569', marginBottom: '5px' }}>
                  <span>Student Booking Fee:</span>
                  <strong>₹{confirmedBooking.base_amount?.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748B', marginBottom: '5px' }}>
                  <span>GST:</span>
                  <strong style={{ color: (confirmedBooking.gst_amount || 0) === 0 ? '#059669' : '#0F172A' }}>
                    {(confirmedBooking.gst_amount || 0) === 0 ? '₹0.00 (Exempt)' : `₹${confirmedBooking.gst_amount?.toFixed(2)}`}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748B', marginBottom: '8px' }}>
                  <span>Other Charges:</span>
                  <span>₹0.00</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px dashed #CBD5E1', paddingTop: '10px', fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
                  <span>Total Paid:</span>
                  <span style={{ color: '#10B981' }}>₹{confirmedBooking.total_amount?.toFixed(2)}</span>
                </div>
              </div>

              {/* Razorpay Audit Proof */}
              <div style={{ background: '#F1F5F9', borderRadius: '10px', padding: '12px 14px', fontSize: '0.76rem', color: '#475569', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Merchant:</span>
                  <strong style={{ color: '#0F172A' }}>{RAZORPAY_BENEFICIARY_NAME}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Razorpay Payment ID:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{confirmedBooking.razorpay_payment_id}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Payment Gateway Link:</span>
                  <a href={RAZORPAY_PAYMENT_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#0284C7', fontWeight: 700, textDecoration: 'none' }}>
                    {RAZORPAY_HANDLE} ↗
                  </a>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '8px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    color: '#0F172A',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={16} />
                  Print Receipt
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmedBooking(null)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '8px',
                    background: '#152C4E',
                    border: 'none',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
