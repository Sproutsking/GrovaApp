// src/components/Modals/TwoFactorSetup.jsx
import React, { useState, useEffect } from 'react';
import authService from '../../services/auth/authService';
import QRCode from 'qrcode';

const TwoFactorSetup = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    setup2FA();
  }, []);

  const setup2FA = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();
      const setup = await authService.enable2FA(user.email);

      setSecret(setup.secret);
      setBackupCodes(setup.backupCodes);

      const qr = await QRCode.toDataURL(setup.qrCodeUrl);
      setQrCode(qr);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setLoading(true);
      setError('');

      await authService.verify2FASetup(verificationCode);
      setStep(3);
    } catch (err) {
      setError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleComplete = () => {
    onSuccess && onSuccess();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔐 Enable Two-Factor Authentication</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ minHeight: '400px' }}>
          {loading && step === 1 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner"></div>
              <p>Setting up 2FA...</p>
            </div>
          ) : (
            <>
              {/* Step 1: Scan QR Code */}
              {step === 1 && (
                <div className="setup-step">
                  <div className="step-header">
                    <div className="step-number">1</div>
                    <h3>Scan QR Code</h3>
                  </div>

                  <p style={{ marginBottom: '20px', color: '#999' }}>
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>

                  {qrCode && (
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <img src={qrCode} alt="QR Code" style={{ maxWidth: '200px' }} />
                    </div>
                  )}

                  <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    <p style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
                      Or enter this code manually:
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <code style={{ flex: 1, background: '#000', padding: '10px', borderRadius: '4px', fontSize: '14px' }}>
                        {secret}
                      </code>
                      <button onClick={copySecret} className="btn-secondary" style={{ padding: '8px 12px' }}>
                        {copiedSecret ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <button onClick={() => setStep(2)} className="btn-primary" style={{ width: '100%' }}>
                    Continue
                  </button>
                </div>
              )}

              {/* Step 2: Verify Code */}
              {step === 2 && (
                <div className="setup-step">
                  <div className="step-header">
                    <div className="step-number">2</div>
                    <h3>Verify Setup</h3>
                  </div>

                  <p style={{ marginBottom: '20px', color: '#999' }}>
                    Enter the 6-digit code from your authenticator app to verify setup.
                  </p>

                  <input
                    type="text"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    style={{
                      width: '100%',
                      padding: '15px',
                      fontSize: '24px',
                      textAlign: 'center',
                      letterSpacing: '10px',
                      marginBottom: '15px',
                      background: '#1a1a1a',
                      border: '2px solid #333',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    autoFocus
                  />

                  {error && (
                    <div className="error-message" style={{ marginBottom: '15px' }}>
                      {error}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setStep(1)} className="btn-secondary" style={{ flex: 1 }}>
                      Back
                    </button>
                    <button
                      onClick={handleVerify}
                      disabled={verificationCode.length !== 6 || loading}
                      className="btn-primary"
                      style={{ flex: 1 }}
                    >
                      {loading ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Backup Codes */}
              {step === 3 && (
                <div className="setup-step">
                  <div className="step-header">
                    <div className="step-number">✓</div>
                    <h3>Save Backup Codes</h3>
                  </div>

                  <div className="success-message" style={{ marginBottom: '20px' }}>
                    ✅ Two-factor authentication enabled successfully!
                  </div>

                  <p style={{ marginBottom: '15px', color: '#999' }}>
                    Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
                  </p>

                  <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                      {backupCodes.map((code, index) => (
                        <code key={index} style={{ background: '#000', padding: '8px', borderRadius: '4px', fontSize: '14px', textAlign: 'center' }}>
                          {code}
                        </code>
                      ))}
                    </div>

                    <button onClick={copyBackupCodes} className="btn-secondary" style={{ width: '100%' }}>
                      {copiedCodes ? '✓ Copied to Clipboard' : '📋 Copy All Codes'}
                    </button>
                  </div>

                  <div style={{ background: '#332200', border: '1px solid #665500', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    <p style={{ fontSize: '14px', color: '#ffcc00', margin: 0 }}>
                      ⚠️ Each backup code can only be used once. Keep them safe!
                    </p>
                  </div>

                  <button onClick={handleComplete} className="btn-primary" style={{ width: '100%' }}>
                    Done
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .setup-step {
          animation: slideIn 0.3s ease;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }

        .step-number {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #84cc16, #65a30d);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
          color: #000;
        }

        .step-header h3 {
          margin: 0;
          font-size: 20px;
          color: #fff;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .success-message {
          background: #003320;
          border: 1px solid #00aa55;
          color: #00ff88;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          font-weight: 600;
        }

        .error-message {
          background: #330000;
          border: 1px solid #aa0000;
          color: #ff5555;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default TwoFactorSetup;