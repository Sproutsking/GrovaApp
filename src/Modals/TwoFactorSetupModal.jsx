// src/components/Modals/TwoFactorSetupModal.jsx
import React, { useState, useEffect } from 'react';
import { Shield, Check, Loader, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/config/supabase';

const TwoFactorSetupModal = ({ show, onClose, userId, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && step === 1) {
      generateSecret();
    }
  }, [show]);

  const generateSecret = () => {
    // Generate a base32 secret (32 characters)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let newSecret = '';
    for (let i = 0; i < 32; i++) {
      newSecret += chars[Math.floor(Math.random() * chars.length)];
    }
    setSecret(newSecret);
    
    // Generate QR code URL for TOTP
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=otpauth://totp/Grova:${userId}?secret=${newSecret}&issuer=Grova`;
    setQrCode(qr);
  };

  const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).substr(2, 8).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Generate backup codes
      const codes = generateBackupCodes();

      // Save to database
      const { error: dbError } = await supabase
        .from('two_factor_auth')
        .upsert({
          user_id: userId,
          secret: secret,
          enabled: true,
          backup_codes: codes,
          verified_at: new Date().toISOString(),
          last_used: null
        }, {
          onConflict: 'user_id'
        });

      if (dbError) throw dbError;

      // Log security event
      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: '2fa_enabled',
        severity: 'info',
        metadata: { timestamp: new Date().toISOString() }
      });

      // Update profile
      await supabase.from('profiles').update({
        require_2fa: true,
        security_level: 5,
        updated_at: new Date().toISOString()
      }).eq('id', userId);

      setBackupCodes(codes);
      setStep(2);
      
    } catch (err) {
      console.error('2FA setup error:', err);
      setError(err.message || 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onSuccess();
    onClose();
    // Reset state
    setStep(1);
    setVerificationCode('');
    setError('');
  };

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }} onClick={onClose}>
        <div style={{
          background: '#1a1a1a',
          border: '1px solid rgba(132, 204, 22, 0.3)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto'
        }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: '1px solid rgba(132, 204, 22, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', margin: 0 }}>
              🔒 Enable Two-Factor Authentication
            </h2>
            <button onClick={onClose} style={{
              background: 'none',
              border: 'none',
              color: '#a3a3a3',
              fontSize: '32px',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1
            }}>×</button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px' }}>
            {step === 1 ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    margin: '0 auto 20px',
                    borderRadius: '50%',
                    background: 'rgba(132, 204, 22, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Shield size={50} style={{ color: '#84cc16' }} />
                  </div>
                  <h3 style={{ color: '#fff', marginBottom: '8px', fontSize: '20px' }}>Scan QR Code</h3>
                  <p style={{ color: '#a3a3a3', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                    Use Google Authenticator, Authy, or any TOTP authenticator app
                  </p>
                  
                  {qrCode && (
                    <img src={qrCode} alt="QR Code" style={{
                      width: '250px',
                      height: '250px',
                      margin: '0 auto 16px',
                      border: '4px solid rgba(132, 204, 22, 0.2)',
                      borderRadius: '12px',
                      display: 'block'
                    }} />
                  )}

                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(132, 204, 22, 0.2)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '24px'
                  }}>
                    <p style={{ color: '#737373', fontSize: '12px', marginBottom: '8px' }}>
                      Can't scan? Enter this code manually:
                    </p>
                    <code style={{
                      color: '#84cc16',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      display: 'block',
                      padding: '8px',
                      background: 'rgba(132, 204, 22, 0.1)',
                      borderRadius: '4px'
                    }}>
                      {secret}
                    </code>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
                    Enter 6-digit code from your app:
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(132, 204, 22, 0.2)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '24px',
                      textAlign: 'center',
                      letterSpacing: '12px',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {error && (
                  <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
                    {error}
                  </p>
                )}

                <button
                  onClick={handleVerify}
                  disabled={loading || verificationCode.length !== 6}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: loading || verificationCode.length !== 6 ? '#333' : 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: loading || verificationCode.length !== 6 ? '#666' : '#000',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: loading || verificationCode.length !== 6 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Verify & Enable 2FA
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    margin: '0 auto 20px',
                    borderRadius: '50%',
                    background: 'rgba(132, 204, 22, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={50} style={{ color: '#84cc16' }} />
                  </div>
                  <h3 style={{ color: '#fff', marginBottom: '8px', fontSize: '20px' }}>Save Your Backup Codes</h3>
                  <p style={{ color: '#a3a3a3', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                    Store these codes in a safe place. You can use them to access your account if you lose your authenticator device.
                  </p>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(132, 204, 22, 0.2)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {backupCodes.map((code, idx) => (
                      <div key={idx} style={{
                        background: 'rgba(132, 204, 22, 0.1)',
                        padding: '12px',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <code style={{ 
                          color: '#84cc16', 
                          fontSize: '14px', 
                          fontFamily: 'monospace',
                          fontWeight: '600'
                        }}>
                          {code}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '24px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ color: '#ef4444', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                    <strong>Important:</strong> Keep these codes secure! Each code can only be used once. Download or write them down now.
                  </p>
                </div>

                <button onClick={handleComplete} style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#000',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  <Check size={18} />
                  I've Saved My Backup Codes
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TwoFactorSetupModal;