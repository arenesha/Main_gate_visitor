import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, ShieldAlert, Camera, KeyRound, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, Car, User, Building2, Delete,
  Sparkles, QrCode, Search, Check, Copy, Clock, Shield, LogIn, Lock,
  ChevronRight, ArrowLeft, AlertCircle, Info, Calendar, MapPin
} from 'lucide-react';
import QRScannerModal from '../components/QRScannerModal';
import { useAuth } from '../context/AuthContext';

export default function GateVerification() {
  const { user, authFetch, login, loading: authLoading } = useAuth();

  // Mode: 'QR' or 'OTP'
  const [activeMode, setActiveMode] = useState('QR');

  // Guard Gate Workflow States:
  // 'IDLE' -> 'SCANNING' -> 'VISUAL_VERIFY' -> 'ENTRY_ALLOWED' -> 'ENTRY_DENIED' -> 'INVALID_PASS'
  const [gateState, setGateState] = useState('IDLE');

  // Scanned / Lookup Result Data from real DB
  const [verifiedPass, setVerifiedPass] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);

  // OTP Fallback state
  const [otpCode, setOtpCode] = useState('');

  // Camera Modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // Deny modal / reason
  const [denyModalOpen, setDenyModalOpen] = useState(false);
  const [selectedDenyReason, setSelectedDenyReason] = useState('Visitor details do not match');
  const [denyCustomNote, setDenyCustomNote] = useState('');

  // Expected Visitors & Audit history
  const [expectedVisitors, setExpectedVisitors] = useState([]);
  const [searchGuest, setSearchGuest] = useState('');

  // Audio Feedback
  const playAudio = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'denied') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) { }
  };

  // Load Expected Visitors List
  const loadCheckpointData = async () => {
    try {
      const res = await authFetch('/api/invitations?status=ACTIVE');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.invitations) {
          setExpectedVisitors(data.invitations);
        }
      }
    } catch (e) {
      console.warn('Could not load active queue', e);
    }
  };

  useEffect(() => {
    loadCheckpointData();
  }, [user]);

  // Reset to initial terminal ready state
  const resetToTerminal = () => {
    setGateState('IDLE');
    setVerifiedPass(null);
    setVerificationResult(null);
    setErrorDetails(null);
    setOtpCode('');
    setDenyModalOpen(false);
    setSelectedDenyReason('Visitor details do not match');
    setDenyCustomNote('');
    loadCheckpointData();
  };

  // 1. STEP 1: Scan QR or Validate OTP -> Backend Lookup
  const handleValidatePass = async (payload, method = 'QR_SCAN') => {
    setLoading(true);
    setErrorDetails(null);

    try {
      const requestBody = method === 'QR_SCAN'
        ? { qr_payload: payload }
        : { otp_code: payload };

      const res = await authFetch('/api/gate/scan-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();

      if (res.ok && data.success && data.valid && data.invitation) {
        // VALID PASS -> Display Visitor Details for Guard Visual Inspection
        setVerifiedPass({
          ...data.invitation,
          verification_method: method
        });
        setGateState('VISUAL_VERIFY');
      } else {
        // INVALID PASS / EXPIRED / REVOKED / ALREADY CHECKED IN
        setErrorDetails({
          message: data.message || 'INVALID PASS',
          reason: data.reason || 'This invitation pass is not recognized or invalid.',
          invitation: data.invitation || null
        });
        setGateState('INVALID_PASS');
        playAudio('denied');
      }
    } catch (err) {
      setErrorDetails({
        message: 'COMMUNICATION ERROR',
        reason: 'Failed to connect to security database server. Please verify network.',
        invitation: null
      });
      setGateState('INVALID_PASS');
      playAudio('denied');
    } finally {
      setLoading(false);
    }
  };

  // QR Scan Success Handler
  const handleQRScanSuccess = (scannedPayload) => {
    setScannerOpen(false);
    handleValidatePass(scannedPayload, 'QR_SCAN');
  };

  // OTP Form Submission Handler
  const handleOTPSubmit = (e) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.length !== 6) return;
    handleValidatePass(otpCode.trim(), 'OTP_FALLBACK');
  };

  // 2. STEP 2: Guard Visual Verification -> ALLOW ENTRY
  const handleAllowEntry = async () => {
    if (!verifiedPass || processingAction) return;

    setProcessingAction(true);

    try {
      const res = await authFetch('/api/gate/allow-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_id: verifiedPass.id,
          verification_method: verifiedPass.verification_method || 'QR_SCAN'
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.authorized) {
        setVerificationResult(data);
        setGateState('ENTRY_ALLOWED');
        playAudio('success');
      } else {
        // Duplicate check-in / race condition rejection
        setErrorDetails({
          message: data.message || 'ENTRY NOT AUTHORIZED',
          reason: data.reason || 'Could not authorize entry record.',
          invitation: verifiedPass
        });
        setGateState('INVALID_PASS');
        playAudio('denied');
      }
    } catch (err) {
      setErrorDetails({
        message: 'GATE RELAY FAILURE',
        reason: 'Network error occurred while saving entry record to database.',
        invitation: verifiedPass
      });
      setGateState('INVALID_PASS');
      playAudio('denied');
    } finally {
      setProcessingAction(false);
    }
  };

  // 3. STEP 3: Guard Visual Verification -> DENY ENTRY
  const handleDenyEntryConfirm = async () => {
    if (!verifiedPass || processingAction) return;

    setProcessingAction(true);
    setDenyModalOpen(false);

    try {
      const res = await authFetch('/api/gate/deny-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_id: verifiedPass.id,
          verification_method: verifiedPass.verification_method || 'QR_SCAN',
          reason: selectedDenyReason,
          notes: denyCustomNote.trim() || undefined
        })
      });

      const data = await res.json();
      setVerificationResult({
        ...data,
        reason: selectedDenyReason,
        invitation: verifiedPass
      });
      setGateState('ENTRY_DENIED');
      playAudio('denied');
    } catch (err) {
      setErrorDetails({
        message: 'ERROR RECORDING DENIAL',
        reason: 'Network error occurred while saving denial record.',
        invitation: verifiedPass
      });
      setGateState('INVALID_PASS');
      playAudio('denied');
    } finally {
      setProcessingAction(false);
    }
  };

  // Keypad Handlers for OTP input
  const handleKeypadPress = (num) => {
    if (otpCode.length < 6) {
      setOtpCode(prev => prev + num);
    }
  };

  const filteredGuests = expectedVisitors.filter(v =>
    v.visitor_name?.toLowerCase().includes(searchGuest.toLowerCase()) ||
    v.entry_code?.includes(searchGuest) ||
    v.host_name?.toLowerCase().includes(searchGuest.toLowerCase()) ||
    v.id?.toLowerCase().includes(searchGuest.toLowerCase())
  );

  // STRICT ACCESS CONTROL: Only authorized Guards (arenesha20@gmail.com) and Admins can access the Guard Portal
  if (!authLoading && (!user || (user.role !== 'GUARD' && user.role !== 'ADMIN'))) {
    return (
      <div style={{ maxWidth: '580px', margin: '60px auto', textAlign: 'center', padding: '36px 28px' }} className="glass-card">
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', border: '1px solid #FECACA' }}>
          <ShieldAlert size={36} />
        </div>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px' }}>
          Guard Portal Access Denied
        </h2>
        <p style={{ color: '#64748B', fontSize: '0.92rem', lineHeight: 1.55, margin: '0 0 24px' }}>
          This security terminal is restricted to authorized AreneSHA Guards (<code>arenesha20@gmail.com</code>) and System Administrators. Visitors and unauthorized users cannot access the Guard Gate.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-secondary" style={{ fontWeight: 700 }}>
            Return to Overview
          </Link>
          <button
            onClick={() => login('arenesha20@gmail.com', 'Guard@AreneSHA2026')}
            className="btn btn-primary"
            style={{ background: '#1E3E47', fontWeight: 700 }}
          >
            Authorize as Guard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

      {/* Top Guard Gate Banner & Auth Status */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '20px 24px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: '#1E3E47',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(30, 62, 71, 0.2)'
          }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', background: '#ECFDF5', color: '#065F46', padding: '2px 8px', borderRadius: '6px', border: '1px solid #A7F3D0' }}>
                ARENE SHA • GUARD GATE
              </span>
              <span style={{ color: '#94A3B8' }}>•</span>
              <span style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }}></span>
                Server Verified
              </span>
            </div>
            <h1 style={{ margin: '3px 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Main Gate Security Terminal
            </h1>
          </div>
        </div>

        {/* Authorized Guard Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                {user ? user.name : 'AreneSHA Guard'}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                {user ? user.email : 'arenesha20@gmail.com'} • B-Block, Meenakshi Tech Park
              </span>
            </div>
          </div>

          <button onClick={loadCheckpointData} className="btn btn-secondary btn-sm" title="Refresh Active Queue">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Main Gate Terminal Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 1fr)', gap: '24px', alignItems: 'start' }}>

        {/* LEFT COLUMN: ACTIVE WORKFLOW CONTAINER */}
        <div>

          {/* ======================================================== */}
          {/* STATE 1: INITIAL READY TERMINAL (SCAN QR / USE OTP) */}
          {/* ======================================================== */}
          {gateState === 'IDLE' && (
            <div className="glass-card" style={{ padding: '28px', background: '#FFFFFF' }}>

              {/* Mode Switcher */}
              <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '6px', borderRadius: '12px', marginBottom: '24px' }}>
                <button
                  onClick={() => setActiveMode('QR')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    border: 'none',
                    background: activeMode === 'QR' ? '#FFFFFF' : 'transparent',
                    color: activeMode === 'QR' ? '#0F172A' : '#64748B',
                    boxShadow: activeMode === 'QR' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Camera size={18} color={activeMode === 'QR' ? '#059669' : '#64748B'} />
                  <span>Scan QR Code</span>
                </button>

                <button
                  onClick={() => setActiveMode('OTP')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    border: 'none',
                    background: activeMode === 'OTP' ? '#FFFFFF' : 'transparent',
                    color: activeMode === 'OTP' ? '#0F172A' : '#64748B',
                    boxShadow: activeMode === 'OTP' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <KeyRound size={18} color={activeMode === 'OTP' ? '#1E3E47' : '#64748B'} />
                  <span>Use OTP Fallback</span>
                </button>
              </div>

              {/* TAB 1: QR SCANNER BUTTON */}
              {activeMode === 'QR' && (
                <div style={{ textAlign: 'center', padding: '16px 8px 8px' }}>
                  <div style={{
                    width: '130px',
                    height: '130px',
                    borderRadius: '28px',
                    background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                    border: '2px dashed #10B981',
                    margin: '0 auto 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#059669',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)'
                  }}>
                    <QrCode size={64} />
                  </div>

                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>
                    Optical QR Code Scanner
                  </h2>
                  <p style={{ color: '#64748B', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto 28px', lineHeight: 1.5 }}>
                    Scan the visitor's smartphone pass QR or printed badge to validate credentials securely with the database.
                  </p>

                  <button
                    onClick={() => setScannerOpen(true)}
                    disabled={loading}
                    className="btn btn-primary btn-lg"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      gap: '12px',
                      padding: '16px 24px',
                      fontSize: '1.05rem',
                      borderRadius: '14px',
                      boxShadow: '0 8px 20px rgba(5, 150, 105, 0.25)'
                    }}
                  >
                    <Camera size={22} />
                    <span>{loading ? 'Validating Pass...' : 'SCAN QR CODE'}</span>
                  </button>
                </div>
              )}

              {/* TAB 2: 6-DIGIT OTP TYPED INPUT */}
              {activeMode === 'OTP' && (
                <form onSubmit={handleOTPSubmit}>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                      6-Digit Entry PIN / OTP Verification
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748B' }}>
                      Type the 6-digit invitation entry code provided by the visitor
                    </p>
                  </div>

                  {/* Direct Typed Input */}
                  <div style={{ maxWidth: '340px', margin: '0 auto 24px' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoFocus
                        placeholder="000000"
                        value={otpCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setOtpCode(val);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'center',
                          fontSize: '2rem',
                          fontWeight: 800,
                          letterSpacing: '0.22em',
                          padding: '12px 16px',
                          borderRadius: '14px',
                          border: otpCode.length === 6 ? '2px solid #059669' : '2px solid #CBD5E1',
                          background: otpCode.length === 6 ? '#F0FDF4' : '#FFFFFF',
                          color: '#0F172A',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          fontFamily: 'var(--font-mono)',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                      />
                      {otpCode && (
                        <button
                          type="button"
                          onClick={() => setOtpCode('')}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: '#F1F5F9',
                            border: 'none',
                            borderRadius: '50%',
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748B'
                          }}
                          title="Clear input"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '0 4px', fontSize: '0.78rem', color: '#64748B' }}>
                      <span>Type directly with your keyboard or paste</span>
                      <span style={{ fontWeight: 700, color: otpCode.length === 6 ? '#059669' : '#94A3B8' }}>
                        {otpCode.length} / 6 digits
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%', background: '#1E3E47', gap: '10px', padding: '14px', fontSize: '0.96rem', fontWeight: 800 }}
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={20} />}
                    <span>{loading ? 'Validating PIN...' : 'Verify Entry PIN'}</span>
                  </button>
                </form>
              )}

            </div>
          )}

          {/* ======================================================== */}
          {/* STATE 2: VALID PASS - GUARD VISUAL INSPECTION */}
          {/* ======================================================== */}
          {gateState === 'VISUAL_VERIFY' && verifiedPass && (
            <div className="glass-card" style={{ padding: '0', background: '#FFFFFF', overflow: 'hidden', border: '2px solid #059669', boxShadow: '0 12px 36px rgba(5, 150, 105, 0.15)' }}>

              {/* Card Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#FFFFFF',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={26} color="#FFFFFF" />
                  <div>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, opacity: 0.9 }}>
                      DATABASE VERIFIED
                    </span>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF' }}>
                      ✓ VALID PASS
                    </h2>
                  </div>
                </div>

                <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
                  ID: {verifiedPass.id}
                </span>
              </div>

              {/* Guard Visual Check Reminder Notice */}
              <div style={{ background: '#FFFBEB', borderBottom: '1px solid #FEF3C7', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} color="#D97706" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.84rem', color: '#92400E', fontWeight: 700 }}>
                  VISUAL VERIFICATION REQUIRED: Please visually compare the visitor with the details below before allowing entry.
                </span>
              </div>

              {/* Visitor Details Display */}
              <div style={{ padding: '24px' }}>

                {/* Visitor Profile Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '18px',
                    background: 'linear-gradient(135deg, #1E3E47 0%, #0F172A 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    boxShadow: '0 4px 14px rgba(30, 62, 71, 0.25)',
                    flexShrink: 0
                  }}>
                    {verifiedPass.visitor_name ? verifiedPass.visitor_name.charAt(0).toUpperCase() : 'V'}
                  </div>

                  <div>
                    <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Visitor Full Name</span>
                    <h3 style={{ margin: '2px 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#0F172A' }}>
                      {verifiedPass.visitor_name}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                      {verifiedPass.visitor_phone || 'No phone'} {verifiedPass.visitor_email ? `• ${verifiedPass.visitor_email}` : ''}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>

                  <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Host / Inviter</span>
                    <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                      {verifiedPass.host_name}
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Purpose</span>
                    <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                      {verifiedPass.purpose}
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Valid From</span>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {new Date(verifiedPass.valid_from).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Valid Until</span>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {new Date(verifiedPass.valid_until).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 2', background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Authorized Location</span>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {verifiedPass.location || verifiedPass.host_department}
                    </div>
                  </div>

                  {verifiedPass.vehicle_number && (
                    <div style={{ gridColumn: 'span 2', background: '#FEF3C7', padding: '12px 16px', borderRadius: '12px', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Car size={20} color="#B45309" />
                      <div>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#92400E', fontWeight: 800 }}>Vehicle Plate Number</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#78350F', fontFamily: 'var(--font-mono)' }}>
                          🚗 {verifiedPass.vehicle_number}
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* GUARD ACTIONS: ALLOW ENTRY OR DENY ENTRY */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
                  <button
                    onClick={handleAllowEntry}
                    disabled={processingAction}
                    className="btn btn-primary btn-lg"
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      padding: '16px',
                      borderRadius: '14px',
                      boxShadow: '0 6px 18px rgba(5, 150, 105, 0.3)',
                      gap: '10px'
                    }}
                  >
                    {processingAction ? <RefreshCw size={20} className="animate-spin" /> : <CheckCircle2 size={22} />}
                    <span>{processingAction ? 'Recording Entry...' : '[ ALLOW ENTRY ]'}</span>
                  </button>

                  <button
                    onClick={() => setDenyModalOpen(true)}
                    disabled={processingAction}
                    className="btn btn-secondary btn-lg"
                    style={{
                      background: '#FEF2F2',
                      borderColor: '#FECACA',
                      color: '#DC2626',
                      fontSize: '1rem',
                      fontWeight: 800,
                      padding: '16px',
                      borderRadius: '14px',
                      gap: '8px'
                    }}
                  >
                    <XCircle size={20} />
                    <span>[ DENY ENTRY ]</span>
                  </button>
                </div>

                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    onClick={resetToTerminal}
                    style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel / Scan Different Pass
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STATE 3: ENTRY ALLOWED (FINAL RECORDED SUCCESS) */}
          {/* ======================================================== */}
          {gateState === 'ENTRY_ALLOWED' && verificationResult && (
            <div className="glass-card" style={{
              padding: '32px 28px',
              background: '#FFFFFF',
              border: '2px solid #059669',
              borderRadius: '20px',
              textAlign: 'center',
              boxShadow: '0 16px 40px rgba(5, 150, 105, 0.2)'
            }}>

              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 16px rgba(5, 150, 105, 0.2)'
              }}>
                <CheckCircle2 size={48} />
              </div>

              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#059669' }}>
                GATE ACCESS GRANTED
              </span>

              <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0F172A', margin: '4px 0 16px', letterSpacing: '-0.02em' }}>
                ✓ ENTRY ALLOWED
              </h2>

              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '20px',
                maxWidth: '440px',
                margin: '0 auto 24px',
                textAlign: 'left'
              }}>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '0.84rem' }}>Visitor:</span>
                  <strong style={{ color: '#0F172A', fontSize: '0.94rem' }}>
                    {verificationResult.invitation?.visitor_name || verifiedPass?.visitor_name}
                  </strong>
                </div>

                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '0.84rem' }}>Pass ID:</span>
                  <strong className="mono" style={{ color: '#0F172A', fontSize: '0.94rem' }}>
                    {verificationResult.invitation?.id || verifiedPass?.id}
                  </strong>
                </div>

                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '0.84rem' }}>Entry Recorded:</span>
                  <strong style={{ color: '#059669', fontSize: '0.88rem' }}>
                    {new Date(verificationResult.server_timestamp || Date.now()).toLocaleString()}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B', fontSize: '0.84rem' }}>Verified By:</span>
                  <strong style={{ color: '#0F172A', fontSize: '0.84rem' }}>
                    {user?.name || 'AreneSHA Guard'}
                  </strong>
                </div>
              </div>

              <button
                onClick={resetToTerminal}
                className="btn btn-primary btn-lg"
                style={{
                  width: '100%',
                  maxWidth: '320px',
                  margin: '0 auto',
                  background: '#0F172A',
                  fontSize: '1rem',
                  fontWeight: 800,
                  padding: '14px 28px',
                  borderRadius: '12px'
                }}
              >
                [ DONE ] Next Visitor
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* STATE 4: ENTRY DENIED */}
          {/* ======================================================== */}
          {gateState === 'ENTRY_DENIED' && verificationResult && (
            <div className="glass-card" style={{
              padding: '32px 28px',
              background: '#FFFFFF',
              border: '2px solid #DC2626',
              borderRadius: '20px',
              textAlign: 'center',
              boxShadow: '0 16px 40px rgba(220, 38, 38, 0.15)'
            }}>

              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <XCircle size={48} />
              </div>

              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#DC2626' }}>
                CHECKPOINT REJECTION RECORDED
              </span>

              <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0F172A', margin: '4px 0 16px' }}>
                ✕ ENTRY DENIED
              </h2>

              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '16px',
                padding: '18px 20px',
                maxWidth: '440px',
                margin: '0 auto 24px',
                textAlign: 'left'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#991B1B', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Reason:</span>
                  <div style={{ color: '#B91C1C', fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>
                    {verificationResult.reason}
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#7F1D1D' }}>
                  Visitor: <strong>{verifiedPass?.visitor_name}</strong> • Pass ID: <strong>{verifiedPass?.id}</strong>
                </div>
              </div>

              <button
                onClick={resetToTerminal}
                className="btn btn-secondary btn-lg"
                style={{
                  width: '100%',
                  maxWidth: '320px',
                  margin: '0 auto',
                  fontWeight: 800,
                  padding: '14px 28px',
                  borderRadius: '12px'
                }}
              >
                [ DONE ] Next Visitor
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* STATE 5: INVALID PASS / REJECTION FROM SCAN */}
          {/* ======================================================== */}
          {gateState === 'INVALID_PASS' && errorDetails && (
            <div className="glass-card" style={{
              padding: '32px 28px',
              background: '#FFFFFF',
              border: '2px solid #DC2626',
              borderRadius: '20px',
              textAlign: 'center',
              boxShadow: '0 16px 40px rgba(220, 38, 38, 0.15)'
            }}>

              <div style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <AlertTriangle size={42} />
              </div>

              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626', margin: '0 0 10px' }}>
                ✕ {errorDetails.message || 'INVALID PASS'}
              </h2>

              <p style={{ fontSize: '0.98rem', color: '#4B5563', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.5 }}>
                {errorDetails.reason}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setGateState('IDLE');
                    setActiveMode('QR');
                    setScannerOpen(true);
                  }}
                  className="btn btn-primary"
                  style={{ background: '#059669', padding: '12px 24px', fontWeight: 800 }}
                >
                  <Camera size={18} />
                  <span>[ SCAN AGAIN ]</span>
                </button>

                <button
                  onClick={() => {
                    setGateState('IDLE');
                    setActiveMode('OTP');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '12px 24px', fontWeight: 800 }}
                >
                  <KeyRound size={18} />
                  <span>[ USE OTP ]</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: LIVE QUEUE & QUICK VERIFICATION */}
        <div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', background: '#FFFFFF' }}>

            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#D97706" />
                <h3 style={{ fontSize: '0.96rem', margin: 0, fontWeight: 800, color: '#0F172A' }}>
                  Expected Active Visitors
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: '999px', fontWeight: 800, border: '1px solid #FDE68A' }}>
                {expectedVisitors.length} Active
              </span>
            </div>

            {/* Filter Search */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Filter by name, OTP, or Pass ID..."
                  value={searchGuest}
                  onChange={(e) => setSearchGuest(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    fontSize: '0.82rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Queue List */}
            <div style={{ maxHeight: '450px', overflowY: 'auto', padding: '10px' }}>
              {filteredGuests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94A3B8', fontSize: '0.85rem' }}>
                  No active expected visitors in queue.
                </div>
              ) : (
                filteredGuests.map(guest => (
                  <div
                    key={guest.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.9rem' }}>
                          {guest.visitor_name}
                        </span>
                        <span
                          className="mono"
                          style={{
                            background: '#FFFBEB',
                            color: '#B45309',
                            border: '1px solid #FDE68A',
                            padding: '1px 7px',
                            borderRadius: '5px',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            letterSpacing: '0.04em'
                          }}
                        >
                          {guest.entry_code}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
                        Host: <strong>{guest.host_name}</strong> • {guest.purpose}
                      </div>

                      {guest.vehicle_number && (
                        <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 700, marginTop: '2px' }}>
                          🚗 {guest.vehicle_number}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleValidatePass(guest.entry_code, 'OTP_FALLBACK')}
                      disabled={loading}
                      className="btn btn-secondary btn-sm"
                      style={{
                        background: '#F0FDF4',
                        borderColor: '#BBF7D0',
                        color: '#166534',
                        fontWeight: 800,
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        flexShrink: 0
                      }}
                      title="Load Pass Details for Visual Inspection"
                    >
                      <Check size={14} />
                      <span>Verify</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Checkpoint Footer */}
            <div style={{ padding: '12px 18px', background: '#FAFAFA', borderTop: '1px solid #E2E8F0', fontSize: '0.76rem', color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
              <span>D1 Cloudflare Sync: Active</span>
              <span>Barrier: Auto-Relay Online</span>
            </div>

          </div>
        </div>

      </div>

      {/* Optical QR Scanner Modal */}
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleQRScanSuccess}
        onUseOtpFallback={() => {
          setScannerOpen(false);
          setActiveMode('OTP');
        }}
      />

      {/* DENY REASON MODAL */}
      {denyModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', background: '#FFFFFF', borderRadius: '18px', overflow: 'hidden', padding: '24px' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>Select Denial Reason</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Audit record will be logged with this reason</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {[
                'Visitor details do not match',
                'Invalid pass',
                'Expired pass',
                'Revoked pass',
                'Wrong location',
                'Already checked in',
                'Other'
              ].map((reason) => (
                <label
                  key={reason}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: selectedDenyReason === reason ? '2px solid #DC2626' : '1px solid #E2E8F0',
                    background: selectedDenyReason === reason ? '#FEF2F2' : '#FFFFFF',
                    color: selectedDenyReason === reason ? '#991B1B' : '#0F172A',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="denyReason"
                    value={reason}
                    checked={selectedDenyReason === reason}
                    onChange={(e) => setSelectedDenyReason(e.target.value)}
                    style={{ accentColor: '#DC2626' }}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {selectedDenyReason === 'Other' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Custom Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Specify reason..."
                  value={denyCustomNote}
                  onChange={(e) => setDenyCustomNote(e.target.value)}
                  className="form-input"
                  style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDenyModalOpen(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>

              <button
                onClick={handleDenyEntryConfirm}
                disabled={processingAction}
                className="btn btn-primary btn-sm"
                style={{ background: '#DC2626', borderColor: '#B91C1C' }}
              >
                {processingAction ? 'Recording...' : 'Confirm Deny Entry'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
