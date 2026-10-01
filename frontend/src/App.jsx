import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import AdminCreateInvitation from './pages/AdminCreateInvitation';
import AdminInvitationList from './pages/AdminInvitationList';
import PublicInvitationPass from './pages/PublicInvitationPass';
import GateVerification from './pages/GateVerification';
import VerificationHistory from './pages/VerificationHistory';
import AdminSlotAnalytics from './pages/AdminSlotAnalytics';
import MeetRoboBooking from './pages/MeetRoboBooking';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

export default function App() {
  const location = useLocation();
  const { user } = useAuth();

  const isPublicPass = location.pathname.startsWith('/invitation/');
  const isLogout = location.pathname === '/logout';
  const isMeetRoboPage = location.pathname === '/' || location.pathname === '/booking' || location.pathname === '/meet-robo';

  if (isLogout) {
    logout();
    return <Navigate to="/" replace />;
  }

  // 1. If viewing standalone public visitor pass
  if (isPublicPass) {
    return (
      <div style={{ minHeight: '100vh', padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Routes>
          <Route path="/invitation/:id" element={<PublicInvitationPass />} />
        </Routes>
      </div>
    );
  }

  // 2. If viewing the main Public "Meet Robo" AI Education Summit page
  if (isMeetRoboPage) {
    return (
      <Routes>
        <Route path="/" element={<MeetRoboBooking />} />
        <Route path="/booking" element={<MeetRoboBooking />} />
        <Route path="/meet-robo" element={<MeetRoboBooking />} />
      </Routes>
    );
  }

  // 3. Protected Operations & Security Gate Shell
  return (
    <ProtectedRoute>
      <div className="app-shell">
        <Sidebar />
        <div className="main-wrapper">
          <Header />
          <main className="page-content">
            <Routes>
              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/slots" element={<AdminSlotAnalytics />} />
              <Route path="/admin/invitations/create" element={<AdminCreateInvitation />} />
              <Route path="/admin/invitations" element={<AdminInvitationList />} />
              <Route path="/gate" element={<GateVerification />} />
              <Route path="/admin/history" element={<VerificationHistory />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
