import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';
import { Shield, Lock } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(true);

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
        <span>Verifying security authorization...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '20px',
          padding: '36px 32px',
          maxWidth: '440px',
          textAlign: 'center',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: '#FEF2F2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Lock size={26} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>
            Guard Authentication Required
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.88rem', margin: '0 0 24px 0' }}>
            This checkpoint terminal is restricted. Please sign in with username <strong>arenesha20@gmail.com</strong> and password <strong>Arenesha@777</strong> to proceed.
          </p>

          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
            }}
          >
            <Shield size={16} color="#B6FF1B" />
            <span>Sign In to Continue</span>
          </button>

          <LoginModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            targetRoute={location.pathname}
          />
        </div>
      </div>
    );
  }

  return children;
}
