import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

export default function StatusBadge({ status }) {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return (
        <span className="badge badge-active">
          <CheckCircle2 size={13} /> Active Valid
        </span>
      );
    case 'USED':
      return (
        <span className="badge badge-used">
          <CheckCircle2 size={13} /> Entry Used
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="badge badge-expired">
          <Clock size={13} /> Expired
        </span>
      );
    case 'REVOKED':
      return (
        <span className="badge badge-revoked">
          <XCircle size={13} /> Revoked
        </span>
      );
    case 'PENDING_START':
      return (
        <span className="badge badge-expired">
          <Clock size={13} /> Not Yet Active
        </span>
      );
    default:
      return <span className="badge badge-used">{status || 'UNKNOWN'}</span>;
  }
}
