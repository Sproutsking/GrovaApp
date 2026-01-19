// src/components/Modals/PhoneVerificationModal.jsx
import React, { useState } from 'react';
import { Phone, Loader, Check } from 'lucide-react';
import { supabase } from '../../services/config/supabase';

const PhoneVerificationModal = ({ show, onClose, userId, currentPhone, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const formatPhoneNumber = (value) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const sendVerificationCode = async () => {
    try {
      setLoading(true);
      setError('');

      // Extract digits only
      const phoneDigits = newPhone.replace(/\D/g, '');

      // Validate phone number (basic validation)
      if (phoneDigits.length < 10) {
        throw new Error('Please enter a valid phone number');
      }

      if (currentPhone && phoneDigits === currentPhone.replace(/\D/g, '')) {
        throw new Error('New phone must be different from current phone');
      }

      // Generate 6-digit code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Save to database
      const { error: dbError } = await supabase
        .from('verification_codes')
        .insert({
          user_id: userId,
          phone: phoneDigits,
          code_hash: verificationCode,
          code_type: 'phone_verify',
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          attempts: 0,
          verified: false
        });

      if (dbError) throw dbError;

      // In production, send SMS via Twilio/similar
      console.log('📱 SMS verification code:', verificationCode);
      console.log('Send to:', phoneDigits);

      setStep(2);
      setResendCooldown(60);
      
      // Countdown timer
      const interval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Send verification error:', err);
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    try {
      setLoading(true);
      setError('');

      if (code.length !== 6) {
        throw new Error('Please enter a 6-digit code');
      }

      const phoneDigits = newPhone.replace(/\D/g, '');

      // Fetch the verification code
      const { data, error: fetchError } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('phone', phoneDigits)
        .eq('code_type', 'phone_verify')
        .eq('verified', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !data) {
        throw new Error('Invalid or expired verification code');
      }

      // Check attempts
      if (data.attempts >= 5) {
        throw new Error('Too many failed attempts. Please request a new code.');
      }

      // Verify code
      if (data.code_hash !== code) {
        // Increment attempts
        await supabase
          .from('verification_codes')
          .update({ attempts: (data.attempts || 0) + 1 })
          .eq('id', data.id);

        throw new Error(`Invalid code. ${5 - (data.attempts || 0) - 1} attempts remaining.`);
      }

      // Mark as verified
      await supabase
        .from('verification_codes')
        .update({ verified: true })
        .eq('id', data.id);

      // Update phone in profiles
      await supabase
        .from('profiles')
        .update({ 
          phone: phoneDigits,
          phone_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Log security event
      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: 'phone_verified',
        severity: 'info',
        metadata: { 
          phone: phoneDigits,
          action: currentPhone ? 'phone_changed' : 'phone_added'
        }
      });

      onSuccess(currentPhone ? 'Phone number updated successfully!' : 'Phone number added successfully!');
      handleClose();
      
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setNewPhone('');
    setCode('');
    setError('');
    setResendCooldown(0);
    onClose();
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
      }} onClick={handleClose}>
        <div style={{
          background: '#1a1a1a',
          border: '1px solid rgba(132, 204, 22, 0.3)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '450px'
        }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: '1px solid rgba(132, 204, 22, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Phone size={20} style={{ color: '#84cc16' }} />
              {currentPhone ? 'Change Phone Number' : 'Add Phone Number'}
            </h2>
            <button onClick={handleClose} style={{
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
                {currentPhone && (
                  <div style={{
                    background: 'rgba(132, 204, 22, 0.1)',
                    border: '1px solid rgba(132, 204, 22, 0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '20px'
                  }}>
                    <p style={{ color: '#a3a3a3', fontSize: '13px', margin: 0 }}>
                      Current phone: <strong style={{ color: '#84cc16' }}>{currentPhone}</strong>
                    </p>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
                    Phone Number:
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={e => setNewPhone(formatPhoneNumber(e.target.value))}
                    placeholder="(555) 123-4567"
                    autoFocus
                    maxLength="14"
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(132, 204, 22, 0.2)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace'
                    }}
                  />
                  <p style={{ color: '#737373', fontSize: '12px', marginTop: '6px' }}>
                    Enter your phone number with area code
                  </p>
                </div>

                {error && (
                  <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
                    {error}
                  </p>
                )}

                <button
                  onClick={sendVerificationCode}
                  disabled={loading || newPhone.replace(/\D/g, '').length < 10}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: loading || newPhone.replace(/\D/g, '').length < 10 ? '#333' : 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: loading || newPhone.replace(/\D/g, '').length < 10 ? '#666' : '#000',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: loading || newPhone.replace(/\D/g, '').length < 10 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Phone size={18} />
                      Send SMS Code
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <p style={{ color: '#a3a3a3', marginBottom: '24px', fontSize: '14px', lineHeight: '1.5' }}>
                  We've sent a 6-digit verification code via SMS to:<br />
                  <strong style={{ color: '#84cc16' }}>{newPhone}</strong>
                </p>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
                    Enter SMS Code:
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(132, 204, 22, 0.2)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '20px',
                      textAlign: 'center',
                      letterSpacing: '10px',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {error && (
                  <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
                    {error}
                  </p>
                )}

                <button
                  onClick={verifyCode}
                  disabled={loading || code.length !== 6}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: loading || code.length !== 6 ? '#333' : 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: loading || code.length !== 6 ? '#666' : '#000',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer',
                    marginBottom: '12px',
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
                      Verify Code
                    </>
                  )}
                </button>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'transparent',
                      border: '1px solid rgba(132, 204, 22, 0.3)',
                      borderRadius: '8px',
                      color: '#84cc16',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    Change Number
                  </button>

                  <button
                    onClick={sendVerificationCode}
                    disabled={resendCooldown > 0}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'transparent',
                      border: '1px solid rgba(132, 204, 22, 0.3)',
                      borderRadius: '8px',
                      color: resendCooldown > 0 ? '#666' : '#84cc16',
                      fontSize: '14px',
                      cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                  </button>
                </div>

                <p style={{ color: '#737373', fontSize: '12px', marginTop: '16px', textAlign: 'center' }}>
                  Code expires in 10 minutes
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PhoneVerificationModal;