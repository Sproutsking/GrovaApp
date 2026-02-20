// src/components/Auth/SecureAccount.jsx
import React, { useState } from "react";
import { Shield, Mail, Chrome, Check, Loader2 } from "lucide-react";
import "./SecureAccount.css";

function SecureAccount({ user, onComplete, authService, onSkip }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [backupEmail, setBackupEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("select");

  const methods = [
    {
      id: "google",
      icon: Chrome,
      title: "Link Google Account",
      subtitle: "Sign in with your Google account as backup",
    },
    {
      id: "email",
      icon: Mail,
      title: "Add Backup Email",
      subtitle: "Use a different email address for recovery",
    },
  ];

  const handleMethodSelect = (methodId) => {
    setSelectedMethod(methodId);
    setError("");
    if (methodId === "email") {
      setStep("email");
    } else if (methodId === "google") {
      handleGoogleAuth();
    }
  };

  const handleGoogleAuth = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const { error } = await authService.supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || "Google auth failed");
      setIsSubmitting(false);
      setSelectedMethod(null);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!backupEmail.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupEmail)) {
      setError("Invalid email format");
      return;
    }
    if (user && backupEmail.toLowerCase() === user.email?.toLowerCase()) {
      setError("Backup email must be different from your primary email");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const { error } = await authService.supabase
        .from("profiles")
        .update({
          backup_email: backupEmail.toLowerCase().trim(),
          backup_email_verified: false,
        })
        .eq("id", user.id);

      if (error) throw error;
      onComplete();
    } catch (err) {
      setError(err.message || "Failed to save backup email");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "email") {
    return (
      <div className="secure-account-container">
        <div className="secure-account-content">
          <div className="secure-header">
            <div className="secure-icon">
              <Mail size={32} />
            </div>
            <h2 className="secure-title">Add Backup Email</h2>
            <p className="secure-subtitle">
              This email will help you recover your account
            </p>
          </div>

          <form onSubmit={handleEmailSubmit} className="backup-form">
            <div className="form-group">
              <label className="form-label">Backup Email</label>
              <input
                type="email"
                value={backupEmail}
                onChange={(e) => {
                  setBackupEmail(e.target.value);
                  setError("");
                }}
                placeholder="backup@example.com"
                disabled={isSubmitting}
                className={`form-input ${error ? "error" : ""}`}
                autoFocus
                autoComplete="email"
              />
              {error && <span className="error-text">{error}</span>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="btn-spinner" />
                  Adding...
                </>
              ) : (
                "Continue"
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("select");
                setSelectedMethod(null);
                setError("");
              }}
              disabled={isSubmitting}
              className="back-btn-text"
            >
              Choose different method
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="secure-account-container">
      <div className="secure-account-content">
        <div className="secure-header">
          <div className="secure-icon">
            <Shield size={32} />
          </div>
          <h2 className="secure-title">Secure Your Account</h2>
          <p className="secure-subtitle">
            Add a backup method to protect your account
          </p>
        </div>

        <div className="security-features">
          <div className="feature-item">
            <Check className="feature-check" />
            <span>Recover access if you lose your login</span>
          </div>
          <div className="feature-item">
            <Check className="feature-check" />
            <span>Sign in from multiple devices</span>
          </div>
          <div className="feature-item">
            <Check className="feature-check" />
            <span>Enhanced security protection</span>
          </div>
        </div>

        <div className="method-list">
          {methods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                onClick={() => handleMethodSelect(method.id)}
                disabled={isSubmitting}
                className={`method-card ${isSelected ? "selected" : ""}`}
              >
                <div className="method-icon-wrapper">
                  <Icon className="method-icon" />
                </div>
                <div className="method-info">
                  <div className="method-title">{method.title}</div>
                  <div className="method-subtitle">{method.subtitle}</div>
                </div>
                {isSubmitting && isSelected && (
                  <Loader2 className="method-spinner" />
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p
            style={{
              color: "#ef4444",
              fontSize: "0.8125rem",
              textAlign: "center",
              marginBottom: "12px",
            }}
          >
            {error}
          </p>
        )}

        {onSkip && (
          <button
            className="back-btn-text"
            onClick={onSkip}
            disabled={isSubmitting}
          >
            Skip for now (not recommended)
          </button>
        )}

        <p className="skip-warning">
          ⚠️ Skipping may result in permanent account loss if you forget your
          login
        </p>
      </div>
    </div>
  );
}

export default SecureAccount;