// src/components/Modals/RecoveryPhraseModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Copy, CheckCircle, AlertTriangle, Key, RefreshCw } from 'lucide-react';
import { getRecoveryPhrase, createOrGetRecoveryPhrase } from '../../services/security/recoveryPhraseService';

const RecoveryPhraseModal = ({ userId, onClose }) => {
  const [loading, setLoading]   = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [phrase, setPhrase]     = useState(null);
  const [hint, setHint]         = useState('');
  const [createdAt, setCreatedAt] = useState(null);
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState('');
  const [confirming, setConfirming] = useState(false);

  // Load or generate phrase on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const result = await getRecoveryPhrase(userId);
        if (result.phrase) {
          setPhrase(result.phrase);
          setHint(result.hint || '');
          setCreatedAt(result.created_at);
        } else if (result.hint) {
          setHint(result.hint);
          setCreatedAt(result.created_at);
        }
      } catch (e) {
        setError(e.message || 'Failed to load recovery phrase');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const handleReveal = async () => {
    if (!confirming) { setConfirming(true); return; }
    try {
      setLoading(true); setConfirming(false);
      const result = await getRecoveryPhrase(userId);
      setPhrase(result.phrase);
      setHint(result.hint || '');
      setCreatedAt(result.created_at);
      setRevealed(true);
    } catch (e) {
      setError(e.message || 'Failed to reveal phrase');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!phrase) return;
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Copy failed — please select and copy manually');
    }
  };

  const words = phrase ? phrase.split(' ') : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.95)', backdropFilter: 'blur(18px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10010, padding: 20
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(145deg,#161616,#0a0a0a)',
        border: '1px solid rgba(132,204,22,.18)', borderRadius: 24,
        width: '100%', maxWidth: 440,
        boxShadow: '0 32px 80px rgba(0,0,0,.9)',
        animation: 'rp-up .3s cubic-bezier(.4,0,.2,1)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg,rgba(132,204,22,.18),rgba(101,163,13,.08))',
              border: '1px solid rgba(132,204,22,.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Key size={18} color="#84cc16" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Recovery Phrase</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                {createdAt ? `Created ${new Date(createdAt).toLocaleDateString()}` : 'Your 12-word backup'}
              </div>
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

        <div style={{ padding: '20px 24px 28px' }}>
          {/* Warning */}
          <div style={{
            padding: '14px', borderRadius: 12, marginBottom: 20,
            background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
            display: 'flex', gap: 10, alignItems: 'flex-start'
          }}>
            <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#ef4444', margin: 0, lineHeight: 1.7 }}>
              <strong>Never share this phrase with anyone.</strong> Anyone who has it gains full access to your wallet. Store it offline in a safe place.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                width: 32, height: 32, border: '3px solid rgba(132,204,22,.2)',
                borderTopColor: '#84cc16', borderRadius: '50%', animation: 'rp-spin 0.8s linear infinite',
                margin: '0 auto 12px'
              }} />
              <p style={{ color: '#555', fontSize: 13 }}>Loading…</p>
            </div>
          ) : error ? (
            <div style={{
              padding: '14px', borderRadius: 12, background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', fontSize: 13
            }}>{error}</div>
          ) : !revealed ? (
            <>
              {/* Hint */}
              {hint && (
                <div style={{
                  padding: '14px', borderRadius: 12, marginBottom: 16,
                  background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
                  textAlign: 'center'
                }}>
                  <p style={{ fontSize: 11, color: '#555', marginBottom: 6, fontWeight: 600 }}>PHRASE HINT</p>
                  <p style={{ fontSize: 14, color: '#a3a3a3', fontFamily: 'JetBrains Mono,monospace' }}>{hint}</p>
                </div>
              )}

              {confirming ? (
                <>
                  <div style={{
                    padding: '14px', borderRadius: 12, marginBottom: 16,
                    background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)',
                    color: '#fbbf24', fontSize: 13, textAlign: 'center', lineHeight: 1.7
                  }}>
                    Make sure no one is watching your screen. Are you ready to reveal your phrase?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleReveal} style={{
                      flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                      background: 'linear-gradient(135deg,#84cc16,#65a30d)',
                      color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
                    }}>
                      <Eye size={14} /> Yes, Reveal
                    </button>
                    <button onClick={() => setConfirming(false)} style={{
                      flex: 1, padding: '13px', borderRadius: 12,
                      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                      color: '#737373', fontWeight: 700, fontSize: 13, cursor: 'pointer'
                    }}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button onClick={handleReveal} style={{
                  width: '100%', padding: '14px', borderRadius: 13, border: 'none',
                  background: 'linear-gradient(135deg,#84cc16,#65a30d)',
                  color: '#000', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                  <Eye size={15} /> Reveal Recovery Phrase
                </button>
              )}
            </>
          ) : (
            <>
              {/* Word grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18
              }}>
                {words.map((word, i) => (
                  <div key={i} style={{
                    padding: '10px 8px', borderRadius: 10,
                    background: 'rgba(132,204,22,.06)', border: '1px solid rgba(132,204,22,.15)',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    <span style={{ fontSize: 9, color: '#555', fontWeight: 700, minWidth: 14, fontFamily: 'monospace' }}>{i+1}</span>
                    <span style={{ fontSize: 13, color: '#e5e5e5', fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>{word}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button onClick={handleCopy} style={{
                  flex: 1, padding: '12px', borderRadius: 11,
                  background: copied ? 'rgba(34,197,94,.1)' : 'rgba(255,255,255,.05)',
                  border: `1px solid ${copied ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.08)'}`,
                  color: copied ? '#22c55e' : '#a3a3a3',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'all .2s'
                }}>
                  {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Phrase'}
                </button>
                <button onClick={() => setRevealed(false)} style={{
                  padding: '12px 16px', borderRadius: 11,
                  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
                  color: '#555', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <EyeOff size={16} />
                </button>
              </div>

              <div style={{
                padding: '12px', borderRadius: 10,
                background: 'rgba(96,165,250,.06)', border: '1px solid rgba(96,165,250,.15)',
                fontSize: 12, color: '#60a5fa', lineHeight: 1.7
              }}>
                <strong>Write these down</strong> in the exact order shown. Store them somewhere safe offline — never in a text file or screenshot.
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes rp-up{from{opacity:0;transform:translateY(20px)scale(.98)}to{opacity:1;transform:translateY(0)scale(1)}}
        @keyframes rp-spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
};

export default RecoveryPhraseModal;