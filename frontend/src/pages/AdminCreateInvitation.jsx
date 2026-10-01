import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  UserPlus, User, Phone, Mail, Car, CreditCard, FileText, 
  Building2, MapPin, MessageSquare, Send, Smartphone, Check, 
  CheckCircle2, XCircle, AlertCircle, Download, Eye, PlusCircle,
  FileSpreadsheet, Sparkles, ExternalLink, Printer, ShieldCheck,
  Calendar, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { appendVisitorToExcelLog, exportSinglePassToXLSX } from '../utils/excelExport';

// Format Date object to YYYY-MM-DDTHH:mm in LOCAL facility time (avoids UTC drift)
function formatLocalInputDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseInputDateTime(val) {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatPreviewDate(val) {
  if (!val) return '—';
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    s = `${s}+05:30`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
}

export default function AdminCreateInvitation() {
  const [formData, setFormData] = useState({
    visitor_name: '',
    visitor_phone: '',
    visitor_email: '',
    vehicle_number: '',
    aadhaar_number: '',
    purpose: '',
    host_name: 'AreneSHA Workspace',
    company: 'AreneSHA',
    host_department: 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032',
    valid_from: formatLocalInputDateTime(new Date()),
    valid_until: formatLocalInputDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000))
  });

  // Notification Channel Checkboxes
  const [notifications, setNotifications] = useState({
    sms: true,
    email: true
  });

  const [loading, setLoading] = useState(false);
  const [createdPass, setCreatedPass] = useState(null);
  const [notificationResults, setNotificationResults] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [errorBanner, setErrorBanner] = useState(null);

  // Field change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Notification checkbox toggle
  const handleNotificationToggle = (channel) => {
    setNotifications(prev => ({ ...prev, [channel]: !prev[channel] }));
  };

  // 1-Click Fast Template for testing
  const fillSample = (type) => {
    const now = new Date();
    const fromLocal = formatLocalInputDateTime(now);
    const untilLocal = formatLocalInputDateTime(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    if (type === 'sample' || type === 'priti') {
      setFormData({
        visitor_name: 'Priti',
        visitor_phone: '+91 98765 43210',
        visitor_email: '',
        vehicle_number: 'TS-09-EA-2026',
        aadhaar_number: '9845 2310 7712',
        purpose: 'workspace',
        host_name: 'AreneSHA Workspace',
        company: 'AreneSHA',
        host_department: 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032',
        valid_from: fromLocal,
        valid_until: untilLocal
      });
    } else if (type === 'clear') {
      setFormData({
        visitor_name: '',
        visitor_phone: '',
        visitor_email: '',
        vehicle_number: '',
        aadhaar_number: '',
        purpose: '',
        host_name: 'AreneSHA Workspace',
        company: 'AreneSHA',
        host_department: 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032',
        valid_from: fromLocal,
        valid_until: untilLocal
      });
    }
    setFormErrors({});
    setErrorBanner(null);
  };

  // Duration preset handlers
  const applyDurationPreset = (hours) => {
    const start = parseInputDateTime(formData.valid_from);
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    setFormData(prev => ({ ...prev, valid_until: formatLocalInputDateTime(end) }));
  };

  const applyTodayOnly = () => {
    const start = parseInputDateTime(formData.valid_from);
    const end = new Date(start);
    end.setHours(23, 59, 0, 0);
    setFormData(prev => ({ ...prev, valid_until: formatLocalInputDateTime(end) }));
  };

  const resetStartTimeToNow = () => {
    const now = new Date();
    const startStr = formatLocalInputDateTime(now);
    const untilDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    setFormData(prev => ({
      ...prev,
      valid_from: startStr,
      valid_until: formatLocalInputDateTime(untilDate)
    }));
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.visitor_name.trim()) errors.visitor_name = 'Visitor Full Name is required.';
    if (!formData.visitor_phone.trim()) {
      errors.visitor_phone = 'Mobile Number is required.';
    } else if (formData.visitor_phone.replace(/\D/g, '').length < 10) {
      errors.visitor_phone = 'Enter a valid 10-digit mobile number.';
    }
    if (!formData.purpose.trim()) errors.purpose = 'Purpose of visit is required.';
    if (!formData.host_name.trim()) errors.host_name = 'Host / Inviter Name is required.';
    if (!formData.visitor_email || !formData.visitor_email.trim()) {
      errors.visitor_email = 'Email Address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.visitor_email.trim())) {
      errors.visitor_email = 'Enter a valid email address.';
    }
    if (formData.valid_from && formData.valid_until) {
      const fromTime = new Date(formData.valid_from).getTime();
      const untilTime = new Date(formData.valid_until).getTime();
      if (untilTime <= fromTime) {
        errors.valid_until = 'Pass Expiration must be after Starting date & time.';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Main Submit Handler
  const handleCreateVisitorPass = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrorBanner(null);

    try {
      // 1. Create pass via Worker API
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          entry_type: 'SINGLE',
          max_entries: 1
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create visitor pass');
      }

      const inv = data.invitation;
      const passUrl = `${window.location.origin}/invitation/${inv.id}`;

      // 2. Notification Dispatch Evaluation
      const notifResults = {
        email: { attempted: notifications.email, success: false, status: 'Not Selected' },
        sms: { attempted: notifications.sms, success: false, status: 'Not Selected' }
      };

      // Real Email Dispatch via Gmail SMTP
      if (notifications.email && formData.visitor_email) {
        try {
          const emailRes = await fetch('/api/dispatch-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...inv,
              public_url: passUrl
            })
          });
          const emailData = await emailRes.json();
          if (emailData.success) {
            notifResults.email = { attempted: true, success: true, status: `Sent to ${emailData.recipient}` };
          } else {
            notifResults.email = { attempted: true, success: false, status: emailData.error || 'Dispatch Failed' };
          }
        } catch (err) {
          notifResults.email = { attempted: true, success: false, status: 'Email service unavailable' };
        }
      } else if (notifications.email && !formData.visitor_email) {
        notifResults.email = { attempted: true, success: false, status: 'No email address entered' };
      }

      // Real SMS dispatch check
      if (notifications.sms) {
        if (data.notifications?.sms?.sent) {
          notifResults.sms = { attempted: true, success: true, status: `Sent to ${formData.visitor_phone}` };
        } else if (data.notifications?.sms?.error) {
          notifResults.sms = { attempted: true, success: false, status: `Not sent: ${data.notifications.sms.error}` };
        } else {
          notifResults.sms = { attempted: true, success: true, status: `Ready for SMS App (${formData.visitor_phone})` };
        }
      }

      // 3. Automatically append complete visitor record into Excel
      const excelRecord = appendVisitorToExcelLog({
        ...inv,
        aadhaar_number: formData.aadhaar_number,
        company: formData.company,
        sms_status: notifResults.sms.status,
        email_status: notifResults.email.status
      });

      setNotificationResults(notifResults);
      setCreatedPass({
        ...inv,
        aadhaar_number: formData.aadhaar_number,
        company: formData.company,
        excelSaved: !!excelRecord
      });

      toast.success(`Visitor Pass ${inv.id} created successfully!`);

        // Automatically reset form inputs for next visitor registration
        setFormData({
          visitor_name: '',
          visitor_phone: '',
          visitor_email: '',
          vehicle_number: '',
          aadhaar_number: '',
          purpose: '',
          host_name: 'AreneSHA Workspace',
          company: 'AreneSHA',
          host_department: 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032',
          valid_from: formatLocalInputDateTime(new Date()),
          valid_until: formatLocalInputDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000))
        });
        setFormErrors({});

    } catch (err) {
      console.error('Create Pass Error:', err);
      setErrorBanner(err.message || 'An unexpected error occurred.');
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getPassUrl = () => {
    if (!createdPass) return '';
    return `${window.location.origin}/invitation/${createdPass.id}`;
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '16px 16px 48px' }}>
      
      {/* SUCCESS CONFIRMATION SCREEN */}
      {createdPass ? (
        <div className="glass-card" style={{ padding: '32px 28px', border: '1px solid #E2E8F0', background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <CheckCircle2 size={28} />
            </div>
            <h2 style={{ fontSize: '1.45rem', color: '#0F172A', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Visitor Pass Created Successfully
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.88rem', marginTop: '4px' }}>
              The digital credential and 6-digit gate PIN have been generated.
            </p>
          </div>

          {/* Pass Key Metrics Banner */}
          <div style={{ background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Pass ID</span>
                <h3 className="mono" style={{ margin: '2px 0 0', color: '#4F46E5', fontSize: '1.15rem', fontWeight: 800 }}>{createdPass.id}</h3>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Gate Entry PIN</span>
                <div style={{ marginTop: '2px' }}>
                  <span className="mono" style={{ background: '#0F172A', color: '#FFFFFF', padding: '4px 12px', borderRadius: '6px', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.12em', display: 'inline-block' }}>
                    {createdPass.entry_code}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Status</span>
                <div style={{ marginTop: '4px' }}>
                  <span className="badge badge-active" style={{ fontSize: '0.78rem' }}>AUTHORIZED</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Valid Window</span>
                <div style={{ color: '#059669', fontSize: '0.86rem', fontWeight: 700, marginTop: '2px' }}>Active Today</div>
              </div>
            </div>

            {/* Information Grid */}
            <div style={{ borderTop: '1px solid #E2E8F0', marginTop: '16px', paddingTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '0.88rem' }}>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 600 }}>Visitor Name:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#0F172A' }}>{createdPass.visitor_name}</p>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 600 }}>Mobile Number:</span>
                <p style={{ margin: '2px 0 0', color: '#4F46E5', fontWeight: 600 }}>{createdPass.visitor_phone}</p>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 600 }}>Host / Inviter:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0F172A' }}>{createdPass.host_name}</p>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 600 }}>Purpose of Visit:</span>
                <p style={{ margin: '2px 0 0', color: '#334155' }}>{createdPass.purpose}</p>
              </div>
              {createdPass.visitor_email && (
                <div>
                  <span style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 600 }}>Email Address:</span>
                  <p style={{ margin: '2px 0 0', color: '#334155' }}>{createdPass.visitor_email}</p>
                </div>
              )}
              {createdPass.vehicle_number && (
                <div>
                  <span style={{ color: '#64748B', fontSize: '0.76rem', fontWeight: 600 }}>Vehicle Number:</span>
                  <p className="mono" style={{ margin: '2px 0 0', color: '#D97706', fontWeight: 700 }}>🚗 {createdPass.vehicle_number}</p>
                </div>
              )}
            </div>
          </div>

          {/* Real Notification Dispatch Status */}
          {notificationResults && (
            <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '16px', marginBottom: '22px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
                Notification Dispatch Report
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#0284C7' }}>
                    <Smartphone size={14} /> SMS Notification
                  </div>
                  <div style={{ fontSize: '0.78rem', color: notificationResults.sms.success ? '#059669' : '#64748B', marginTop: '4px', fontWeight: 600 }}>
                    {notificationResults.sms.status}
                  </div>
                </div>

                <div style={{ background: '#EEF2FF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #C7D2FE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#4338CA' }}>
                    <Mail size={14} /> Email Notification
                  </div>
                  <div style={{ fontSize: '0.78rem', color: notificationResults.email.success ? '#059669' : '#DC2626', marginTop: '4px', fontWeight: 600 }}>
                    {notificationResults.email.status}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link 
              to={`/invitation/${createdPass.id}`} 
              target="_blank" 
              className="btn btn-primary"
              style={{ minWidth: '130px', padding: '10px 18px', fontWeight: 700, fontSize: '0.88rem' }}
            >
              <Eye size={15} />
              <span>View Pass</span>
            </Link>

            <button 
              onClick={() => exportSinglePassToXLSX(createdPass)}
              className="btn btn-secondary"
              style={{ minWidth: '140px', padding: '10px 18px', fontWeight: 600, fontSize: '0.88rem' }}
            >
              <Download size={15} />
              <span>Download Excel</span>
            </button>

            <button 
              onClick={() => {
                setCreatedPass(null);
                setNotificationResults(null);
                fillSample('clear');
              }}
              className="btn btn-secondary"
              style={{ padding: '10px 18px', fontWeight: 600, fontSize: '0.88rem' }}
            >
              <PlusCircle size={15} />
              <span>Create Another Pass</span>
            </button>
          </div>
        </div>
      ) : (
        /* SINGLE CLEAN CENTERED FORM */
        <div className="glass-card">
                      {/* Header */}
          <div style={{ marginBottom: '28px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.02em' }}>
                  <UserPlus size={24} color="#4F46E5" />
                  Visitor Access Pass Registration
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0' }}>
                  Register visitors and generate digital gate access credentials for Meenakshi Tech Park.
                </p>
              </div>

              {/* Fast autofill preset */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fillSample('priti')}
                  className="btn btn-secondary btn-sm"
                  style={{ background: '#EEF2FF', borderColor: '#C7D2FE', color: '#4338CA', fontSize: '0.8rem' }}
                  title="Autofill sample visitor details for quick testing"
                >
                  <Sparkles size={13} />
                  <span>Autofill Sample</span>
                </button>

                <button
                  type="button"
                  onClick={() => fillSample('clear')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.8rem' }}
                  title="Clear all fields"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {errorBanner && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '10px', color: 'var(--danger-text)', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} />
              <span>{errorBanner}</span>
            </div>
          )}

          <form onSubmit={handleCreateVisitorPass}>
            
            {/* 1. VISITOR INFORMATION */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EEF2FF', color: '#4338CA', padding: '5px 14px', borderRadius: '6px', fontSize: '0.84rem', fontWeight: 800, border: '1px solid #C7D2FE', marginBottom: '18px' }}>
                <span style={{ background: '#4F46E5', color: '#FFFFFF', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>1</span>
                Visitor Information
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">
                    Visitor Full Name <span className="required-star">*</span>
                  </label>
                  <div className="input-wrapper">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      name="visitor_name"
                      placeholder="e.g. Sarah Jenkins"
                      className={`form-input ${formErrors.visitor_name ? 'input-error' : ''}`}
                      value={formData.visitor_name}
                      onChange={handleChange}
                    />
                  </div>
                  {formErrors.visitor_name && (
                    <span style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                      {formErrors.visitor_name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Mobile Number <span className="required-star">*</span>
                  </label>
                  <div className="input-wrapper">
                    <Phone size={16} className="input-icon" />
                    <input
                      type="tel"
                      name="visitor_phone"
                      placeholder="e.g. +91 98765 43210"
                      className={`form-input ${formErrors.visitor_phone ? 'input-error' : ''}`}
                      value={formData.visitor_phone}
                      onChange={handleChange}
                    />
                  </div>
                  {formErrors.visitor_phone && (
                    <span style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                      {formErrors.visitor_phone}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">
                    Email Address <span className="required-star">*</span>
                  </label>
                  <div className="input-wrapper">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="email"
                      name="visitor_email"
                      placeholder="e.g. visitor.name@corporate.com"
                      className={`form-input ${formErrors.visitor_email ? 'input-error' : ''}`}
                      value={formData.visitor_email}
                      onChange={handleChange}
                    />
                  </div>
                  {formErrors.visitor_email && (
                    <span style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                      {formErrors.visitor_email}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Aadhaar Number <span className="optional-text">(Optional)</span>
                  </label>
                  <div className="input-wrapper">
                    <CreditCard size={16} className="input-icon" />
                    <input
                      type="text"
                      name="aadhaar_number"
                      placeholder="e.g. 9845 2310 7712"
                      className="form-input"
                      value={formData.aadhaar_number}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">
                    Vehicle Registration Number <span className="optional-text">(Optional)</span>
                  </label>
                  <div className="input-wrapper">
                    <Car size={16} className="input-icon" />
                    <input
                      type="text"
                      name="vehicle_number"
                      placeholder="e.g. TS-09-EA-2026"
                      className="form-input uppercase"
                      value={formData.vehicle_number}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Purpose of Visit <span className="required-star">*</span>
                  </label>
                  <div className="input-wrapper">
                    <FileText size={16} className="input-icon" />
                    <input
                      type="text"
                      name="purpose"
                      placeholder="e.g. Official Meeting / Site Visit"
                      className={`form-input ${formErrors.purpose ? 'input-error' : ''}`}
                      value={formData.purpose}
                      onChange={handleChange}
                    />
                  </div>
                  {formErrors.purpose && (
                    <span style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                      {formErrors.purpose}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. HOST & OFFICE INFORMATION */}
            <div style={{ marginBottom: '28px', borderTop: '1px solid var(--border-color)', paddingTop: '22px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EEF2FF', color: '#4338CA', padding: '5px 14px', borderRadius: '6px', fontSize: '0.84rem', fontWeight: 800, border: '1px solid #C7D2FE', marginBottom: '18px' }}>
                <span style={{ background: '#4F46E5', color: '#FFFFFF', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>2</span>
                Host & Office Information
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">
                    Host / Inviter Name <span className="required-star">*</span>
                  </label>
                  <div className="input-wrapper">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      name="host_name"
                      placeholder="e.g. AreneSHA Workspace"
                      className={`form-input ${formErrors.host_name ? 'input-error' : ''}`}
                      value={formData.host_name}
                      onChange={handleChange}
                    />
                  </div>
                  {formErrors.host_name && (
                    <span style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                      {formErrors.host_name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Office / Company <span className="optional-text">(Default: AreneSHA)</span>
                  </label>
                  <div className="input-wrapper">
                    <Building2 size={16} className="input-icon" />
                    <input
                      type="text"
                      name="company"
                      placeholder="e.g. AreneSHA Solutions"
                      className="form-input"
                      value={formData.company}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Destination / Office Location</label>
                <div className="input-wrapper">
                  <MapPin size={16} className="input-icon" />
                  <input
                    type="text"
                    name="host_department"
                    className="form-input"
                    value={formData.host_department}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* 3. PASS VALIDITY WINDOW & TIMING */}
            <div style={{ marginBottom: '28px', borderTop: '1px solid var(--border-color)', paddingTop: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EEF2FF', color: '#4338CA', padding: '5px 14px', borderRadius: '6px', fontSize: '0.84rem', fontWeight: 800, border: '1px solid #C7D2FE' }}>
                  <span style={{ background: '#4F46E5', color: '#FFFFFF', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>3</span>
                  Pass Validity Window & Schedule (IST)
                </div>
                <button
                  type="button"
                  onClick={resetStartTimeToNow}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', color: '#4F46E5', borderColor: '#C7D2FE', background: '#EEF2FF' }}
                  title="Reset starting time to current exact time"
                >
                  <Clock size={12} />
                  <span>Set Start Time to Now</span>
                </button>
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">
                    Valid From (Pass Starts) <span className="required-star">*</span>
                  </label>
                  <div className="input-wrapper">
                    <Calendar size={16} className="input-icon" />
                    <input
                      type="datetime-local"
                      name="valid_from"
                      className={`form-input ${formErrors.valid_from ? 'input-error' : ''}`}
                      value={formData.valid_from}
                      onChange={handleChange}
                    />
                  </div>
                  {formErrors.valid_from && (
                    <span style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                      {formErrors.valid_from}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Valid Until (Pass Expires) <span className="required-star">*</span>
                  </label>
                  <div className="input-wrapper">
                    <Clock size={16} className="input-icon" />
                    <input
                      type="datetime-local"
                      name="valid_until"
                      className={`form-input ${formErrors.valid_until ? 'input-error' : ''}`}
                      value={formData.valid_until}
                      onChange={handleChange}
                    />
                  </div>
                  {formErrors.valid_until && (
                    <span style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                      {formErrors.valid_until}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Presets:</span>
                {[
                  { label: '+4 Hours', action: () => applyDurationPreset(4) },
                  { label: '+8 Hours (Work Day)', action: () => applyDurationPreset(8) },
                  { label: 'Today Only (23:59)', action: applyTodayOnly },
                  { label: '24 Hours (1 Day)', action: () => applyDurationPreset(24) },
                  { label: '3 Days', action: () => applyDurationPreset(72) },
                  { label: '1 Week', action: () => applyDurationPreset(168) }
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={preset.action}
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Live Preview Box */}
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 16px', marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="#15803D" />
                  <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>
                    Scheduled Access: <strong>{formatPreviewDate(formData.valid_from)}</strong> to <strong>{formatPreviewDate(formData.valid_until)}</strong>
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '3px 8px', borderRadius: '6px', border: '1px solid #86EFAC' }}>
                  IST (Indian Standard Time)
                </span>
              </div>
            </div>

            {/* 4. AUTOMATIC NOTIFICATION CHANNELS */}
            <div style={{ marginBottom: '32px', borderTop: '1px solid var(--border-color)', paddingTop: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EEF2FF', color: '#4338CA', padding: '5px 14px', borderRadius: '6px', fontSize: '0.84rem', fontWeight: 800, border: '1px solid #C7D2FE' }}>
                  <span style={{ background: '#4F46E5', color: '#FFFFFF', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>4</span>
                  Automatic Notification Channels
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select channels to dispatch pass credentials</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <label 
                  style={{
                    background: notifications.sms ? '#EEF2FF' : '#FFFFFF',
                    border: notifications.sms ? '1.5px solid #4F46E5' : '1.5px solid #CBD5E1',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s',
                    boxShadow: notifications.sms ? '0 2px 6px rgba(79, 70, 229, 0.15)' : 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={notifications.sms}
                    onChange={() => handleNotificationToggle('sms')}
                    style={{ width: '16px', height: '16px', accentColor: '#4F46E5' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>SMS</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Send to Mobile</div>
                  </div>
                </label>

                <label 
                  style={{
                    background: notifications.email ? '#EEF2FF' : '#FFFFFF',
                    border: notifications.email ? '1.5px solid #4F46E5' : '1.5px solid #CBD5E1',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s',
                    boxShadow: notifications.email ? '0 2px 6px rgba(79, 70, 229, 0.15)' : 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={notifications.email}
                    onChange={() => handleNotificationToggle('email')}
                    style={{ width: '16px', height: '16px', accentColor: '#4F46E5' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>Email</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Send Gmail Pass</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Primary Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  letterSpacing: '0.01em',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.32)',
                  borderRadius: '10px',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? 'Creating Visitor Pass...' : 'Create Visitor Pass'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
