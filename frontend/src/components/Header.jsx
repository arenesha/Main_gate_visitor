import React from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function Header() {
  const location = useLocation();

  const getBreadcrumb = () => {
    switch (location.pathname) {
      case '/':
        return { section: 'Overview', title: 'Dashboard' };
      case '/booking':
        return { section: 'Booking', title: 'Student Slot Booking (Razorpay)' };
      case '/admin/slots':
        return { section: 'Analytics', title: 'Slot Bookings & Revenue' };
      case '/admin/invitations/create':
        return { section: 'Operations', title: 'Issue Visitor Pass' };
      case '/admin/invitations':
        return { section: 'Records', title: 'Visitor Directory' };
      case '/gate':
        return { section: 'Security', title: 'Guard Gate Terminal' };
      case '/admin/history':
        return { section: 'Audit', title: 'Verification Logs' };
      default:
        if (location.pathname.startsWith('/invitation/')) return { section: 'Pass', title: 'Visitor Pass' };
        return { section: 'Portal', title: 'AreneSHA GatePass' };
    }
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      {/* Breadcrumb Path */}
      <div className="header-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
          <span style={{ color: '#64748B', fontWeight: 600 }}>{breadcrumb.section}</span>
          <ChevronRight size={14} color="#94A3B8" />
          <h2 className="page-title" style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            {breadcrumb.title}
          </h2>
        </div>
      </div>
    </header>
  );
}

