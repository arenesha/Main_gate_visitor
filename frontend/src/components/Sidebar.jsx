import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, UserPlus, Users, ShieldAlert, History, Building2, CreditCard, BarChart3, Calendar, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user } = useAuth();
  const isAuthorizedGuardOrAdmin = user && (user.role === 'GUARD' || user.role === 'ADMIN');

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <Link to="/" className="brand-logo">
          <img 
            src="https://arenesha.com/_next/image?url=%2Fassets%2Flogo-primary.png&w=384&q=75" 
            alt="AreneSHA Logo" 
            style={{ height: '32px', maxWidth: '135px', objectFit: 'contain' }} 
          />
          <span className="brand-badge">GATEPASS</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="sidebar-nav">
        <NavLink 
          to="/admin/dashboard" 
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink 
          to="/" 
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Sparkles size={18} color="#B6FF1B" />
          <span>Meet Robo Summit</span>
        </NavLink>

        <NavLink 
          to="/admin/slots" 
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <BarChart3 size={18} />
          <span>Slot Analytics</span>
        </NavLink>

        <NavLink 
          to="/admin/invitations/create" 
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <UserPlus size={18} />
          <span>Issue Visitor Pass</span>
        </NavLink>

        <NavLink 
          to="/admin/invitations" 
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Users size={18} />
          <span>Visitor Directory</span>
        </NavLink>

        {/* Gate Terminal: Visible ONLY to authorized Guard (arenesha20@gmail.com) and Admin */}
        {isAuthorizedGuardOrAdmin && (
          <NavLink 
            to="/gate" 
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <ShieldAlert size={18} />
            <span>Gate Terminal</span>
          </NavLink>
        )}

        <NavLink 
          to="/admin/history" 
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <History size={18} />
          <span>Audit Logs</span>
        </NavLink>
      </div>

      {/* Location Footer */}
      <div className="sidebar-footer">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 12px',
          background: '#FFFBEB',
          borderRadius: '10px',
          border: '1px solid #FEF3C7'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D97706',
            flexShrink: 0
          }}>
            <Building2 size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Meenakshi Tech Park
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>
              Gachibowli, Hyderabad
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
