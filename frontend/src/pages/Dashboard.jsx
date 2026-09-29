import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, CheckCircle2, ShieldCheck, XCircle, Search,
  Download, QrCode, Copy, Check, RefreshCw, Shield, Mail, Send, UserPlus, AlertCircle, Trash2
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { exportInvitationsToXLSX } from '../utils/excelExport';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalInvitations: 0,
    activeInvitations: 0,
    authorizedEntries: 0,
    deniedEntries: 0
  });
  const [invitations, setInvitations] = useState([]);
  const [guards, setGuards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Guard authorization modal state
  const [guardModalOpen, setGuardModalOpen] = useState(false);
  const [guardForm, setGuardForm] = useState({
    email: 'arenesha20@gmail.com',
    name: 'AreneSHA Security (Guard)',
    assigned_location: 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032'
  });
  const [emailSending, setEmailSending] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, invRes, guardsRes] = await Promise.all([
        fetch('/api/stats')
          .then(r => r.ok ? r.json() : { success: false })
          .catch(() => ({ success: false })),
        fetch('/api/invitations')
          .then(r => r.ok ? r.json() : { success: false })
          .catch(() => ({ success: false })),
        fetch('/api/admin/guards')
          .then(r => r.ok ? r.json() : { success: false })
          .catch(() => ({ success: false }))
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (invRes.success) setInvitations(invRes.invitations || []);
      if (guardsRes.success) setGuards(guardsRes.guards || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyPin = (pin, id) => {
    navigator.clipboard.writeText(pin);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportXLSX = () => {
    exportInvitationsToXLSX(filteredVisitors, `AreneSHA_Visitor_Log_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Authorize Guard & Send Activation Email
  const handleAuthorizeGuard = async (e, forceResend = false) => {
    if (e) e.preventDefault();
    setEmailSending(true);
    setActionNotice(null);

    try {
      const res = await fetch('/api/admin/guards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: guardForm.email.trim(),
          name: guardForm.name.trim(),
          assigned_location: guardForm.assigned_location.trim(),
          force_resend: forceResend
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice({
          type: 'success',
          message: data.email_notification?.sent
            ? `✓ Guard Access Activated email sent to ${guardForm.email}`
            : data.message
        });
        setGuardModalOpen(false);
        loadData();
      } else {
        setActionNotice({
          type: 'error',
          message: data.error || 'Failed to authorize Guard'
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        message: 'Network communication error while authorizing Guard'
      });
    } finally {
      setEmailSending(false);
    }
  };

  const handleDeleteVisitor = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete visitor pass ${id} (${name || 'Visitor'})?`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || 'Failed to delete record.');
      }
    } catch (err) {
      alert('Network error while deleting record.');
    } finally {
      setDeletingId(null);
    }
  };

  const getAvatarColor = (name = '') => {
    const colors = [
      { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
      { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
      { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
      { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' }
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name = '') => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name.slice(0, 2) || 'VI').toUpperCase();
  };

  const filteredVisitors = invitations.filter(inv => {
    const matchesSearch =
      inv.visitor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.entry_code?.includes(searchQuery) ||
      inv.host_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterTab === 'ALL' ||
      (filterTab === 'ACTIVE' && inv.status === 'ACTIVE') ||
      (filterTab === 'USED' && inv.status === 'USED') ||
      (filterTab === 'EXPIRED' && (inv.status === 'EXPIRED' || inv.status === 'REVOKED'));

    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      {/* Clean Page Title */}
      <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Security Dashboard
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.84rem', margin: '2px 0 0' }}>
            Real-time visitor overview for <strong>Meenakshi Tech Park</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => setGuardModalOpen(true)} className="btn btn-primary btn-sm" style={{ background: '#1E3E47', gap: '6px' }}>
            <UserPlus size={14} />
            <span>Authorize Guard Access</span>
          </button>
          <button onClick={loadData} className="btn btn-secondary btn-sm" title="Refresh data">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '16px',
          background: actionNotice.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${actionNotice.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          color: actionNotice.type === 'success' ? '#065F46' : '#DC2626',
          fontSize: '0.86rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{actionNotice.message}</span>
          <button onClick={() => setActionNotice(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 800 }}>×</button>
        </div>
      )}

      {/* 4 Compact Metric Cards (Sapphire & Slate Accents) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <div className="glass-card" style={{ padding: '10px 14px', borderLeft: '3px solid #4F46E5', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Passes
            </span>
            <div style={{ background: '#EEF2FF', padding: '4px', borderRadius: '6px', color: '#4F46E5' }}>
              <Users size={13} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.35rem', margin: 0, color: '#0F172A', fontWeight: 800 }}>
            {loading ? '-' : stats.totalInvitations}
          </h3>
        </div>

        <div className="glass-card" style={{ padding: '10px 14px', borderLeft: '3px solid #059669', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Passes
            </span>
            <div style={{ background: '#ECFDF5', padding: '4px', borderRadius: '6px', color: '#059669' }}>
              <CheckCircle2 size={13} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.35rem', margin: 0, color: '#059669', fontWeight: 800 }}>
            {loading ? '-' : stats.activeInvitations}
          </h3>
        </div>

        <div className="glass-card" style={{ padding: '10px 14px', borderLeft: '3px solid #0284C7', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Authorized
            </span>
            <div style={{ background: '#F0F9FF', padding: '4px', borderRadius: '6px', color: '#0284C7' }}>
              <ShieldCheck size={13} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.35rem', margin: 0, color: '#0284C7', fontWeight: 800 }}>
            {loading ? '-' : stats.authorizedEntries}
          </h3>
        </div>

        <div className="glass-card" style={{ padding: '10px 14px', borderLeft: '3px solid #DC2626', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Denied
            </span>
            <div style={{ background: '#FEF2F2', padding: '4px', borderRadius: '6px', color: '#DC2626' }}>
              <XCircle size={13} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.35rem', margin: 0, color: '#DC2626', fontWeight: 800 }}>
            {loading ? '-' : stats.deniedEntries}
          </h3>
        </div>
      </div>

      {/* Authorized Guard Management Card */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '18px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                  Authorized Guard: {guards.length > 0 ? guards[0].name : 'AreneSHA Guard'}
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#ECFDF5', color: '#065F46', padding: '1px 6px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                  ACTIVE GUARD
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                {guards.length > 0 ? guards[0].email : 'arenesha20@gmail.com'} • Location: B-Block, MEENAKSHI TECH PARK
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => handleAuthorizeGuard(null, true)}
              disabled={emailSending}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', fontWeight: 700, gap: '6px' }}
              title="Resend official Guard Access Activated email"
            >
              {emailSending ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} color="#0284C7" />}
              <span>{emailSending ? 'Sending...' : 'Send Access Email'}</span>
            </button>

            <Link to="/gate" className="btn btn-primary btn-sm" style={{ background: '#059669', fontSize: '0.78rem', fontWeight: 800 }}>
              Open Gate Terminal →
            </Link>
          </div>
        </div>
      </div>

      {/* Single Clean Full-Width Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table Toolbar */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '200px', maxWidth: '340px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search visitor, PIN, host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '0.82rem', padding: '7px 12px 7px 32px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ACTIVE', label: 'Active' },
                { id: 'USED', label: 'Used' },
                { id: 'EXPIRED', label: 'Expired' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: filterTab === tab.id ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                    background: filterTab === tab.id ? '#EEF2FF' : '#FFFFFF',
                    color: filterTab === tab.id ? '#4338CA' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Export Excel Button */}
            <button onClick={handleExportXLSX} className="btn btn-secondary btn-sm" style={{ padding: '5px 10px', fontSize: '0.78rem' }} title="Export to Excel (.xlsx)">
              <Download size={13} color="#059669" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Table Rows */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 18px' }}>Visitor</th>
                <th style={{ padding: '10px 18px' }}>Host / Purpose</th>
                <th style={{ padding: '10px 18px' }}>6-Digit PIN</th>
                <th style={{ padding: '10px 18px' }}>Valid Date</th>
                <th style={{ padding: '10px 18px' }}>Status</th>
                <th style={{ padding: '10px 18px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                    Loading visitors...
                  </td>
                </tr>
              ) : filteredVisitors.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                    No visitor records found.
                  </td>
                </tr>
              ) : (
                filteredVisitors.map(inv => {
                  const avatarStyle = getAvatarColor(inv.visitor_name);
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                      <td style={{ padding: '10px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: avatarStyle.bg,
                            color: avatarStyle.text,
                            border: `1px solid ${avatarStyle.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            {getInitials(inv.visitor_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{inv.visitor_name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                              {inv.visitor_phone || inv.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 18px' }}>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{inv.host_name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{inv.purpose}</div>
                      </td>

                      <td style={{ padding: '10px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="mono" style={{
                            background: '#EEF2FF',
                            color: '#4338CA',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            border: '1px solid #C7D2FE'
                          }}>
                            {inv.entry_code}
                          </span>
                          <button
                            onClick={() => copyPin(inv.entry_code, inv.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '2px' }}
                            title="Copy PIN"
                          >
                            {copiedId === inv.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </td>

                      <td style={{ padding: '10px 18px', fontSize: '0.8rem', color: '#475569' }}>
                        {new Date(inv.valid_from).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}
                      </td>

                      <td style={{ padding: '10px 18px' }}>
                        <StatusBadge status={inv.status} />
                      </td>

                      <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Link
                            to={`/invitation/${inv.id}`}
                            target="_blank"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#4F46E5', borderColor: '#C7D2FE' }}
                          >
                            <QrCode size={12} color="#4F46E5" />
                            <span>Pass</span>
                          </Link>
                          <button
                            onClick={() => handleDeleteVisitor(inv.id, inv.visitor_name)}
                            disabled={deletingId === inv.id}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }}
                            title="Delete this visitor pass"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AUTHORIZE GUARD MODAL */}
      {guardModalOpen && (
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
          <div className="glass-card" style={{ maxWidth: '460px', width: '100%', background: '#FFFFFF', borderRadius: '18px', overflow: 'hidden', padding: '24px' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>Authorize Guard Account</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>Sends real Guard Access Activation email</p>
              </div>
            </div>

            <form onSubmit={handleAuthorizeGuard}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Guard Email Address
                </label>
                <input
                  type="email"
                  required
                  value={guardForm.email}
                  onChange={(e) => setGuardForm(prev => ({ ...prev, email: e.target.value }))}
                  className="form-input"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Guard Full Name
                </label>
                <input
                  type="text"
                  required
                  value={guardForm.name}
                  onChange={(e) => setGuardForm(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Assigned Operating Location
                </label>
                <input
                  type="text"
                  required
                  value={guardForm.assigned_location}
                  onChange={(e) => setGuardForm(prev => ({ ...prev, assigned_location: e.target.value }))}
                  className="form-input"
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setGuardModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={emailSending}
                  className="btn btn-primary btn-sm"
                  style={{ background: '#1E3E47', gap: '6px' }}
                >
                  {emailSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{emailSending ? 'Saving & Sending...' : 'Authorize & Send Email'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
