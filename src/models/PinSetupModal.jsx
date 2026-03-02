// src/components/Modals/PinSetupModal.jsx
// Hybrid PIN setup — 4 | 6 | 8 | 12 digit, handles new + change flows
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Lock, X, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../services/config/supabase';

const PIN_LENGTHS = [
  { n: 4,  label: 'Basic',   desc: 'Simple & fast' },
  { n: 6,  label: 'Standard', desc: 'Recommended' },
  { n: 8,  label: 'Strong',  desc: 'Better security' },
  { n: 12, label: 'Maximum', desc: 'Highest security' },
];

const PinSetupModal = ({ userId, hasPin, currentPinLength, onClose, onSuccess }) => {
  const [step, setStep]         = useState('choose'); // choose | enter
  const [pinLength, setPinLength] = useState(currentPinLength || 6);
  const [phase, setPhase]       = useState(hasPin ? 'old' : 'new'); // old | new | confirm
  const [pins, setPins]         = useState({ old: [], new: [], confirm: [] });
  const [showDigits, setShowDigits] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [step, phase]);

  const active = pins[phase] || [];
  const targetLen = phase === 'old' ? (currentPinLength || pinLength) : pinLength;

  const setActive = (val) => setPins(p => ({ ...p, [phase]: val }));

  const advance = useCallback(async (arr) => {
    if (phase === 'old') {
      setPhase('new');
    } else if (phase === 'new') {
      setPhase('confirm');
    } else {
      await submit(arr);
    }
  }, [phase, pins]);

  const handleDigit = (d) => {
    if (active.length >= targetLen) return;
    const next = [...active, d];
    setActive(next);
    setError('');
    if (next.length === targetLen) setTimeout(() => advance(next), 120);
  };

  const handleDelete = () => setActive(active.slice(0, -1));

  const submit = async (confirmArr) => {
    const newStr     = pins.new.join('');
    const confirmStr = confirmArr.join('');
    const oldStr     = pins.old.join('');

    if (newStr !== confirmStr) {
      setError("PINs don't match — try again");
      setPins(p => ({ ...p, new: [], confirm: [] }));
      setPhase('new');
      return;
    }

    try {
      setLoading(true);
      // Verify old PIN if changing
      if (hasPin) {
        const { data: w } = await supabase.from('wallets')
          .select('withdrawal_pin_hash').eq('user_id', userId).maybeSingle();
        if (w?.withdrawal_pin_hash && w.withdrawal_pin_hash !== btoa(oldStr + userId)) {
          setError('Current PIN is incorrect');
          setPins(p => ({ ...p, old: [] }));
          setPhase('old');
          setLoading(false);
          return;
        }
      }

      const { error: dbErr } = await supabase.from('wallets').update({
        withdrawal_pin_hash: btoa(newStr + userId),
        pin_length: pinLength,
        pin_attempts: 0,
        pin_locked_until: null,
      }).eq('user_id', userId);
      if (dbErr) throw dbErr;

      await supabase.from('security_events').insert({
        user_id: userId, event_type: 'withdrawal_pin_set', severity: 'info',
        metadata: { pin_length: pinLength, timestamp: new Date().toISOString() }
      }).catch(() => {});

      setSuccess(true);
      setTimeout(() => { onSuccess?.({ pinLength }); onClose(); }, 1200);
    } catch (e) {
      setError(e.message || 'Failed to save PIN');
    } finally {
      setLoading(false);
    }
  };

  // Phase labels
  const phaseInfo = {
    old:     { title: 'Current PIN',        sub: 'Verify your identity to continue' },
    new:     { title: `New ${pinLength}-digit PIN`, sub: 'Choose something secure' },
    confirm: { title: 'Confirm PIN',        sub: 'Enter your new PIN again' },
  };
  const { title: phTitle, sub: phSub } = phaseInfo[phase];

  const totalSteps = hasPin ? 3 : 2;
  const stepIdx    = phase === 'old' ? 1 : phase === 'new' ? (hasPin ? 2 : 1) : (hasPin ? 3 : 2);

  if (step === 'choose') return (
    <Shell title={hasPin ? 'Change PIN' : 'Set Transaction PIN'}
           subtitle="Protect all wallet transactions" onClose={onClose}>
      <div style={{ padding: '0 24px 28px' }}>
        <p style={{ color: '#737373', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 1.7 }}>
          Choose your PIN length. More digits = stronger protection.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {PIN_LENGTHS.map(({ n, label, desc }) => (
            <button key={n} onClick={() => setPinLength(n)} style={{
              padding: '18px 12px',
              background: pinLength === n
                ? 'linear-gradient(135deg,rgba(132,204,22,.15),rgba(101,163,13,.08))'
                : 'rgba(255,255,255,0.03)',
              border: `2px solid ${pinLength === n ? '#84cc16' : 'rgba(255,255,255,.08)'}`,
              borderRadius: 16, cursor: 'pointer', transition: 'all .2s',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: pinLength === n ? '#84cc16' : '#fff', lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: pinLength === n ? '#84cc16' : '#a3a3a3', marginTop: 4 }}>{label}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{desc}</div>
              <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 8 }}>
                {Array.from({ length: Math.min(n, 8) }).map((_, i) => (
                  <div key={i} style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: pinLength === n ? '#84cc16' : '#333',
                    transition: 'background .2s'
                  }} />
                ))}
                {n > 8 && <span style={{ fontSize: 8, color: '#555', marginLeft: 2 }}>+{n-8}</span>}
              </div>
            </button>
          ))}
        </div>
        <BtnPrimary onClick={() => setStep('enter')}>
          <Lock size={15} /> Continue with {pinLength}-digit PIN
        </BtnPrimary>
      </div>
    </Shell>
  );

  return (
    <Shell title={phTitle} subtitle={phSub} onClose={onClose}>
      <div style={{ padding: '0 24px 28px' }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 24 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < stepIdx ? '#84cc16' : 'rgba(255,255,255,.08)',
              transition: 'background .3s'
            }} />
          ))}
        </div>

        {/* PIN length badge */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 12px',
            background: 'rgba(132,204,22,.07)', border: '1px solid rgba(132,204,22,.2)',
            borderRadius: 20, fontSize: 10, color: '#84cc16', fontWeight: 800, letterSpacing: '.05em'
          }}>
            <Lock size={9} /> {phase === 'old' ? currentPinLength || pinLength : pinLength}-DIGIT PIN
          </span>
        </div>

        {/* Dot display */}
        <DotRow arr={active} length={targetLen} showDigits={showDigits} />

        {/* Tap-to-focus helper */}
        <input
          ref={inputRef} type="tel" inputMode="numeric" readOnly autoFocus
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
          onKeyDown={e => {
            if (/^[0-9]$/.test(e.key)) handleDigit(e.key);
            if (e.key === 'Backspace') handleDelete();
          }}
        />
        <div onClick={() => inputRef.current?.focus()} style={{
          textAlign: 'center', padding: '8px', cursor: 'text', marginBottom: 12
        }}>
          <span style={{ fontSize: 11, color: '#444' }}>Tap to use keyboard, or use numpad below</span>
        </div>

        {/* Numpad */}
        <Numpad onDigit={handleDigit} onDelete={handleDelete}
          showDigits={showDigits} onToggle={() => setShowDigits(s => !s)} />

        {/* Feedback */}
        {error && !loading && !success && (
          <FeedbackBar type="error" icon={<AlertCircle size={14} />}>{error}</FeedbackBar>
        )}
        {success && (
          <FeedbackBar type="success" icon={<CheckCircle size={14} />}>
            PIN {hasPin ? 'updated' : 'set'} successfully!
          </FeedbackBar>
        )}
        {loading && <LoadingBar />}

        <button onClick={() => setStep('choose')} style={{
          width: '100%', marginTop: 10, padding: '10px',
          background: 'transparent', border: '1px solid rgba(255,255,255,.06)',
          borderRadius: 10, color: '#555', fontSize: 12, cursor: 'pointer', fontWeight: 600
        }}>
          ← Change PIN length
        </button>
      </div>
    </Shell>
  );
};

const DotRow = ({ arr, length, showDigits }) => (
  <div style={{
    display: 'flex', gap: length <= 6 ? 8 : length <= 8 ? 6 : 4,
    justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap',
    maxWidth: 360, margin: '0 auto 20px'
  }}>
    {Array.from({ length }).map((_, i) => {
      const filled = i < arr.length;
      return (
        <div key={i} style={{
          width:  length <= 6 ? 50 : length <= 8 ? 44 : 36,
          height: length <= 6 ? 58 : length <= 8 ? 52 : 44,
          borderRadius: 11,
          background: filled ? 'rgba(132,204,22,.1)' : 'rgba(255,255,255,.03)',
          border: `2px solid ${filled ? 'rgba(132,204,22,.5)' : 'rgba(255,255,255,.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: length <= 6 ? 22 : 18, fontWeight: 800, color: '#fff',
          transform: filled ? 'scale(1.04)' : 'scale(1)',
          boxShadow: filled ? '0 0 0 3px rgba(132,204,22,.08), 0 4px 12px rgba(0,0,0,.3)' : 'none',
          transition: 'all .15s cubic-bezier(.4,0,.2,1)',
        }}>
          {filled ? (showDigits ? arr[i] : '●') : ''}
        </div>
      );
    })}
  </div>
);

const Numpad = ({ onDigit, onDelete, showDigits, onToggle }) => {
  const rows = [['1','2','3'],['4','5','6'],['7','8','9'],['vis','0','del']];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {row.map((k, ki) => {
            if (k === 'vis') return (
              <button key={ki} onClick={onToggle}
                style={nStyle('rgba(20,20,20,1)', 'rgba(255,255,255,.06)')}>
                {showDigits ? <EyeOff size={18} color="#555" /> : <Eye size={18} color="#555" />}
              </button>
            );
            if (k === 'del') return (
              <button key={ki} onClick={onDelete}
                style={nStyle('rgba(20,20,20,1)', 'rgba(255,255,255,.06)')}>
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                  <path d="M7 1H18C19.1 1 20 1.9 20 3V11C20 12.1 19.1 13 18 13H7L1 7L7 1Z"
                    stroke="#666" strokeWidth="1.5"/>
                  <path d="M13 5L9 9M9 5L13 9" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            );
            return (
              <button key={ki} onClick={() => onDigit(k)}
                style={nStyle('rgba(15,15,15,1)', 'rgba(255,255,255,.06)')}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{k}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const nStyle = (bg, border) => ({
  height: 58, borderRadius: 14, background: bg, border: `1px solid ${border}`,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all .15s', WebkitTapHighlightColor: 'transparent', userSelect: 'none',
});

const Shell = ({ title, subtitle, onClose, children }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(16px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10010,
    padding: 20, overflowY: 'auto'
  }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{
      background: 'linear-gradient(145deg,#141414,#0a0a0a)',
      border: '1px solid rgba(132,204,22,.18)',
      borderRadius: 24, width: '100%', maxWidth: 400,
      boxShadow: '0 32px 80px rgba(0,0,0,.8),0 0 0 1px rgba(132,204,22,.04)',
      animation: 'pinUp .3s cubic-bezier(.4,0,.2,1)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg,rgba(132,204,22,.18),rgba(101,163,13,.08))',
            border: '1px solid rgba(132,204,22,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Lock size={18} color="#84cc16" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{title}</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.07)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555'
        }}>
          <X size={14} />
        </button>
      </div>
      {children}
    </div>
    <style>{`@keyframes pinUp{from{opacity:0;transform:translateY(24px)scale(.97)}to{opacity:1;transform:translateY(0)scale(1)}}`}</style>
  </div>
);

const BtnPrimary = ({ onClick, children }) => (
  <button onClick={onClick} style={{
    width: '100%', padding: '15px', borderRadius: 13, border: 'none',
    background: 'linear-gradient(135deg,#84cc16,#65a30d)',
    color: '#000', fontSize: 14, fontWeight: 800, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
  }}>
    {children}
  </button>
);

const FeedbackBar = ({ type, icon, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
    borderRadius: 10, marginTop: 12,
    background: type === 'error' ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.08)',
    border: `1px solid ${type === 'error' ? 'rgba(239,68,68,.25)' : 'rgba(34,197,94,.25)'}`,
    color: type === 'error' ? '#ef4444' : '#22c55e', fontSize: 13, fontWeight: 500
  }}>
    {icon}{children}
  </div>
);

const LoadingBar = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px', color: '#84cc16', fontSize: 13, marginTop: 8
  }}>
    <div style={{
      width: 15, height: 15, borderRadius: '50%',
      border: '2px solid rgba(132,204,22,.2)', borderTopColor: '#84cc16',
      animation: 'pinSpin .7s linear infinite'
    }} />
    Saving PIN...
    <style>{`@keyframes pinSpin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export default PinSetupModal;