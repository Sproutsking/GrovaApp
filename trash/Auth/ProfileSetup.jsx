// ============================================================================
// src/components/Auth/ProfileSetup.jsx
//
// CRITICAL FIX: Uses direct supabase import — NOT authService.supabase
// Different webpack module instances caused session failures.
// ============================================================================

import React, { useState } from "react";
import { User, Camera, Loader2 } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import "./ProfileSetup.css";

export default function ProfileSetup({ user, onComplete }) {
  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name || "",
  );
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [usernameError, setUsernameError] = useState(null);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const validateUsername = (value) => {
    if (!value) return "Username is required.";
    if (value.length < 3) return "Username must be at least 3 characters.";
    if (value.length > 30) return "Username must be under 30 characters.";
    if (!/^[a-zA-Z0-9_]+$/.test(value))
      return "Only letters, numbers, and underscores.";
    return null;
  };

  const handleUsernameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
    setUsername(val);
    setUsernameError(null);
  };

  const handleSubmit = async () => {
    const nameClean = fullName.trim();
    const usernameClean = username.trim().toLowerCase();

    if (!nameClean) {
      setError("Please enter your name.");
      return;
    }

    const uErr = validateUsername(usernameClean);
    if (uErr) {
      setUsernameError(uErr);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Check username uniqueness
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", usernameClean)
        .neq("id", user?.id)
        .maybeSingle();

      if (existing) {
        setUsernameError("This username is already taken.");
        setSaving(false);
        return;
      }

      // Upload avatar (non-blocking — profile creation succeeds even without it)
      let avatarId = null;
      if (avatar && user?.id) {
        try {
          const ext = avatar.name.split(".").pop() || "jpg";
          const path = `avatars/${user.id}/profile.${ext}`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("user-uploads")
            .upload(path, avatar, { upsert: true });
          if (!uploadErr && uploadData?.path) avatarId = uploadData.path;
        } catch {
          // Avatar upload failed — continue without it
          console.warn("[ProfileSetup] Avatar upload failed, continuing.");
        }
      }

      // Update profile
      const updates = {
        full_name: nameClean,
        username: usernameClean,
        updated_at: new Date().toISOString(),
        ...(avatarId ? { avatar_id: avatarId } : {}),
      };

      const { error: updateErr } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user?.id);

      if (updateErr) throw updateErr;

      onComplete?.();
    } catch (err) {
      console.error("[ProfileSetup] Error:", err);
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-setup-container">
      <div className="profile-setup-card">
        <div className="profile-setup-header">
          <h1>Set Up Your Profile</h1>
          <p>Tell us about yourself</p>
        </div>

        {/* Avatar */}
        <div className="avatar-upload-section">
          <div className="avatar-preview">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="avatar-image" />
            ) : (
              <div className="avatar-placeholder">
                <User size={40} />
              </div>
            )}
            <label className="avatar-upload-btn" htmlFor="avatar-input">
              <Camera size={16} />
            </label>
            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Full Name */}
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            className="form-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            maxLength={60}
          />
        </div>

        {/* Username */}
        <div className="form-group">
          <label className="form-label">Username</label>
          <div className="username-input-wrapper">
            <span className="username-prefix">@</span>
            <input
              type="text"
              className={`form-input username-input ${usernameError ? "error" : ""}`}
              value={username}
              onChange={handleUsernameChange}
              placeholder="yourhandle"
              maxLength={30}
            />
          </div>
          {usernameError && <p className="field-error">{usernameError}</p>}
        </div>

        {error && <p className="form-error">{error}</p>}

        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={saving || !fullName.trim() || !username.trim()}
        >
          {saving ? (
            <>
              <Loader2 size={18} className="spin" /> Saving...
            </>
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </div>
  );
}
