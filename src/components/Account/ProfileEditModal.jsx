// src/components/Account/ProfileEditModal.jsx — NEXT-GEN FULL-SCREEN EDITION
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader, Save, User, FileText, Check, AlertCircle, Camera } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import uploadService from '../../services/upload/uploadService';

/* ─────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────── */
const HEADER_H  = 56;   // px — adjust to match your MobileHeader height
const BOTTOM_H  = 68;   // px — adjust to match your MobileBottomNav height

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

  const [errors,    setErrors]    = useState({});
  const [touched,   setTouched]   = useState({});
  const fileRef     = useRef(null);
  const scrollRef   = useRef(null);

  /* Lock body scroll while modal is open */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Field helpers ── */
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev  => ({ ...prev, [field]: true  }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const e = {};
    if (!formData.fullName.trim())              e.fullName = 'Full name is required';
    if (!formData.username.trim())              e.username = 'Username is required';
    else if (formData.username.length < 3)      e.username = 'At least 3 characters';
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
      ...prev,
      avatarFile:    file,
      avatarPreview: ev.target.result,
    }));
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!formData.avatarFile) return null;
    try {
      setUploading(true);
      const result = await uploadService.uploadAvatar(formData.avatarFile, userId);
      return result;
    } finally {
      setUploading(false);
    }
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

  /* ── Derived ── */
  const bioLen     = formData.bio.length;
  const bioWarn    = bioLen > 130;
  const bioOver    = bioLen > 160;
  const initials   = formData.fullName?.charAt(0)?.toUpperCase() || 'U';

  return (
    <>
      <style>{CSS(HEADER_H, BOTTOM_H)}</style>

      {/* ── Full-screen shell ── */}
      <div className="pe-shell">

        {/* Ambient background orbs */}
        <div className="pe-orb pe-orb-1" />
        <div className="pe-orb pe-orb-2" />
        <div className="pe-orb pe-orb-3" />

        {/* ── Sticky top bar ── */}
        <div className="pe-topbar">
          <button className="pe-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
          <span className="pe-topbar-title">Edit Profile</span>
          <button
            className={`pe-save-pill${saving || uploading ? ' loading' : ''}${saved ? ' done' : ''}`}
            onClick={handleSubmit}
            disabled={saving || uploading}
          >
            {saved ? (
              <><Check size={14} /> Saved</>
            ) : saving ? (
              <><Loader size={14} className="spin" /> Saving…</>
            ) : (
              <><Save size={14} /> Save</>
            )}
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="pe-scroll" ref={scrollRef}>

          {/* Avatar hero */}
          <div className="pe-avatar-hero">
            <div className="pe-avatar-ring">
              <div className="pe-avatar-wrap">
                {formData.avatarPreview
                  ? <img src={formData.avatarPreview} alt="Avatar" className="pe-avatar-img" />
                  : <span className="pe-avatar-initial">{initials}</span>
                }
                {uploading && (
                  <div className="pe-avatar-uploading">
                    <Loader size={22} className="spin" />
                  </div>
                )}
              </div>
              {/* Camera button */}
              <button
                className="pe-cam-btn"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || saving}
                aria-label="Change avatar"
              >
                {uploading ? <Loader size={14} className="spin" /> : <Camera size={14} />}
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              style={{ display: 'none' }}
            />

            <p className="pe-avatar-hint">
              {formData.avatarFile ? formData.avatarFile.name : 'Tap camera to change photo'}
            </p>
          </div>

          {/* ── Fields ── */}
          <div className="pe-fields">

            {/* Full Name */}
            <Field
              label="Full Name"
              icon={<User size={13} />}
              error={errors.fullName}
              touched={touched.fullName}
            >
              <input
                className={`pe-input${errors.fullName ? ' err' : touched.fullName && !errors.fullName ? ' ok' : ''}`}
                type="text"
                value={formData.fullName}
                onChange={e => handleChange('fullName', e.target.value)}
                placeholder="Your full name"
                maxLength={50}
              />
            </Field>

            {/* Username */}
            <Field
              label="Username"
              icon={<span className="pe-at">@</span>}
              error={errors.username}
              touched={touched.username}
              hint="Lowercase letters, numbers, underscores"
            >
              <input
                className={`pe-input mono${errors.username ? ' err' : touched.username && !errors.username ? ' ok' : ''}`}
                type="text"
                value={formData.username}
                onChange={e => handleChange('username', e.target.value.toLowerCase())}
                placeholder="your_username"
                maxLength={30}
              />
            </Field>

            {/* Bio */}
            <Field
              label="Bio"
              icon={<FileText size={13} />}
              error={errors.bio}
              touched={touched.bio}
            >
              <div className="pe-textarea-wrap">
                <textarea
                  className={`pe-textarea${bioOver ? ' err' : ''}`}
                  value={formData.bio}
                  onChange={e => handleChange('bio', e.target.value)}
                  placeholder="What's your story?"
                  maxLength={165}
                  rows={4}
                />
                <div className={`pe-bio-counter${bioWarn ? (bioOver ? ' over' : ' warn') : ''}`}>
                  <div
                    className="pe-bio-bar"
                    style={{ width: `${Math.min((bioLen / 160) * 100, 100)}%` }}
                  />
                  <span>{bioLen}/160</span>
                </div>
              </div>
            </Field>

          </div>
        </div>

        {/* ── Bottom action bar (sits just above bottom nav) ── */}
        <div className="pe-footer">
          <button className="pe-cancel" onClick={onClose} disabled={saving}>
            Discard
          </button>
          <button
            className={`pe-confirm${saved ? ' done' : ''}`}
            onClick={handleSubmit}
            disabled={saving || uploading}
          >
            {saved ? (
              <><Check size={16} /> Saved!</>
            ) : saving ? (
              <><Loader size={16} className="spin" /> Saving…</>
            ) : (
              <><Save size={16} /> Save Changes</>
            )}
          </button>
        </div>

      </div>
    </>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Field wrapper component
───────────────────────────────────────────────────────────────── */
const Field = ({ label, icon, error, touched, hint, children }) => (
  <div className="pe-field">
    <div className="pe-field-label">
      <span className="pe-field-icon">{icon}</span>
      {label}
      {touched && !error && <span className="pe-ok-dot" />}
    </div>
    {children}
    {error && (
      <div className="pe-field-error">
        <AlertCircle size={11} /> {error}
      </div>
    )}
    {hint && !error && <div className="pe-field-hint">{hint}</div>}
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────────── */
const CSS = (headerH, bottomH) => `
  /* ── Reset & shell ── */
  .pe-shell {
    position: fixed;
    top: ${headerH}px;
    left: 0; right: 0;
    bottom: 58px;
    z-index: 500;
    background: #000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: peSlideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes peSlideUp {
    from { transform: translateY(100%); opacity: 0.4; }
    to   { transform: translateY(0);    opacity: 1;   }
  }

  /* ── Ambient orbs (background atmosphere) ── */
  .pe-orb {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    filter: blur(80px);
  }
  .pe-orb-1 {
    width: 260px; height: 260px;
    top: -80px; right: -60px;
    background: radial-gradient(circle, rgba(132,204,22,0.13) 0%, transparent 70%);
  }
  .pe-orb-2 {
    width: 200px; height: 200px;
    bottom: 80px; left: -60px;
    background: radial-gradient(circle, rgba(101,163,13,0.10) 0%, transparent 70%);
  }
  .pe-orb-3 {
    width: 180px; height: 180px;
    top: 50%; left: 50%;
    transform: translate(-50%,-50%);
    background: radial-gradient(circle, rgba(132,204,22,0.05) 0%, transparent 70%);
  }

  /* ── Top bar ── */
  .pe-topbar {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px 10px;
    border-bottom: 1px solid rgba(132,204,22,0.08);
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(20px);
    flex-shrink: 0;
  }
  .pe-close {
    width: 34px; height: 34px;
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    display: flex; align-items: center; justify-content: center;
    color: #777;
    cursor: pointer;
    transition: color 0.2s, background 0.2s;
  }
  .pe-close:hover { color: #fff; background: rgba(255,255,255,0.08); }
  .pe-topbar-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
  }
  .pe-save-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px;
    border-radius: 20px;
    background: rgba(132,204,22,0.12);
    border: 1px solid rgba(132,204,22,0.25);
    color: #84cc16;
    font-size: 13px; font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pe-save-pill:hover:not(:disabled) {
    background: rgba(132,204,22,0.2);
    border-color: rgba(132,204,22,0.5);
  }
  .pe-save-pill.done {
    background: rgba(132,204,22,0.18);
    border-color: #84cc16;
  }
  .pe-save-pill:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Scroll area ── */
  .pe-scroll {
    flex: 1;
    overflow-y: auto;
    position: relative;
    z-index: 1;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 8px;
  }
  .pe-scroll::-webkit-scrollbar { width: 3px; }
  .pe-scroll::-webkit-scrollbar-track { background: transparent; }
  .pe-scroll::-webkit-scrollbar-thumb {
    background: rgba(132,204,22,0.2);
    border-radius: 2px;
  }

  /* ── Avatar hero ── */
  .pe-avatar-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 20px 20px;
    position: relative;
  }
  .pe-avatar-ring {
    position: relative;
    width: 104px; height: 104px;
    margin-bottom: 12px;
  }
  /* Subtle spinning ring around avatar */
  .pe-avatar-ring::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      transparent 0%,
      rgba(132,204,22,0.6) 20%,
      rgba(132,204,22,0.8) 40%,
      rgba(132,204,22,0.6) 60%,
      transparent 80%
    );
    animation: peRingSpin 4s linear infinite;
  }
  .pe-avatar-ring::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    background: #000;
  }
  @keyframes peRingSpin {
    to { transform: rotate(360deg); }
  }
  .pe-avatar-wrap {
    position: relative;
    z-index: 1;
    width: 104px; height: 104px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a2e00 0%, #0d1700 100%);
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid rgba(132,204,22,0.3);
  }
  .pe-avatar-img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .pe-avatar-initial {
    font-size: 40px;
    font-weight: 800;
    color: #84cc16;
    line-height: 1;
    letter-spacing: -1px;
  }
  .pe-avatar-uploading {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    color: #84cc16;
    border-radius: 50%;
  }

  /* Camera button — orbits avatar, bottom-right */
  .pe-cam-btn {
    position: absolute;
    bottom: 2px; right: 2px;
    z-index: 2;
    width: 30px; height: 30px;
    border-radius: 50%;
    background: #84cc16;
    border: 2px solid #000;
    display: flex; align-items: center; justify-content: center;
    color: #000;
    cursor: pointer;
    transition: transform 0.2s, background 0.2s;
  }
  .pe-cam-btn:hover:not(:disabled) {
    transform: scale(1.1);
    background: #a3e635;
  }
  .pe-cam-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .pe-avatar-hint {
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    text-align: center;
    letter-spacing: 0.03em;
    margin: 0;
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Divider line ── */
  .pe-fields {
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
  }
  .pe-fields::before {
    content: '';
    display: block;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(132,204,22,0.15) 30%,
      rgba(132,204,22,0.15) 70%,
      transparent 100%
    );
    margin-bottom: 20px;
  }

  /* ── Field card ── */
  .pe-field {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 14px;
    padding: 12px 14px 14px;
    margin-bottom: 10px;
    transition: border-color 0.2s;
  }
  .pe-field:focus-within {
    border-color: rgba(132,204,22,0.25);
    background: rgba(132,204,22,0.02);
  }

  .pe-field-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    margin-bottom: 8px;
  }
  .pe-field-icon {
    display: flex;
    align-items: center;
    color: rgba(132,204,22,0.6);
  }
  .pe-at {
    font-size: 13px;
    font-weight: 700;
    color: rgba(132,204,22,0.6);
    line-height: 1;
  }
  .pe-ok-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #84cc16;
    box-shadow: 0 0 6px rgba(132,204,22,0.8);
    margin-left: auto;
  }

  /* ── Inputs ── */
  .pe-input {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    padding: 4px 0 8px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
    caret-color: #84cc16;
  }
  .pe-input::placeholder { color: rgba(255,255,255,0.2); font-weight: 400; }
  .pe-input:focus        { border-bottom-color: rgba(132,204,22,0.5); }
  .pe-input.ok           { border-bottom-color: rgba(132,204,22,0.3); }
  .pe-input.err          { border-bottom-color: rgba(239,68,68,0.5); }
  .pe-input.mono         { font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; font-size: 15px; }

  /* ── Textarea ── */
  .pe-textarea-wrap {
    position: relative;
  }
  .pe-textarea {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    color: #fff;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.6;
    padding: 4px 0 32px;
    outline: none;
    resize: none;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 0.2s;
    caret-color: #84cc16;
  }
  .pe-textarea::placeholder { color: rgba(255,255,255,0.2); }
  .pe-textarea:focus         { border-bottom-color: rgba(132,204,22,0.5); }
  .pe-textarea.err           { border-bottom-color: rgba(239,68,68,0.5); }

  /* Bio counter with animated bar */
  .pe-bio-counter {
    position: absolute;
    bottom: 8px; left: 0; right: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pe-bio-bar {
    flex: 1;
    height: 2px;
    background: rgba(132,204,22,0.3);
    border-radius: 1px;
    transition: width 0.2s, background 0.2s;
  }
  .pe-bio-counter.warn .pe-bio-bar { background: rgba(245,158,11,0.6); }
  .pe-bio-counter.over .pe-bio-bar { background: rgba(239,68,68,0.7); width: 100% !important; }
  .pe-bio-counter span {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: rgba(255,255,255,0.25);
    transition: color 0.2s;
    flex-shrink: 0;
  }
  .pe-bio-counter.warn span { color: rgba(245,158,11,0.8); }
  .pe-bio-counter.over span { color: rgba(239,68,68,0.9); }

  /* ── Error / hint text ── */
  .pe-field-error {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #ef4444;
    margin-top: 7px;
    font-weight: 500;
  }
  .pe-field-hint {
    font-size: 11px;
    color: rgba(255,255,255,0.2);
    margin-top: 6px;
    letter-spacing: 0.02em;
  }

  /* ── Footer ── */
  .pe-footer {
    display: flex;
    gap: 10px;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom,0px));
    border-top: 1px solid rgba(255,255,255,0.05);
    background: rgba(0,0,0,0.9);
    backdrop-filter: blur(20px);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
  }
  .pe-cancel {
    flex: 0 0 auto;
    padding: 12px 20px;
    border-radius: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.4);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pe-cancel:hover:not(:disabled) {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.6);
  }
  .pe-confirm {
    flex: 1;
    padding: 12px 20px;
    border-radius: 12px;
    background: linear-gradient(135deg, #84cc16 0%, #4d7c0f 100%);
    border: none;
    color: #000;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    transition: all 0.25s;
    box-shadow: 0 4px 20px rgba(132,204,22,0.25);
    letter-spacing: 0.01em;
  }
  .pe-confirm:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 28px rgba(132,204,22,0.4);
  }
  .pe-confirm:active:not(:disabled) { transform: scale(0.97); }
  .pe-confirm:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .pe-confirm.done {
    background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
    box-shadow: 0 4px 20px rgba(34,197,94,0.35);
  }

  /* ── Spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.8s linear infinite; }

  /* ── Tiny screen tweaks ── */
  @media (max-width: 360px) {
    .pe-avatar-ring { width: 88px; height: 88px; }
    .pe-avatar-wrap { width: 88px; height: 88px; }
    .pe-avatar-initial { font-size: 34px; }
    .pe-fields { padding: 0 12px 12px; }
    .pe-footer  { padding: 8px 12px calc(8px + env(safe-area-inset-bottom,0px)); }
  }
`;

export default ProfileEditModal;