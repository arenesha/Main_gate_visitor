import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ListOrdered, Search, Filter, Copy, Check, ExternalLink, Ban, RefreshCw, Eye, Clock, FileSpreadsheet, Download, UserPlus, QrCode, Trash2 } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { exportInvitationsToXLSX, exportSinglePassToXLSX } from '../utils/excelExport';

export default function AdminInvitationList() {
  const [searchParams] = useSearchParams();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) setSearchTerm(queryParam);
  }, [searchParams]);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invitations');
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleDownloadAllXLSX = () => {
    exportInvitationsToXLSX(filteredInvitations, `AreneSHA_Visitor_Log_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleRevoke = async (id) => {
    if (!window.confirm(`Are you sure you want to revoke invitation pass ${id}? This action cannot be undone.`)) {
      return;
    }

    setRevokingId(id);
    try {
      const res = await fetch(`/api/invitations/${id}/revoke`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchInvitations();
      } else {
        alert(data.error || 'Failed to revoke invitation.');
      }
    } catch (err) {
      alert('Network error while revoking.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete pass ${id} (${name || 'Visitor'})? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchInvitations();
      } else {
        alert(data.error || 'Failed to delete record.');
      }
    } catch (err) {
      alert('Network error while deleting record.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllRecords = async () => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete ALL ${invitations.length} visitor records and gate verification history? This cannot be undone.`)) {
      return;
    }

    setIsClearingAll(true);
    try {
      const res = await fetch('/api/admin/clear-all-data', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchInvitations();
      } else {
        alert(data.error || 'Failed to delete all records.');
      }
    } catch (err) {
      alert('Network error while clearing all records.');
    } finally {
      setIsClearingAll(false);
    }
  };

  const copyUrl = (id) => {
    const url = `${window.location.origin}/invitation/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getAvatarColor = (name = '') => {
    const colors = [
      { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
      { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
      { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
      { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
      { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' }
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

  const filteredInvitations = invitations.filter(inv => {
    const matchesSearch = 
      inv.visitor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.entry_code?.includes(searchTerm) ||
      inv.host_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ background: '#ECFDF5', color: '#065F46', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', border: '1px solid #A7F3D0' }}>
              EXCEL DIRECTORY
            </span>
            <span style={{ color: '#94A3B8', fontSize: '0.82rem' }}>•</span>
            <span style={{ color: '#64748B', fontSize: '0.78rem' }}>{invitations.length} Total Records</span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Visitor Directory & Ledger
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Comprehensive register of all authorized visitor credentials and auto-saved Excel database.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={handleDownloadAllXLSX} 
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.28)' }}
            title="Download formatted Microsoft Excel (.xlsx) file"
          >
            <Download size={16} />
            <span>Export Excel (.xlsx)</span>
          </button>
          <button 
            onClick={handleClearAllRecords}
            disabled={isClearingAll || invitations.length === 0}
            className="btn btn-secondary btn-sm"
            style={{ 
              color: '#DC2626', 
              borderColor: '#FECACA', 
              background: '#FEF2F2',
              fontWeight: 700,
              cursor: invitations.length === 0 ? 'not-allowed' : 'pointer'
            }}
            title="Permanently delete all visitor records and verification logs"
          >
            <Trash2 size={14} className={isClearingAll ? 'animate-spin' : ''} />
            <span>{isClearingAll ? 'Deleting All...' : 'Delete All Records'}</span>
          </button>
          <button onClick={fetchInvitations} className="btn btn-secondary btn-sm" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
          <Link to="/admin/invitations/create" className="btn btn-primary btn-sm">
            <UserPlus size={15} />
            <span>+ Issue Pass</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search by Visitor name, Pass ID, 6-digit PIN, Host, or Vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
            {[
              { id: 'ALL', label: 'All Records' },
              { id: 'ACTIVE', label: '🟢 Active' },
              { id: 'USED', label: '🔵 Used' },
              { id: 'EXPIRED', label: '⚪ Expired' },
              { id: 'REVOKED', label: '🔴 Revoked' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: statusFilter === tab.id ? '1px solid #D97706' : '1px solid #E2E8F0',
                  background: statusFilter === tab.id ? '#FFFBEB' : '#FFFFFF',
                  color: statusFilter === tab.id ? '#B45309' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '14px 20px' }}>Visitor Details</th>
                <th style={{ padding: '14px 20px' }}>Pass ID / Vehicle</th>
                <th style={{ padding: '14px 20px' }}>Host / Purpose</th>
                <th style={{ padding: '14px 20px' }}>6-Digit PIN</th>
                <th style={{ padding: '14px 20px' }}>Valid Window</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                    Loading visitor ledger...
                  </td>
                </tr>
              ) : filteredInvitations.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                    No visitor records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredInvitations.map(inv => {
                  const avatarStyle = getAvatarColor(inv.visitor_name);
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            width: '36px', 
                            height: '36px', 
                            borderRadius: '50%', 
                            background: avatarStyle.bg, 
                            color: avatarStyle.text, 
                            border: `1px solid ${avatarStyle.border}`,
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '0.8rem', 
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            {getInitials(inv.visitor_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}>{inv.visitor_name}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                              {inv.visitor_phone || inv.visitor_email || 'No direct contact'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <span className="mono" style={{ fontWeight: 700, color: '#D97706', fontSize: '0.84rem' }}>{inv.id}</span>
                        {inv.vehicle_number && (
                          <div style={{ fontSize: '0.74rem', color: '#334155', fontWeight: 600, background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '3px' }}>
                            🚗 {inv.vehicle_number}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B' }}>{inv.host_name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{inv.purpose}</div>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <span className="mono" style={{ 
                          background: '#FFFBEB', 
                          color: '#B45309', 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          border: '1px solid #FDE68A',
                          letterSpacing: '0.04em'
                        }}>
                          {inv.entry_code}
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px', fontSize: '0.8rem', color: '#475569' }}>
                        <div style={{ fontWeight: 600 }}>{new Date(inv.valid_from).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })}</div>
                        <div style={{ color: '#64748B', fontWeight: 600 }}>until {new Date(inv.valid_until).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}</div>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <StatusBadge status={inv.status} />
                        {inv.entry_type === 'MULTI' && (
                          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '3px' }}>
                            Used {inv.entries_used}/{inv.max_entries}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => exportSinglePassToXLSX(inv)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#059669', borderColor: '#A7F3D0', background: '#ECFDF5' }}
                            title="Download row to Excel (.xlsx)"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            onClick={() => copyUrl(inv.id)}
                            className="btn btn-secondary btn-sm"
                            title="Copy Pass URL"
                          >
                            {copiedId === inv.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                          </button>
                          <Link
                            to={`/invitation/${inv.id}`}
                            target="_blank"
                            className="btn btn-secondary btn-sm"
                            title="View Public Pass"
                          >
                            <QrCode size={13} color="#D97706" />
                          </Link>
                          {inv.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleRevoke(inv.id)}
                              disabled={revokingId === inv.id}
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#D97706', borderColor: '#FDE68A', background: '#FFFBEB' }}
                              title="Revoke Pass"
                            >
                              <Ban size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(inv.id, inv.visitor_name)}
                            disabled={deletingId === inv.id}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }}
                            title="Delete this record permanently"
                          >
                            <Trash2 size={13} />
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
    </div>
  );
}
