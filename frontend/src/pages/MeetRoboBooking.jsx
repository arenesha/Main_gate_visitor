import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, Clock, Users, ShieldCheck, CheckCircle2, AlertTriangle, 
  CreditCard, RefreshCw, X, Receipt, Download, AlertCircle, ArrowRight, Check,
  QrCode, Smartphone, Building, Wallet, Key, ExternalLink, Copy, Lock, Sparkles, User, Mail, Phone, ChevronDown
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { RAZORPAY_PAYMENT_URL, RAZORPAY_BENEFICIARY_NAME, RAZORPAY_HANDLE, MERCHANT_UPI_ID } from '../utils/paymentConfig';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import LoginModal from '../components/LoginModal';

const BASE_PRICE = 500;

export default function MeetRoboBooking() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const slotSectionRef = useRef(null);

  const isDirectBooking = location.pathname === '/booking' || location.search.includes('signup=true');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (isDirectBooking && slotSectionRef.current) {
      setTimeout(() => {
        slotSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [isDirectBooking]);

  const [selectedDate, setSelectedDate] = useState(() => {
    // Event date is Fri 2 Oct 2026 or today
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
  const [collegeName, setCollegeName] = useState('');

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
        const loadedSlots = data.slots || [];
        setSlots(loadedSlots);
        if (data.razorpay_key_id) {
          setRazorpayKeyId(data.razorpay_key_id);
        }
        // Auto-select first available slot immediately so a slot is always ready
        const firstAvailable = loadedSlots.find(s => !s.is_full && s.booked_count < s.max_capacity);
        if (firstAvailable) {
          setSelectedSlotIds([firstAvailable.id]);
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

  // Pricing calculations: Base ₹500 + 18% GST (₹90 = ₹45 CGST + ₹45 SGST) = ₹590 Total
  const slotsCount = selectedSlotIds.length;
  const baseAmount = slotsCount * BASE_PRICE;
  const cgstAmount = slotsCount * 45;
  const sgstAmount = slotsCount * 45;
  const totalGst = cgstAmount + sgstAmount;
  const totalPayable = baseAmount + totalGst;

  const selectedSlotsList = slots.filter(s => selectedSlotIds.includes(s.id));

  // Open slot booking in new tab when clicking "SIGN UP ->" on the Meet Robo hero
  const handleSignUpClick = () => {
    window.open('/booking', '_blank');
    setShowSlots(true);
  };

  // Handle Checkout initiation
  const handleInitiatePayment = async (e) => {
    e.preventDefault();

    let currentSlotIds = selectedSlotIds;
    if (currentSlotIds.length === 0) {
      const firstAvailable = slots.find(s => !s.is_full && s.booked_count < s.max_capacity);
      if (firstAvailable) {
        currentSlotIds = [firstAvailable.id];
        setSelectedSlotIds([firstAvailable.id]);
      } else {
        setPaymentError('All slots are currently booked for this date. Please pick another date.');
        return;
      }
    }

    if (!studentName.trim()) {
      setPaymentError('Please enter your full name.');
      return;
    }
    if (!studentEmail.trim()) {
      setPaymentError('Please enter a valid email address.');
      return;
    }

    setProcessingPayment(true);
    setPaymentError(null);
    setPaymentCancelled(false);

    try {
      const orderRes = await fetch('/api/booking/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: studentName.trim(),
          student_email: studentEmail.trim().toLowerCase(),
          student_phone: studentPhone.trim() || null,
          slot_ids: currentSlotIds,
          date: selectedDate,
          slot_date: selectedDate,
          college: collegeName.trim() || 'AreneSHA AI Summit Attendee'
        })
      });

      const orderData = await orderRes.json();
      if (!orderData.success) {
        throw new Error(orderData.error || 'Unable to reserve time slots.');
      }

      const razorpayUrl = 'https://razorpay.me/@edifynuvaaitechnologiesprivat';

      setActiveCheckout({
        bookingId: orderData.booking_id,
        orderId: orderData.order_id,
        amount: orderData.amount,
        baseAmount,
        totalGst,
        cgstAmount,
        sgstAmount,
        totalPayable,
        slotsCount,
        studentName,
        studentEmail,
        studentPhone,
        college: collegeName.trim() || 'AreneSHA AI Summit Attendee',
        slots: selectedSlotsList,
        slotDate: selectedDate,
        upiIntentUrl: orderData.upi_intent_url || `upi://pay?pa=${MERCHANT_UPI_ID}&pn=${encodeURIComponent(RAZORPAY_BENEFICIARY_NAME)}&am=${totalPayable}.00&cu=INR&tn=${encodeURIComponent(`AreneSHA Robo Slot ${orderData.booking_id}`)}`,
        customPaymentUrl: razorpayUrl
      });

      // Automatically open Razorpay payment page in a new window/tab after submitting form
      try {
        window.open(razorpayUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {
        console.warn('Popup blocked, available via button in modal', e);
      }

    } catch (err) {
      setPaymentError(err.message || 'Payment initiation failed.');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Manual payment reference confirmation
  const handleConfirmReferencePayment = async () => {
    if (!activeCheckout) return;
    setProcessingPayment(true);
    setPaymentError(null);

    try {
      const confirmRes = await fetch('/api/booking/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: activeCheckout.bookingId,
          payment_id: paymentRefInput.trim() || `MANUAL_${Date.now()}`
        })
      });

      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        throw new Error(confirmData.error || 'Payment verification failed.');
      }

      setConfirmedBooking(confirmData.booking);
      setActiveCheckout(null);
      fetchSlots(selectedDate);
      setSelectedSlotIds([]);
    } catch (err) {
      setPaymentError(err.message || 'Confirmation failed.');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Trigger standard Razorpay modal
  const openStandardRazorpayModal = () => {
    if (!activeCheckout) return;
    if (!window.Razorpay) {
      setPaymentError('Razorpay SDK could not be loaded. Please scan the QR code or use UPI.');
      return;
    }

    const options = {
      key: razorpayKeyId || 'rzp_test_placeholder',
      amount: activeCheckout.totalPayable * 100,
      currency: 'INR',
      name: 'AreneSHA AI Education Summit',
      description: `15-Min Robot Workshop Slot (${activeCheckout.slotsCount} slot${activeCheckout.slotsCount > 1 ? 's' : ''})`,
      order_id: activeCheckout.orderId,
      prefill: {
        name: activeCheckout.studentName,
        email: activeCheckout.studentEmail,
        contact: activeCheckout.studentPhone || ''
      },
      theme: { color: '#0F172A' },
      handler: async function (response) {
        setProcessingPayment(true);
        try {
          const verifyRes = await fetch('/api/booking/confirm-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              booking_id: activeCheckout.bookingId,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature
            })
          });

          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setConfirmedBooking(verifyData.booking);
            setActiveCheckout(null);
            fetchSlots(selectedDate);
            setSelectedSlotIds([]);
          } else {
            setPaymentError(verifyData.error || 'Payment verification failed.');
          }
        } catch (e) {
          setPaymentError('Network error confirming payment.');
        } finally {
          setProcessingPayment(false);
        }
      },
      modal: {
        ondismiss: function () {
          setPaymentCancelled(true);
        }
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setPaymentError(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err) {
      setPaymentError('Failed to open Razorpay modal.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* 1. TOP HEADER / APP BAR */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '14px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
              <img 
                src="https://arenesha.com/_next/image?url=%2Fassets%2Flogo-primary.png&w=384&q=75" 
                onError={(e) => { e.currentTarget.src = "/arenesha-logo.png"; }}
                alt="AreneSHA Logo" 
                style={{ height: '34px', width: 'auto', objectFit: 'contain' }} 
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', background: '#111827', color: '#B6FF1B', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                    SUMMIT 2026
                  </span>
                </div>
                <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  📍 Meenakshi Tech Park, Hyderabad
                </span>
              </div>
            </Link>
          </div>

          {/* Right Action: Admin Panel button (triggers login section modal when clicked) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/admin/dashboard')}
                  style={{
                    background: '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)'
                  }}
                >
                  <ShieldCheck size={15} color="#B6FF1B" />
                  <span>Admin Panel</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  style={{
                    background: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #CBD5E1',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                style={{
                  background: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)',
                  transition: 'all 0.2s'
                }}
              >
                <Lock size={14} color="#B6FF1B" />
                <span>Admin Panel</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN PAGE (/): EXACT SECOND IMAGE WITH 0% CHANGE */}
      {!isDirectBooking && (
        <section style={{ maxWidth: '1040px', margin: '36px auto 60px', padding: '0 16px' }}>
          <div 
            onClick={handleSignUpClick}
            style={{
              position: 'relative',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.15)',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 24px 50px rgba(0, 0, 0, 0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 20px 45px rgba(0, 0, 0, 0.15)'; }}
          >
            <img 
              src="/ai-education-summit-banner.png" 
              alt="AI Education Summit - Meet Robo" 
              style={{
                width: '100%',
                height: 'auto',
                display: 'block'
              }}
            />
            {/* Transparent clickable hotspot directly matching SIGN UP button in the image */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSignUpClick();
              }}
              title="Open 15-Minute Robot Slot Booking in New Tab"
              style={{
                position: 'absolute',
                left: '6.2%',
                bottom: '10.5%',
                width: '16.5%',
                height: '11.5%',
                opacity: 0,
                cursor: 'pointer',
                border: 'none',
                background: 'transparent'
              }}
            />
          </div>
        </section>
      )}

      {/* 3. WORKING SLOT BOOKING CODE (SHOWN ON /booking IN NEW TAB) */}
      {isDirectBooking && (
        <>
          <div style={{ maxWidth: '1200px', margin: '24px auto 16px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link 
              to="/" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#4F46E5', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}
            >
              <span>← Back to AI Education Summit</span>
            </Link>
          </div>

          <section 
            id="slot-booking-section"
            ref={slotSectionRef}
            style={{
              maxWidth: '1200px',
              margin: '0 auto 48px',
              padding: '0 16px',
              display: 'block'
            }}
          >

        {/* Slot Grid + Form Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 380px', gap: '24px', alignItems: 'start' }}>
          
          {/* Left: Date Picker & Slot Cards */}
          <div>
            {/* Date Picker Bar */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '16px 20px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={18} />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                    Event Date
                  </label>
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#0F172A',
                      outline: 'none',
                      marginTop: '2px'
                    }}
                  />
                </div>
              </div>

              <button 
                type="button"
                onClick={() => fetchSlots(selectedDate)}
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                Refresh Slots
              </button>
            </div>

            {/* Slots Notice */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="#4F46E5" />
                Available 15-Minute Sessions ({slots.length} Slots)
              </span>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                {slotsCount} Selected ({slotsCount > 0 ? `₹${totalPayable}.00` : 'None'})
              </span>
            </div>

            {/* 24 Slots Grid */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <RefreshCw size={28} className="spin" style={{ color: '#4F46E5', margin: '0 auto 12px' }} />
                <p style={{ color: '#64748B', fontWeight: 600, margin: 0 }}>Loading live slot inventory from server...</p>
              </div>
            ) : slots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <AlertCircle size={32} color="#D97706" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>No slots found for {selectedDate}</p>
                <button onClick={() => fetchSlots(selectedDate)} className="btn btn-secondary btn-sm">Retry</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {slots.map((slot) => {
                  const isSelected = selectedSlotIds.includes(slot.id);
                  const isFull = slot.is_full || slot.booked_count >= slot.max_capacity;
                  const available = Math.max(0, slot.max_capacity - slot.booked_count);

                  return (
                    <div
                      key={slot.id}
                      onClick={() => !isFull && toggleSlot(slot)}
                      style={{
                        background: isSelected 
                          ? '#0F172A' 
                          : isFull ? '#F8FAFC' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : '#0F172A',
                        border: isSelected 
                          ? '2px solid #4F46E5' 
                          : isFull ? '1px dashed #CBD5E1' : '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        cursor: isFull ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 4px 15px rgba(79, 70, 229, 0.25)' : 'none',
                        opacity: isFull ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>
                          {slot.start_time} - {slot.end_time}
                        </span>
                        {isSelected && (
                          <span style={{ background: '#4F46E5', color: '#FFFFFF', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={11} />
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                        <span style={{ color: isSelected ? '#94A3B8' : '#64748B' }}>
                          Capacity: {slot.booked_count}/{slot.max_capacity}
                        </span>
                        <span style={{
                          fontWeight: 800,
                          color: isFull ? '#EF4444' : isSelected ? '#34D399' : '#059669'
                        }}>
                          {isFull ? 'FULL' : `${available} Left`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Checkout Form & Pricing */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '20px',
            padding: '24px 22px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
            position: 'sticky',
            top: '84px'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color="#4F46E5" />
              Registration & Payment
            </h3>

            {paymentError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '10px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} />
                <span>{paymentError}</span>
              </div>
            )}
            {/* Selected Slot Confirmation Banner */}
            <div style={{
              background: '#EEF2FF',
              border: '1px solid #C7D2FE',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#4F46E5" />
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#4338CA', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>
                    Active Time Slot
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1E1B4B' }}>
                    {selectedSlotsList.length > 0 ? selectedSlotsList.map(s => `${s.start_time} - ${s.end_time}`).join(', ') : 'Auto-selecting slot...'}
                  </span>
                </div>
              </div>
              <span style={{ fontSize: '0.74rem', background: '#4F46E5', color: '#FFFFFF', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                {slotsCount || 1} Slot{slotsCount > 1 ? 's' : ''}
              </span>
            </div>

            <form onSubmit={handleInitiatePayment}>
              {/* Student Name */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                    style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px 8px 32px', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Email Address *
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
                  <input
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="rahul@example.com"
                    required
                    style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px 8px 32px', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Mobile Phone */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Mobile Number
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
                  <input
                    type="tel"
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px 8px 32px', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* College / Organization */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  College / Institute
                </label>
                <div style={{ position: 'relative' }}>
                  <Building size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    placeholder="e.g. IIT Hyderabad / BITS"
                    style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px 8px 32px', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Order Cost Breakdown Box */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#475569', marginBottom: '6px' }}>
                  <span>Selected Slots ({slotsCount}):</span>
                  <span style={{ fontWeight: 700 }}>₹{baseAmount}.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#475569', marginBottom: '6px' }}>
                  <span>CGST (9%):</span>
                  <span>₹{cgstAmount}.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#475569', marginBottom: '6px' }}>
                  <span>SGST (9%):</span>
                  <span>₹{sgstAmount}.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#0369A1', marginBottom: '8px' }}>
                  <span>Total Govt. GST (18%):</span>
                  <span style={{ fontWeight: 700 }}>₹{totalGst}.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #CBD5E1', paddingTop: '8px', fontWeight: 900 }}>
                  <span style={{ fontSize: '0.92rem', color: '#0F172A' }}>Total Payable:</span>
                  <span style={{ fontSize: '1.25rem', color: '#059669' }}>₹{totalPayable}.00</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                type="submit"
                disabled={processingPayment || slotsCount === 0}
                style={{
                  width: '100%',
                  background: slotsCount === 0 ? '#94A3B8' : '#0F172A',
                  color: '#B6FF1B',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: slotsCount === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(15, 23, 42, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                {processingPayment ? 'Processing...' : (
                  <>
                    <span>Proceed to Pay ₹{totalPayable}.00</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

        </div>
      </section>
      </>
      )}

      {/* 4. RAZORPAY / UPI CHECKOUT MODAL */}
      {activeCheckout && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '480px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveCheckout(null)}
              style={{ position: 'absolute', top: '18px', right: '18px', background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <QrCode size={26} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 4px 0' }}>Scan & Pay ₹{activeCheckout.totalPayable}.00</h3>
              <p style={{ color: '#64748B', fontSize: '0.84rem', margin: 0 }}>
                Includes ₹{activeCheckout.baseAmount} Base Fee + ₹{activeCheckout.totalGst} GST (18%)
              </p>
            </div>

            {/* QR Code Container */}
            <div style={{ textAlign: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '18px' }}>
              <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '12px', display: 'inline-block', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <QRCodeSVG value={activeCheckout.upiIntentUrl} size={180} level="H" />
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '10px', marginBottom: 0 }}>
                Scan using Google Pay, PhonePe, Paytm, or any UPI App
              </p>
            </div>

            {/* Pay Via Razorpay Direct Link Button */}
            <div style={{ marginBottom: '16px' }}>
              <a
                href={activeCheckout.customPaymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  padding: '13px 18px',
                  borderRadius: '12px',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                  transition: 'all 0.2s'
                }}
              >
                <span>Pay ₹{activeCheckout.totalPayable}.00 on Razorpay</span>
                <ExternalLink size={16} />
              </a>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: '8px',
                padding: '6px 10px',
                marginTop: '8px',
                fontSize: '0.74rem'
              }}>
                <span className="mono" style={{ color: '#0369A1', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                  https://razorpay.me/@edifynuvaaitechnologiesprivat
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: copiedLink ? '#16A34A' : '#0284C7',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Reference Input for Confirmation */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                UPI / Payment Reference Number (UTR / Ref ID)
              </label>
              <input
                type="text"
                value={paymentRefInput}
                onChange={(e) => setPaymentRefInput(e.target.value)}
                placeholder="e.g. 427819283719"
                style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px', fontSize: '0.86rem', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={handleConfirmReferencePayment}
              disabled={processingPayment}
              style={{
                width: '100%',
                background: '#16A34A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {processingPayment ? 'Verifying...' : 'Confirm Payment & Get Gate Pass'}
            </button>
          </div>
        </div>
      )}

      {/* 5. CONFIRMED GATE PASS RECEIPT MODAL */}
      {confirmedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '520px',
            padding: '32px 28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            position: 'relative'
          }}>
            <button
              onClick={() => setConfirmedBooking(null)}
              style={{ position: 'absolute', top: '18px', right: '18px', background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CheckCircle2 size={32} />
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0' }}>
                Robot Workshop Slot Confirmed!
              </h2>
              <p style={{ color: '#64748B', fontSize: '0.86rem', margin: 0 }}>
                Your Main Gate Entry PIN and Pass Receipt have been generated.
              </p>
            </div>

            {/* Gate Pass Card */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '18px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 800 }}>Gate Entry PIN</span>
                  <div style={{ background: '#0F172A', color: '#B6FF1B', padding: '4px 12px', borderRadius: '6px', fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.12em', marginTop: '2px', display: 'inline-block' }}>
                    {confirmedBooking.entry_pin || '389201'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 800 }}>Booking ID</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#4F46E5', marginTop: '2px' }}>
                    {confirmedBooking.id}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Student Name:</span>
                  <strong>{confirmedBooking.student_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Total Paid (incl. 18% GST):</span>
                  <strong style={{ color: '#059669' }}>₹{confirmedBooking.total_amount}.00</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Date & Venue:</span>
                  <span>{confirmedBooking.slot_date} • Meenakshi Tech Park</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setConfirmedBooking(null);
                window.print();
              }}
              style={{
                width: '100%',
                background: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Download size={16} />
              <span>Print / Download Gate Pass Receipt</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. ADMIN & GUARD LOGIN MODAL */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        targetRoute="/admin/dashboard"
      />

    </div>
  );
}
