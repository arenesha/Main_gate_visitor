import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, XCircle, CheckCircle2, RefreshCw, Filter, Clock, MapPin, User, Car, Download, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VerificationHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/verifications/history');
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setLogs(data.verifications || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    return log.status === filter;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ background: '#F0F9FF', color: '#075985', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', border: '1px solid #BAE6FD' }}>
              SECURITY AUDIT
            </span>
            <span style={{ color: '#94A3B8', fontSize: '0.82rem' }}>•</span>
            <span style={{ color: '#64748B', fontSize: '0.78rem' }}>Immutable Gate Log</span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Gate Verification Audit Log
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Meenakshi Tech Park checkpoint verification trail for all authorized and denied entry scans.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a 
            href="/api/export/verifications/csv" 
            download 
            className="btn btn-secondary btn-sm" 
            style={{ fontWeight: 700 }}
            title="Export Checkpoint Audit to Excel CSV"
          >
            <Download size={15} color="#059669" />
            <span>Export CSV / Excel</span>
          </a>
          <button onClick={fetchHistory} className="btn btn-secondary btn-sm" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginRight: '4px' }}>Filter Outcome:</span>
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'AUTHORIZED', label: '🟢 Authorized Entries' },
            { id: 'DENIED', label: '🔴 Denied Attempts' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: filter === item.id ? '1px solid #D97706' : '1px solid #E2E8F0',
                background: filter === item.id ? '#FFFBEB' : '#FFFFFF',
                color: filter === item.id ? '#B45309' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '14px 20px' }}>Verification ID</th>
                <th style={{ padding: '14px 20px' }}>Status Outcome</th>
                <th style={{ padding: '14px 20px' }}>Visitor & Host</th>
                <th style={{ padding: '14px 20px' }}>Verification Method</th>
                <th style={{ padding: '14px 20px' }}>Gate Operator</th>
                <th style={{ padding: '14px 20px' }}>Timestamp</th>
                <th style={{ padding: '14px 20px' }}>Audit Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                    Loading security audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                    No verification records logged yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="mono" style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.84rem' }}>{log.id}</span>
                      <div style={{ fontSize: '0.75rem', color: '#D97706', marginTop: '2px' }}>
                        <Link to={`/invitation/${log.invitation_id}`} target="_blank" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
                          Pass: {log.invitation_id} ↗
                        </Link>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      {log.status === 'AUTHORIZED' ? (
                        <span className="badge badge-active">
                          <CheckCircle2 size={12} /> AUTHORIZED
                        </span>
                      ) : (
                        <span className="badge badge-revoked">
                          <XCircle size={12} /> DENIED
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{log.visitor_name || 'Guest'}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Host: {log.host_name || 'N/A'}</div>
                      {log.vehicle_number && (
                        <div style={{ fontSize: '0.72rem', color: '#B45309', background: '#FFFBEB', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '3px', fontWeight: 600 }}>
                          🚗 {log.vehicle_number}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <span className="mono" style={{ fontSize: '0.78rem', background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', fontWeight: 700 }}>
                        {log.verification_method}
                      </span>
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '0.84rem' }}>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{log.verified_by || 'Main Gate #1'}</div>
                      {log.ip_address && (
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>IP: {log.ip_address}</div>
                      )}
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '0.82rem', color: '#475569' }}>
                      <div style={{ fontWeight: 600 }}>{new Date(log.verified_at).toLocaleDateString()}</div>
                      <div style={{ color: '#94A3B8' }}>{new Date(log.verified_at).toLocaleTimeString()}</div>
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '0.84rem', fontWeight: 600 }}>
                      <span style={{ color: log.status === 'AUTHORIZED' ? '#059669' : '#DC2626' }}>
                        {log.reason || 'Verified successfully'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
