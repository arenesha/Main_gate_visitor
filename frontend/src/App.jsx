import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import AdminCreateInvitation from './pages/AdminCreateInvitation';
import AdminInvitationList from './pages/AdminInvitationList';
import PublicInvitationPass from './pages/PublicInvitationPass';
import GateVerification from './pages/GateVerification';
import VerificationHistory from './pages/VerificationHistory';

export default function App() {
  const location = useLocation();
  const isPublicPass = location.pathname.startsWith('/invitation/');

  // If viewing standalone public pass
  if (isPublicPass) {
    return (
      <div style={{ minHeight: '100vh', padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Routes>
          <Route path="/invitation/:id" element={<PublicInvitationPass />} />
        </Routes>
      </div>
    );
  }

  // Enterprise Application Shell
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/admin/invitations/create" element={<AdminCreateInvitation />} />
            <Route path="/admin/invitations" element={<AdminInvitationList />} />
            <Route path="/gate" element={<GateVerification />} />
            <Route path="/admin/history" element={<VerificationHistory />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
