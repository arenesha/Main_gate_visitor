import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Printer, Calendar, Clock, MapPin, User, Car, Building, AlertCircle, Share2, Check, ArrowLeft, MessageSquare, Smartphone, Mail, ExternalLink } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function PublicInvitationPass() {
  const { id } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchPass() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/invitations/${id}/public`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Invitation pass not found or invalid.');
        }
        setInvitation(data.invitation);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPass();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const getAddress = () => {
    if (!invitation) return '';
    return invitation.host_department || 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032';
  };

  const mapsUrl = 'https://maps.google.com/?q=Meenakshi+Tech+Park,+Gachibowli,+Hyderabad,+Telangana+500032';

  const formatWindowDate = (dateStr) => {
    if (!dateStr) return '';
    let s = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      s = `${s}+05:30`;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  };

  const getFormattedMessage = () => {
    if (!invitation) return '';
    return `${invitation.host_name} has invited you using arenesha.com from ${formatWindowDate(invitation.valid_from)} to ${formatWindowDate(invitation.valid_until)}. Please use ${invitation.entry_code} as the entry code at the gate. Google coordinates: ${mapsUrl}`;
  };

  const sendSMS = () => {
    if (!invitation) return;
    const cleanPhone = invitation.visitor_phone ? invitation.visitor_phone.replace(/\D/g, '') : '';
    const msg = encodeURIComponent(getFormattedMessage());
    const smsUrl = cleanPhone ? `sms:${cleanPhone}?body=${msg}` : `sms:?body=${msg}`;
    window.location.href = smsUrl;
  };

  const sendEmail = () => {
    if (!invitation) return;
    const email = invitation.visitor_email || '';
    const subject = encodeURIComponent(`${invitation.host_name} has invited you to AreneSHA (Entry OTP: ${invitation.entry_code})`);
    const body = encodeURIComponent(getFormattedMessage() + `\n\nDigital Pass Link: ${window.location.href}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${invitation?.host_name} has invited you`,
        text: getFormattedMessage(),
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(getFormattedMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Retrieving Security Pass...</div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Verifying credential on Cloudflare Edge</p>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div style={{ maxWidth: '480px', margin: '60px auto', textAlign: 'center' }}>
        <div className="glass-card" style={{ border: '1px solid var(--danger-border)', background: 'var(--danger-bg)' }}>
          <AlertCircle size={48} color="#EF4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.4rem', color: '#F87171', marginBottom: '8px' }}>Invalid or Expired Pass</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px' }}>
            {error || 'This visitor invitation could not be found or has been permanently removed.'}
          </p>
          <Link to="/" className="btn btn-secondary">
            <ArrowLeft size={16} /> Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pass-container" style={{ maxWidth: '440px' }}>
      {/* Top action buttons (hidden when printed) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <Link to="/" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Back
        </Link>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={sendSMS} className="btn btn-secondary btn-sm" title="Send via SMS">
            <Smartphone size={14} color="#38BDF8" />
            <span>SMS</span>
          </button>
          <button onClick={sendEmail} className="btn btn-secondary btn-sm" title="Send via Email">
            <Mail size={14} color="#F472B6" />
            <span>Email</span>
          </button>
          <button onClick={handleShare} className="btn btn-secondary btn-sm" title="Share Mobile Pass">
            {copied ? <Check size={14} color="#34D399" /> : <Share2 size={14} />}
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>
          <button onClick={handlePrint} className="btn btn-primary btn-sm" title="Print Pass / PDF">
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* MYGATE / ARENESHA STYLE PASS CARD */}
      <div className="pass-card" style={{ background: '#FDFBF7', color: '#1E1E1E', border: '1px solid #EAE6DF', borderRadius: '24px', boxShadow: '0 12px 36px rgba(0,0,0,0.12)' }}>
        
        {/* Pass Header */}
        <div style={{ padding: '28px 24px 12px 24px', textAlign: 'center' }}>
          <img 
            src="https://arenesha.com/_next/image?url=%2Fassets%2Flogo-primary.png&w=384&q=75" 
            alt="AreneSHA" 
            style={{ height: '38px', maxWidth: '160px', objectFit: 'contain', margin: '0 auto 12px auto', display: 'block' }} 
          />
          <h2 style={{ fontSize: '1.6rem', color: '#1E1E1E', margin: '0 0 6px 0', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {invitation.host_name} has invited you.
          </h2>
          <p style={{ color: '#736B5E', fontSize: '0.95rem', margin: '0 0 12px 0', fontWeight: 500 }}>
            Show this QR code or OTP to the guard at gate
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <StatusBadge status={invitation.status} />
          </div>
        </div>

        {/* Pass Body */}
        <div style={{ padding: '0 24px 28px 24px' }}>
          {/* QR Code Section */}
          <div style={{ textAlign: 'center', margin: '14px 0 12px 0' }}>
            <div className="qr-box" style={{ background: '#FFFFFF', padding: '14px', borderRadius: '18px', border: '1px solid #EAE6DF', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <QRCodeSVG 
                value={invitation.qr_token || window.location.href} 
                size={180} 
                level="H" 
                includeMargin={true}
              />
            </div>
          </div>

          {/* OR Divider */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px 0', gap: '12px' }}>
            <div style={{ height: '1px', background: '#D5CFC5', width: '70px' }}></div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8C8477', textTransform: 'uppercase' }}>OR</span>
            <div style={{ height: '1px', background: '#D5CFC5', width: '70px' }}></div>
          </div>

          {/* 6-Digit OTP Badge (MyGate Dark Teal Style) */}
          <div style={{ textAlign: 'center', margin: '12px 0 20px 0' }}>
            <div style={{
              background: '#1E3E47',
              color: '#FFFFFF',
              fontFamily: 'var(--font-mono)',
              fontSize: '2.1rem',
              fontWeight: 800,
              letterSpacing: '0.22em',
              padding: '12px 28px',
              borderRadius: '12px',
              display: 'inline-block',
              boxShadow: '0 4px 14px rgba(30, 62, 71, 0.25)'
            }}>
              {invitation.entry_code}
            </div>
          </div>

          {/* Validity Time Window */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#4A3E2C', lineHeight: '1.4' }}>
              {formatWindowDate(invitation.valid_from)} to<br/>
              {formatWindowDate(invitation.valid_until)}
            </p>
          </div>

          {/* Location & Address */}
          {getAddress() && (
            <div style={{ textAlign: 'center', padding: '14px 18px', background: '#F3EFE6', borderRadius: '14px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600, color: '#3D352A', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                {getAddress()}
              </p>
              <a 
                href={mapsUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#2563EB',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: 'rgba(37, 99, 235, 0.08)',
                  padding: '5px 12px',
                  borderRadius: '999px'
                }}
              >
                <MapPin size={14} />
                <span>Google Coordinates / Maps</span>
              </a>
            </div>
          )}

          {invitation.purpose && (
            <div style={{ textAlign: 'center', marginBottom: '14px', fontSize: '0.88rem', color: '#736B5E' }}>
              Purpose: <strong style={{ color: '#3D352A' }}>{invitation.purpose}</strong>
            </div>
          )}

          {invitation.vehicle_number && (
            <div style={{ textAlign: 'center', marginBottom: '16px', background: '#EDE8DE', padding: '8px 14px', borderRadius: '8px', fontSize: '0.88rem', color: '#5C4F3D', fontWeight: 600 }}>
              🚗 Authorized Vehicle: <strong className="mono" style={{ color: '#B45309' }}>{invitation.vehicle_number}</strong>
            </div>
          )}

          {/* Footer Branding */}
          <div style={{ textAlign: 'center', borderTop: '1px solid #E5E0D8', paddingTop: '16px', marginTop: '12px' }}>
            <img 
              src="https://arenesha.com/_next/image?url=%2Fassets%2Flogo-primary.png&w=384&q=75" 
              alt="AreneSHA" 
              style={{ height: '24px', maxWidth: '110px', objectFit: 'contain', margin: '0 auto 4px auto', display: 'block' }} 
            />
            <p style={{ fontSize: '0.75rem', color: '#8C8477', margin: '2px 0 0' }}>
              Secure Gate Pass • ID: {invitation.id}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
