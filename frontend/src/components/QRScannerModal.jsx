import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';

export default function QRScannerModal({ isOpen, onClose, onScanSuccess, onUseOtpFallback }) {
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const qrRegionId = 'qr-reader-target';
    let html5QrCode = null;

    const startScanner = async () => {
      try {
        setError(null);
        html5QrCode = new Html5Qrcode(qrRegionId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Read QR -> immediately stop camera -> notify parent
            if (scannerRef.current) {
              scannerRef.current.stop().catch(() => {}).then(() => {
                scannerRef.current = null;
                onScanSuccess(decodedText);
              });
            }
          },
          () => {
            // ignore scan frame tick
          }
        );
        setIsScanning(true);
      } catch (err) {
        console.error('Camera initialization error:', err);
        setError('Camera permission denied or camera device is unavailable. You can use the 6-Digit OTP Fallback.');
      }
    };

    const timer = setTimeout(startScanner, 200);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).then(() => {
          scannerRef.current = null;
        });
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-card" style={{ maxWidth: '460px', width: '100%', position: 'relative', background: '#FFFFFF', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>Live QR Scanner</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>Real Optical Camera Detection</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '20px' }}>
          {error ? (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              padding: '16px',
              borderRadius: '12px',
              color: '#DC2626',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              margin: '10px 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontWeight: 800, margin: 0, fontSize: '0.92rem' }}>Camera Access Denied or Unavailable</p>
                  <p style={{ fontSize: '0.82rem', margin: '4px 0 0', color: '#B91C1C' }}>{error}</p>
                </div>
              </div>

              {onUseOtpFallback && (
                <button
                  onClick={() => {
                    onClose();
                    onUseOtpFallback();
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ background: '#1E3E47', border: 'none', color: '#FFF', width: '100%', gap: '8px', padding: '10px' }}
                >
                  <KeyRound size={16} />
                  <span>Switch to 6-Digit OTP Fallback</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              <div 
                id="qr-reader-target" 
                style={{ 
                  width: '100%', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  backgroundColor: '#000',
                  minHeight: '280px'
                }}
              />
              <p style={{ textAlign: 'center', color: '#64748B', fontSize: '0.82rem', margin: '14px 0 0' }}>
                Position the visitor's QR code within the frame to validate.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '14px 20px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {onUseOtpFallback && (
            <button 
              onClick={() => {
                onClose();
                onUseOtpFallback();
              }}
              style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              Use 6-Digit OTP Instead
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
