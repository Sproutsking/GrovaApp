// src/components/Account/ProfileEditModal.jsx — DYNAMIC LAYOUT EDITION
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader, Save, User, FileText, Check, AlertCircle, Camera, Sparkles } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import uploadService from '../../services/upload/uploadService';

const HEADER_H     = 56;
const BOTTOM_H_MOB = 58;

/* ─────────────────────────────────────────────────────────────────
   measureLayout — reads actual rendered sidebar positions from DOM
   so the panel always snaps pixel-perfect between both sidebars.
───────────────────────────────────────────────────────────────── */
function measureLayout() {
  const vw = window.innerWidth;

  // Left sidebar — matches .sidebar (user) or .xv-sidebar (admin)
  const leftEl =
    document.querySelector('.sidebar')    ||
    document.querySelector('.xv-sidebar') ||
    document.querySelector('[class*="sidebar"i]:not([class*="trending"i]):not([class*="right"i])');

  // Right sidebar — .trending-sidebar
  const rightEl =
    document.querySelector('.trending-sidebar') ||
    document.querySelector('[class*="trending-sidebar"i]');

  const left  = leftEl  ? Math.round(leftEl.getBoundingClientRect().right) : 0;
  const right = rightEl ? Math.round(vw - rightEl.getBoundingClientRect().left) : 0;

  return { left, right };
}

/* ─────────────────────────────────────────────────────────────────
   ProfileEditModal
───────────────────────────────────────────────────────────────── */
const ProfileEditModal = ({ userId, currentProfile, onClose, onSuccess }) => {
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved,     setSaved]     = useState(false);

  const [formData, setFormData] = useState({
    fullName:      currentProfile?.fullName || '',
    username:      currentProfile?.username || '',
    bio:           currentProfile?.bio      || '',
    avatarPreview: currentProfile?.avatar   || null,
    avatarFile:    null,
    avatarId:      null,
  });

  const [errors,      setErrors]      = useState({});
  const [touched,     setTouched]     = useState({});
  const [panelEdges,  setPanelEdges]  = useState({ left: 0, right: 0 });
  const fileRef = useRef(null);

  const recalc = useCallback(() => {
    setPanelEdges(measureLayout());
  }, []);

  /* Lock body scroll + measure sidebars */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    recalc();
    const t1 = setTimeout(recalc, 50);   // after first paint
    const t2 = setTimeout(recalc, 200);  // after any lazy render

    window.addEventListener('resize', recalc);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', recalc);
    };
  }, [recalc]);

  /* ── Field helpers ── */
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev  => ({ ...prev, [field]: true  }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const e = {};
    if (!formData.fullName.trim())         e.fullName = 'Full name is required';
    if (!formData.username.trim())         e.username = 'Username is required';
    else if (formData.username.length < 3) e.username = 'At least 3 characters';
    else if (!/^[a-z0-9_]+$/.test(formData.username))
      e.username = 'Lowercase letters, numbers, underscores only';
    if (formData.bio && formData.bio.length > 160) e.bio = 'Max 160 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Avatar ── */
  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please upload an image file'); return; }
    if (file.size > 5 * 1024 * 1024)    { alert('Image must be less than 5 MB');  return; }
    const reader = new FileReader();
    reader.onload = (ev) => setFormData(prev => ({
      ...prev, avatarFile: file, avatarPreview: ev.target.result,
    }));
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!formData.avatarFile) return null;
    try {
      setUploading(true);
      return await uploadService.uploadAvatar(formData.avatarFile, userId);
    } finally { setUploading(false); }
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setSaving(true);

      if (formData.username !== currentProfile?.username) {
        const { data: existingUser } = await supabase
          .from('profiles').select('id')
          .eq('username', formData.username).neq('id', userId).maybeSingle();
        if (existingUser) { setErrors({ username: 'Username already taken' }); return; }
      }

      const updateData = {
        full_name:  formData.fullName,
        username:   formData.username,
        bio:        formData.bio || null,
        updated_at: new Date().toISOString(),
      };

      if (formData.avatarFile) {
        try {
          const avatarId = await uploadAvatar();
          if (avatarId) updateData.avatar_id = avatarId;
        } catch { alert('Avatar upload failed, other changes will still be saved'); }
      }

      const { error } = await supabase
        .from('profiles').update(updateData).eq('id', userId);
      if (error) throw error;

      setSaved(true);
      setTimeout(() => {
        const updatedProfile = {
          fullName: formData.fullName,
          username: formData.username,
          bio:      formData.bio,
          avatar:   updateData.avatar_id
            ? uploadService.getImageUrl(updateData.avatar_id, { width: 400, height: 400, crop: 'fill', gravity: 'face' })
            : currentProfile?.avatar,
          avatarId: updateData.avatar_id || currentProfile?.avatarId,
        };
        if (onSuccess) onSuccess(updatedProfile);
        onClose();
      }, 900);
    } catch (err) {
      alert(`Failed to update profile: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const bioLen   = formData.bio.length;
  const bioWarn  = bioLen > 130;
  const bioOver  = bioLen > 160;
  const initials = formData.fullName?.charAt(0)?.toUpperCase() || 'U';

  /* Build panel inline style — dynamic so it always matches real sidebars */
  const isMobile = window.innerWidth <= 768;
  const dynamicPanelStyle = isMobile
    ? {
        left:   0,
        right:  0,
        top:    `${HEADER_H}px`,
        bottom: `${BOTTOM_H_MOB}px`,
      }
    : {
        left:   `${panelEdges.left}px`,
        right:  `${panelEdges.right}px`,
        top:    `${HEADER_H}px`,
        bottom: 0,
      };

  return (
    <>
      <style>{STYLES}</style>

      {/* Backdrop */}
      <div className="pem-backdrop" onClick={onClose} />

      {/* Panel — positioned dynamically between real sidebars */}
      <div
        className="pem-panel"
        style={dynamicPanelStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Edit Profile"
      >
        {/* Decorative corner accents */}
        <div className="pem-corner-tl" />
        <div className="pem-corner-br" />

        {/* ── Header ── */}
        <div className="pem-header">
          <div className="pem-header-left">
            <div className="pem-header-icon">
              <Sparkles size={13} />
            </div>
            <div>
              <div className="pem-header-title">Edit Profile</div>
              <div className="pem-header-sub">@{formData.username || 'your_username'}</div>
            </div>
          </div>
          <div className="pem-header-actions">
            <button
              className={`pem-save-btn${saved ? ' done' : ''}${saving || uploading ? ' loading' : ''}`}
              onClick={handleSubmit}
              disabled={saving || uploading}
            >
              {saved     ? <><Check  size={13} />Saved</>      :
               saving    ? <><Loader size={13} className="spin" />Saving…</> :
                           <><Save   size={13} />Save Changes</>}
            </button>
            <button className="pem-close-btn" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="pem-body">

          {/* Avatar hero */}
          <div className="pem-avatar-section">
            <div className="pem-avatar-outer">
              <div className="pem-avatar-ring-spin" />
              <div className="pem-avatar-ring-mask" />
              <div className="pem-avatar-wrap">
                {formData.avatarPreview
                  ? <img src={formData.avatarPreview} alt="Avatar" className="pem-avatar-img" />
                  : <span className="pem-avatar-initial">{initials}</span>
                }
                {uploading && (
                  <div className="pem-avatar-overlay">
                    <Loader size={20} className="spin" />
                  </div>
                )}
              </div>
              <button
                className="pem-cam-btn"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || saving}
                aria-label="Change avatar"
              >
                {uploading ? <Loader size={12} className="spin" /> : <Camera size={12} />}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
            <p className="pem-avatar-hint">
              {formData.avatarFile ? formData.avatarFile.name : 'Click camera icon to change photo · max 5 MB'}
            </p>
          </div>

          {/* Section label */}
          <div className="pem-divider"><span>Profile Details</span></div>

          {/* Fields */}
          <div className="pem-fields">

            <div className="pem-row-2">
              <FieldGroup label="Full Name" icon={<User size={11} />} error={errors.fullName} touched={touched.fullName}>
                <input
                  className={`pem-input${errors.fullName ? ' err' : touched.fullName && !errors.fullName ? ' ok' : ''}`}
                  type="text"
                  value={formData.fullName}
                  onChange={e => handleChange('fullName', e.target.value)}
                  placeholder="Your full name"
                  maxLength={50}
                />
              </FieldGroup>

              <FieldGroup label="Username" icon={<span className="pem-at">@</span>} error={errors.username} touched={touched.username} hint="Lowercase, numbers & underscores">
                <input
                  className={`pem-input mono${errors.username ? ' err' : touched.username && !errors.username ? ' ok' : ''}`}
                  type="text"
                  value={formData.username}
                  onChange={e => handleChange('username', e.target.value.toLowerCase())}
                  placeholder="your_username"
                  maxLength={30}
                />
              </FieldGroup>
            </div>

            <FieldGroup label="Bio" icon={<FileText size={11} />} error={errors.bio} touched={touched.bio}>
              <div className="pem-textarea-wrap">
                <textarea
                  className={`pem-textarea${bioOver ? ' err' : ''}`}
                  value={formData.bio}
                  onChange={e => handleChange('bio', e.target.value)}
                  placeholder="What's your story? Tell the world a bit about yourself…"
                  maxLength={165}
                  rows={3}
                />
                <div className={`pem-bio-counter${bioWarn ? (bioOver ? ' over' : ' warn') : ''}`}>
                  <div className="pem-bio-bar-track">
                    <div className="pem-bio-bar-fill" style={{ width: `${Math.min((bioLen / 160) * 100, 100)}%` }} />
                  </div>
                  <span className="pem-bio-num">{bioLen}<span className="pem-bio-max">/160</span></span>
                </div>
              </div>
            </FieldGroup>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pem-footer">
          <button className="pem-discard-btn" onClick={onClose} disabled={saving}>
            Discard Changes
          </button>
          <button
            className={`pem-confirm-btn${saved ? ' done' : ''}`}
            onClick={handleSubmit}
            disabled={saving || uploading}
          >
            {saved     ? <><Check  size={15} />Profile Saved!</>       :
             saving    ? <><Loader size={15} className="spin" />Saving…</> :
                         <><Save   size={15} />Save Changes</>}
          </button>
        </div>

      </div>
    </>
  );
};

/* ─────────────────────────────────────────────────────────────────
   FieldGroup
───────────────────────────────────────────────────────────────── */
const FieldGroup = ({ label, icon, error, touched, hint, children }) => (
  <div className={`pem-field${error ? ' has-error' : touched && !error ? ' is-valid' : ''}`}>
    <label className="pem-label">
      <span className="pem-label-icon">{icon}</span>
      {label}
      {touched && !error && <span className="pem-valid-pip" />}
    </label>
    {children}
    {error && <p className="pem-error"><AlertCircle size={10} />{error}</p>}
    {hint && !error && <p className="pem-hint">{hint}</p>}
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   Styles — panel position is driven by inline style, not CSS,
   so these rules handle appearance only.
───────────────────────────────────────────────────────────────── */
const STYLES = `
  /* Backdrop */
  .pem-backdrop {
    position: fixed;
    inset: 0;
    z-index: 490;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    animation: pemFadeIn 0.2s ease both;
  }
  @keyframes pemFadeIn { from { opacity: 0; } to { opacity: 1; } }

  /* Panel shell — position set via inline style from JS */
  .pem-panel {
    position: fixed;
    z-index: 500;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: linear-gradient(160deg, #0e0e0e 0%, #111 60%, #0c0c0c 100%);
    border-left:  1px solid rgba(132, 204, 22, 0.14);
    border-right: 1px solid rgba(132, 204, 22, 0.14);
    animation: pemSlideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes pemSlideUp {
    from { transform: translateY(28px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  /* Corner accents */
  .pem-corner-tl, .pem-corner-br {
    position: absolute;
    width: 52px; height: 52px;
    pointer-events: none;
    z-index: 0;
  }
  .pem-corner-tl {
    top: 0; left: 0;
    border-top:  2px solid rgba(132, 204, 22, 0.45);
    border-left: 2px solid rgba(132, 204, 22, 0.45);
  }
  .pem-corner-br {
    bottom: 0; right: 0;
    border-bottom: 2px solid rgba(132, 204, 22, 0.45);
    border-right:  2px solid rgba(132, 204, 22, 0.45);
  }

  /* ── Header ── */
  .pem-header {
    position: relative; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(10, 10, 10, 0.92);
    flex-shrink: 0;
  }
  .pem-header::after {
    content: '';
    position: absolute;
    bottom: -1px; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg,
      transparent 0%, rgba(132,204,22,0.3) 30%,
      rgba(132,204,22,0.3) 70%, transparent 100%
    );
  }
  .pem-header-left { display: flex; align-items: center; gap: 11px; }
  .pem-header-icon {
    width: 30px; height: 30px; border-radius: 8px;
    background: rgba(132,204,22,0.12);
    border: 1px solid rgba(132,204,22,0.28);
    display: flex; align-items: center; justify-content: center;
    color: #84cc16; flex-shrink: 0;
  }
  .pem-header-title { font-size: 14px; font-weight: 800; color: #f0f0f0; letter-spacing: 0.02em; line-height: 1; }
  .pem-header-sub   { font-size: 11px; color: #505050; font-family: 'SF Mono','Fira Code',monospace; margin-top: 3px; line-height: 1; }

  .pem-header-actions { display: flex; align-items: center; gap: 8px; }
  .pem-save-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 15px; border-radius: 8px;
    background: rgba(132,204,22,0.12);
    border: 1px solid rgba(132,204,22,0.28);
    color: #84cc16; font-size: 12px; font-weight: 700;
    cursor: pointer; transition: all 0.2s; letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .pem-save-btn:hover:not(:disabled) {
    background: rgba(132,204,22,0.2);
    border-color: rgba(132,204,22,0.5);
    box-shadow: 0 0 12px rgba(132,204,22,0.18);
  }
  .pem-save-btn.done { background: rgba(132,204,22,0.2); border-color: #84cc16; }
  .pem-save-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .pem-close-btn {
    width: 30px; height: 30px; border-radius: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center;
    color: #666; cursor: pointer; transition: all 0.18s;
  }
  .pem-close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2); }

  /* ── Body ── */
  .pem-body {
    flex: 1; overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    position: relative; z-index: 1;
  }
  .pem-body::-webkit-scrollbar { width: 3px; }
  .pem-body::-webkit-scrollbar-track { background: transparent; }
  .pem-body::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.22); border-radius: 2px; }

  /* ── Avatar section ── */
  .pem-avatar-section {
    display: flex; flex-direction: column; align-items: center;
    padding: 30px 24px 22px;
    background: linear-gradient(180deg, rgba(132,204,22,0.04) 0%, transparent 100%);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    position: relative; overflow: hidden;
  }
  .pem-avatar-section::before {
    content: '';
    position: absolute;
    top: -30px; left: 50%; transform: translateX(-50%);
    width: 240px; height: 200px;
    background: radial-gradient(circle, rgba(132,204,22,0.07) 0%, transparent 65%);
    pointer-events: none;
  }

  .pem-avatar-outer { position: relative; width: 112px; height: 112px; flex-shrink: 0; margin-bottom: 14px; }
  .pem-avatar-ring-spin {
    position: absolute; inset: -4px; border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      transparent 0%, rgba(132,204,22,0.7) 18%,
      rgba(163,230,53,0.9) 36%, rgba(132,204,22,0.7) 54%,
      transparent 72%
    );
    animation: pem-ring-spin 3.5s linear infinite; z-index: 0;
  }
  .pem-avatar-ring-mask {
    position: absolute; inset: -2px; border-radius: 50%;
    background: #0e0e0e; z-index: 1;
  }
  @keyframes pem-ring-spin { to { transform: rotate(360deg); } }
  .pem-avatar-wrap {
    position: absolute; inset: 0; z-index: 2;
    border-radius: 50%; overflow: hidden;
    background: linear-gradient(135deg, #1c2d00 0%, #0a1400 100%);
    display: flex; align-items: center; justify-content: center;
    border: 2px solid rgba(132,204,22,0.4);
  }
  .pem-avatar-img    { width: 100%; height: 100%; object-fit: cover; }
  .pem-avatar-initial { font-size: 44px; font-weight: 900; color: #84cc16; line-height: 1; letter-spacing: -2px; }
  .pem-avatar-overlay {
    position: absolute; inset: 0; border-radius: 50%;
    background: rgba(0,0,0,0.65);
    display: flex; align-items: center; justify-content: center;
    color: #84cc16;
  }
  .pem-cam-btn {
    position: absolute; bottom: 2px; right: 2px; z-index: 3;
    width: 28px; height: 28px; border-radius: 50%;
    background: #84cc16; border: 2.5px solid #0e0e0e;
    display: flex; align-items: center; justify-content: center;
    color: #000; cursor: pointer;
    transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
    box-shadow: 0 2px 10px rgba(132,204,22,0.45);
  }
  .pem-cam-btn:hover:not(:disabled) { transform: scale(1.12); background: #a3e635; box-shadow: 0 4px 16px rgba(132,204,22,0.65); }
  .pem-cam-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .pem-avatar-hint {
    font-size: 11px; color: rgba(255,255,255,0.22);
    text-align: center; margin: 0; max-width: 280px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    letter-spacing: 0.02em;
  }

  /* ── Section divider ── */
  .pem-divider { display: flex; align-items: center; gap: 12px; padding: 18px 22px 0; margin-bottom: 4px; }
  .pem-divider::before, .pem-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
  .pem-divider span { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(255,255,255,0.26); white-space: nowrap; }

  /* ── Fields ── */
  .pem-fields { padding: 12px 22px 22px; display: flex; flex-direction: column; gap: 12px; }
  .pem-row-2  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .pem-field {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 12px 14px 14px;
    transition: border-color 0.2s, background 0.2s;
  }
  .pem-field:focus-within { border-color: rgba(132,204,22,0.3); background: rgba(132,204,22,0.025); }
  .pem-field.is-valid   { border-color: rgba(132,204,22,0.18); }
  .pem-field.has-error  { border-color: rgba(239,68,68,0.3); }

  .pem-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: rgba(255,255,255,0.3); margin-bottom: 9px;
  }
  .pem-label-icon { color: rgba(132,204,22,0.6); display: flex; align-items: center; }
  .pem-at { font-size: 12px; font-weight: 800; color: rgba(132,204,22,0.6); line-height: 1; }
  .pem-valid-pip { width: 5px; height: 5px; border-radius: 50%; background: #84cc16; box-shadow: 0 0 6px rgba(132,204,22,0.9); margin-left: auto; }

  .pem-input {
    width: 100%; background: transparent; border: none;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    color: #f0f0f0; font-size: 15px; font-weight: 500;
    padding: 3px 0 7px; outline: none; box-sizing: border-box;
    transition: border-color 0.2s; caret-color: #84cc16;
  }
  .pem-input::placeholder { color: rgba(255,255,255,0.18); font-weight: 400; }
  .pem-input:focus { border-bottom-color: rgba(132,204,22,0.55); }
  .pem-input.ok   { border-bottom-color: rgba(132,204,22,0.3); }
  .pem-input.err  { border-bottom-color: rgba(239,68,68,0.55); }
  .pem-input.mono { font-family: 'SF Mono','Fira Code','Courier New',monospace; font-size: 14px; letter-spacing: 0.02em; }

  .pem-textarea-wrap { position: relative; }
  .pem-textarea {
    width: 100%; background: transparent; border: none;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    color: #f0f0f0; font-size: 14px; font-weight: 400;
    line-height: 1.65; padding: 3px 0 34px; outline: none; resize: none;
    box-sizing: border-box; font-family: inherit;
    transition: border-color 0.2s; caret-color: #84cc16;
  }
  .pem-textarea::placeholder { color: rgba(255,255,255,0.18); }
  .pem-textarea:focus { border-bottom-color: rgba(132,204,22,0.55); }
  .pem-textarea.err  { border-bottom-color: rgba(239,68,68,0.55); }

  .pem-bio-counter { position: absolute; bottom: 9px; left: 0; right: 0; display: flex; align-items: center; gap: 10px; }
  .pem-bio-bar-track { flex: 1; height: 2px; background: rgba(255,255,255,0.07); border-radius: 1px; overflow: hidden; }
  .pem-bio-bar-fill  { height: 100%; background: rgba(132,204,22,0.5); border-radius: 1px; transition: width 0.18s, background 0.2s; }
  .pem-bio-counter.warn .pem-bio-bar-fill { background: rgba(245,158,11,0.7); }
  .pem-bio-counter.over .pem-bio-bar-fill { background: rgba(239,68,68,0.8); width: 100% !important; }
  .pem-bio-num  { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.26); flex-shrink: 0; letter-spacing: 0.03em; transition: color 0.2s; }
  .pem-bio-max  { opacity: 0.55; }
  .pem-bio-counter.warn .pem-bio-num { color: rgba(245,158,11,0.85); }
  .pem-bio-counter.over .pem-bio-num { color: rgba(239,68,68,0.95); }

  .pem-error { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; color: #ef4444; margin: 7px 0 0; }
  .pem-hint  { font-size: 10.5px; color: rgba(255,255,255,0.2); margin: 6px 0 0; letter-spacing: 0.02em; }

  /* ── Footer ── */
  .pem-footer {
    display: flex; gap: 10px;
    padding: 12px 22px calc(12px + env(safe-area-inset-bottom,0px));
    border-top: 1px solid rgba(255,255,255,0.07);
    background: rgba(8,8,8,0.95);
    flex-shrink: 0; position: relative; z-index: 10;
  }
  .pem-footer::before {
    content: ''; position: absolute; top: -1px; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(132,204,22,0.18) 30%, rgba(132,204,22,0.18) 70%, transparent 100%);
  }
  .pem-discard-btn {
    padding: 11px 20px; border-radius: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.36); font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.18s; white-space: nowrap; flex-shrink: 0;
  }
  .pem-discard-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.18); }
  .pem-confirm-btn {
    flex: 1; padding: 11px 20px; border-radius: 10px;
    background: linear-gradient(135deg, #84cc16 0%, #4d7c0f 100%);
    border: none; color: #000; font-size: 13px; font-weight: 800;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;
    transition: all 0.22s; box-shadow: 0 4px 18px rgba(132,204,22,0.28); letter-spacing: 0.01em;
  }
  .pem-confirm-btn:hover:not(:disabled)  { transform: translateY(-1px); box-shadow: 0 7px 26px rgba(132,204,22,0.42); }
  .pem-confirm-btn:active:not(:disabled) { transform: scale(0.97); }
  .pem-confirm-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
  .pem-confirm-btn.done { background: linear-gradient(135deg, #22c55e 0%, #15803d 100%); box-shadow: 0 4px 18px rgba(34,197,94,0.38); }

  /* Responsive — only for mobile layout where inline style still uses these */
  @media (max-width: 600px) {
    .pem-row-2 { grid-template-columns: 1fr; }
    .pem-header { padding: 11px 14px; }
    .pem-fields { padding: 10px 14px 18px; }
    .pem-divider { padding: 14px 14px 0; }
    .pem-footer  { padding: 10px 14px calc(10px + env(safe-area-inset-bottom,0px)); }
    .pem-avatar-section { padding: 22px 14px 16px; }
    .pem-save-btn span { display: none; }
  }

  /* Spinner */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.75s linear infinite; display: inline-flex; }
`;

export default ProfileEditModal;