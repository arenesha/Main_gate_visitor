import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ShieldCheck, UserPlus, ListOrdered, ShieldAlert, History } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">
          <ShieldCheck size={28} className="text-indigo-400" color="#6366F1" />
          <span>GATE PASS</span>
          <span className="nav-brand-badge">SECURE</span>
        </Link>

        <ul className="nav-links">
          <li>
            <NavLink to="/admin/invitations/create" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <UserPlus size={18} />
              <span>Create Invitation</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/invitations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <ListOrdered size={18} />
              <span>Directory</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/gate" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ShieldAlert size={18} />
              <span>Gate Terminal</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <History size={18} />
              <span>Audit Log</span>
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  );
}
