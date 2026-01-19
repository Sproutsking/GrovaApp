// src/components/Account/ProfileEditModal.jsx - FIXED TO USE CLOUDINARY
import React, { useState } from 'react';
import { X, Upload, Loader, Save, User, FileText } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import uploadService from '../../services/upload/uploadService';

const ProfileEditModal = ({ userId, currentProfile, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: currentProfile?.fullName || '',
    username: currentProfile?.username || '',
    bio: currentProfile?.bio || '',
    avatarPreview: currentProfile?.avatar || null,
    avatarFile: null,
    avatarId: null // Will store Cloudinary public_id
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain lowercase letters, numbers, and underscores';
    }

    if (formData.bio && formData.bio.length > 160) {
      newErrors.bio = 'Bio must be 160 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({
        ...prev,
        avatarFile: file,
        avatarPreview: e.target.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!formData.avatarFile) return null;

    try {
      setUploading(true);
      console.log('📤 Uploading avatar to Cloudinary...');

      // Upload to Cloudinary using uploadService
      const result = await uploadService.uploadAvatar(formData.avatarFile, userId);
      
      console.log('✅ Avatar uploaded:', result);
      return result; // Returns the Cloudinary public_id

    } catch (error) {
      console.error('❌ Avatar upload failed:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      // Check if username is taken (if changed)
      if (formData.username !== currentProfile?.username) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', formData.username)
          .neq('id', userId)
          .maybeSingle();

        if (existingUser) {
          setErrors({ username: 'Username is already taken' });
          setSaving(false);
          return;
        }
      }

      // Prepare base update data
      const updateData = {
        full_name: formData.fullName,
        username: formData.username,
        bio: formData.bio || null,
        updated_at: new Date().toISOString()
      };

      // Upload avatar if new file was selected
      if (formData.avatarFile) {
        try {
          const avatarId = await uploadAvatar();
          if (avatarId) {
            updateData.avatar_id = avatarId; // Store Cloudinary public_id
            console.log('✅ Avatar ID to save:', avatarId);
          }
        } catch (uploadError) {
          console.error('Avatar upload failed:', uploadError);
          alert('Avatar upload failed, but other changes will be saved');
        }
      }

      console.log('📝 Updating profile with:', updateData);

      // Update profile in Supabase
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('❌ Profile update error:', error);
        throw error;
      }

      console.log('✅ Profile updated successfully');

      // Build updated profile object
      const updatedProfile = {
        fullName: formData.fullName,
        username: formData.username,
        bio: formData.bio,
        avatar: updateData.avatar_id 
          ? uploadService.getImageUrl(updateData.avatar_id, {
              width: 400,
              height: 400,
              crop: 'fill',
              gravity: 'face'
            })
          : currentProfile?.avatar,
        avatarId: updateData.avatar_id || currentProfile?.avatarId
      };

      if (onSuccess) onSuccess(updatedProfile);
      onClose();

    } catch (error) {
      console.error('❌ Profile update failed:', error);
      alert(`Failed to update profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{`
        .profile-edit-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(20px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .profile-edit-modal {
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @media (max-width: 768px) {
          .profile-edit-modal {
            width: 100%;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
          }
        }

        .profile-edit-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.05);
        }

        .profile-edit-title {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .modal-close-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #84cc16;
        }

        .profile-edit-content {
          padding: 24px;
          max-height: calc(90vh - 160px);
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .profile-edit-content {
            max-height: calc(100vh - 160px);
          }
        }

        .avatar-upload-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 32px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 16px;
        }

        .avatar-preview {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: 800;
          color: #000;
          margin-bottom: 16px;
          border: 4px solid rgba(132, 204, 22, 0.3);
          overflow: hidden;
          position: relative;
        }

        .avatar-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-upload-btn {
          position: relative;
          padding: 12px 24px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 12px;
          color: #000;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s;
        }

        .avatar-upload-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.4);
        }

        .avatar-upload-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .avatar-upload-btn input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        .form-field {
          margin-bottom: 24px;
        }

        .form-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #a3a3a3;
          margin-bottom: 8px;
        }

        .form-label-icon {
          color: #84cc16;
        }

        .form-input, .form-textarea {
          width: 100%;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-family: inherit;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .form-input:focus, .form-textarea:focus {
          outline: none;
          border-color: #84cc16;
          background: rgba(132, 204, 22, 0.05);
        }

        .form-textarea {
          min-height: 100px;
          resize: vertical;
        }

        .form-helper {
          font-size: 12px;
          color: #737373;
          margin-top: 6px;
        }

        .form-error {
          font-size: 12px;
          color: #ef4444;
          margin-top: 6px;
        }

        .char-counter {
          font-size: 12px;
          color: #737373;
          text-align: right;
          margin-top: 4px;
        }

        .char-counter.warning {
          color: #f59e0b;
        }

        .char-counter.error {
          color: #ef4444;
        }

        .profile-edit-footer {
          display: flex;
          gap: 12px;
          padding: 20px 24px;
          border-top: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(0, 0, 0, 0.5);
        }

        .cancel-btn, .save-btn {
          flex: 1;
          padding: 14px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s;
          border: none;
        }

        .cancel-btn {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .save-btn {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          color: #000;
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.3);
        }

        .save-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(132, 204, 22, 0.5);
        }

        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .spinner {
          animation: spin 1s linear infinite;
        }
      `}</style>

      <div className="profile-edit-overlay" onClick={onClose}>
        <div className="profile-edit-modal" onClick={(e) => e.stopPropagation()}>
          <div className="profile-edit-header">
            <div className="profile-edit-title">
              <User size={24} />
              Edit Profile
            </div>
            <button className="modal-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="profile-edit-content">
            {/* Avatar Upload */}
            <div className="avatar-upload-section">
              <div className="avatar-preview">
                {formData.avatarPreview ? (
                  <img src={formData.avatarPreview} alt="Avatar" />
                ) : (
                  formData.fullName?.charAt(0)?.toUpperCase() || 'U'
                )}
              </div>
              <label className="avatar-upload-btn">
                {uploading ? (
                  <>
                    <Loader size={18} className="spinner" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Change Avatar
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleAvatarSelect}
                  disabled={uploading || saving}
                />
              </label>
            </div>

            {/* Full Name */}
            <div className="form-field">
              <label className="form-label">
                <User size={16} className="form-label-icon" />
                Full Name *
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="Enter your full name"
                maxLength={50}
              />
              {errors.fullName && <div className="form-error">{errors.fullName}</div>}
            </div>

            {/* Username */}
            <div className="form-field">
              <label className="form-label">
                <User size={16} className="form-label-icon" />
                Username *
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value.toLowerCase())}
                placeholder="your_username"
                maxLength={30}
              />
              {errors.username && <div className="form-error">{errors.username}</div>}
              <div className="form-helper">Only lowercase letters, numbers, and underscores</div>
            </div>

            {/* Bio */}
            <div className="form-field">
              <label className="form-label">
                <FileText size={16} className="form-label-icon" />
                Bio
              </label>
              <textarea
                className="form-textarea"
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="Tell us about yourself..."
                maxLength={160}
              />
              <div className={`char-counter ${formData.bio.length > 140 ? 'warning' : ''} ${formData.bio.length >= 160 ? 'error' : ''}`}>
                {formData.bio.length}/160
              </div>
              {errors.bio && <div className="form-error">{errors.bio}</div>}
            </div>
          </div>

          <div className="profile-edit-footer">
            <button className="cancel-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="save-btn" onClick={handleSubmit} disabled={saving || uploading}>
              {saving ? (
                <>
                  <Loader size={18} className="spinner" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileEditModal;