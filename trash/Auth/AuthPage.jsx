import { ArrowBigLeft } from "lucide-react";
import React, { useState, useCallback, useEffect } from "react";
import authService from "../../services/auth/authService";
import CodeInput from "./CodeInput";
import Toast from "./Toast";
import "./AuthPage.css";

function AuthPage() {
  const [view, setView] = useState("signin");
  const [step, setStep] = useState("form");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [codeDigits, setCodeDigits] = useState(["", "", "", "", "", ""]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "", message: "" });
  const [pendingData, setPendingData] = useState({});
  const [lastSentAt, setLastSentAt] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const COOLDOWN_DURATION = 60000;

  const validateEmail = useCallback(
    (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    [],
  );

  const showToast = useCallback((type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: "", message: "" }), 5000);
  }, []);

  const getMainButtonText = () => {
    if (isSubmitting) {
      if (step === "form") return "Sending Code...";
      if (step === "newpassword") return "Resetting...";
      return "Processing...";
    }

    if (step === "newpassword") return "Reset Password";

    if (view === "recovery") return "Send Recovery Code";

    return view === "signin" ? "Sign in" : "Sign up";
  };

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (view === "signup" && step === "form") {
      if (!formData.name.trim()) newErrors.name = "Full name required";
      if (!formData.email.trim()) newErrors.email = "Email required";
      else if (!validateEmail(formData.email))
        newErrors.email = "Invalid email";
      if (!formData.password) newErrors.password = "Password required";
      else if (formData.password.length < 8)
        newErrors.password = "Min 8 characters";
      else if (!/[A-Z]/.test(formData.password))
        newErrors.password = "Need uppercase";
      else if (!/[a-z]/.test(formData.password))
        newErrors.password = "Need lowercase";
      else if (!/\d/.test(formData.password))
        newErrors.password = "Need number";
      else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password))
        newErrors.password = "Need special char";
      if (formData.password !== formData.confirmPassword)
        newErrors.confirmPassword = "Passwords do not match";
    } else if (view === "signin" && step === "form") {
      if (!formData.email.trim()) newErrors.email = "Email required";
      else if (!validateEmail(formData.email))
        newErrors.email = "Invalid email";
      if (!formData.password) newErrors.password = "Password required";
    } else if (view === "recovery" && step === "form") {
      if (!formData.email.trim()) newErrors.email = "Email required";
      else if (!validateEmail(formData.email))
        newErrors.email = "Invalid email";
    } else if (view === "recovery" && step === "newpassword") {
      if (!formData.newPassword) newErrors.newPassword = "Password required";
      else if (formData.newPassword.length < 8)
        newErrors.newPassword = "Min 8 characters";
      else if (!/[A-Z]/.test(formData.newPassword))
        newErrors.newPassword = "Need uppercase";
      else if (!/[a-z]/.test(formData.newPassword))
        newErrors.newPassword = "Need lowercase";
      else if (!/\d/.test(formData.newPassword))
        newErrors.newPassword = "Need number";
      else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword))
        newErrors.newPassword = "Need special char";
      if (formData.newPassword !== formData.confirmNewPassword)
        newErrors.confirmNewPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [view, step, formData, validateEmail]);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    },
    [errors],
  );

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast("error", "Please fix the errors");
      return;
    }

    setIsSubmitting(true);

    try {
      if (view === "recovery" && step === "form") {
        const result = await authService.initiatePasswordReset(formData.email);

        if (result.success && result.needsVerification) {
          setPendingData({ email: formData.email });
          setStep("code");
          setLastSentAt(Date.now());
          showToast(
            "success",
            "Reset code sent! Check console in development.",
          );
        }
      } else if (view === "signin") {
        const result = await authService.initiateSignin(
          formData.email,
          formData.password,
        );

        if (result.success) {
          setPendingData({
            email: formData.email,
            password: formData.password,
          });
          setStep("code");
          setLastSentAt(Date.now());
          showToast("success", "Code sent! Check console in development.");
        }
      } else if (view === "signup") {
        const result = await authService.initiateSignup(
          formData.email,
          formData.name,
        );

        if (result.success) {
          setPendingData({
            email: formData.email,
            password: formData.password,
            name: formData.name,
          });
          setStep("code");
          setLastSentAt(Date.now());
          showToast("success", "Code sent! Check console in development.");
        }
      }
    } catch (error) {
      console.error("❌ Form submit error:", error);
      showToast("error", error.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async () => {
    const code = codeDigits.join("");

    if (code.length !== 6) {
      showToast("error", "Please enter all 6 digits");
      return;
    }

    setIsSubmitting(true);

    try {
      if (view === "recovery" && step === "code") {
        setStep("newpassword");
        showToast("success", "Code verified! Set your new password.");
      } else if (view === "signin") {
        const result = await authService.completeSignin(
          pendingData.email,
          pendingData.password,
          code,
        );

        if (result.success) {
          showToast("success", "Welcome back!");
          resetForm();
        }
      } else if (view === "signup") {
        const result = await authService.completeSignup(
          pendingData.email,
          pendingData.password,
          pendingData.name,
          code,
        );

        if (result.success) {
          showToast("success", "Account created!");
          resetForm();
        }
      }
    } catch (error) {
      console.error("❌ Code submit error:", error);
      showToast("error", error.message || "Invalid code");
      setCodeDigits(["", "", "", "", "", ""]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewPasswordSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast("error", "Please fix the errors");
      return;
    }

    setIsSubmitting(true);

    try {
      const code = codeDigits.join("");
      const result = await authService.completePasswordReset(
        pendingData.email,
        code,
        formData.newPassword,
      );

      if (result.success) {
        showToast("success", "Password reset! You can now sign in.");
        resetForm();
        setView("signin");
      }
    } catch (error) {
      console.error("❌ Password reset error:", error);
      showToast("error", error.message || "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldownSeconds > 0) return;

    setIsSubmitting(true);
    try {
      const type =
        view === "signup"
          ? "email_verify"
          : view === "signin"
            ? "login"
            : "password_reset";

      await authService.resendVerificationCode(
        pendingData.email,
        pendingData.name || "User",
        type,
      );

      setLastSentAt(Date.now());
      setCodeDigits(["", "", "", "", "", ""]);
      showToast("success", "New code sent! Check console.");
    } catch (error) {
      showToast("error", error.message || "Failed to resend");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep("form");
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });
    setCodeDigits(["", "", "", "", "", ""]);
    setPendingData({});
    setErrors({});
    setLastSentAt(null);
  };

  const handleBackToForm = () => {
    setStep("form");
    setCodeDigits(["", "", "", "", "", ""]);
    setLastSentAt(null);
  };

  useEffect(() => {
    if (!lastSentAt) return;

    const updateTimer = () => {
      const elapsed = Date.now() - lastSentAt;
      const remaining = Math.max(0, COOLDOWN_DURATION - elapsed);
      setCooldownSeconds(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        setLastSentAt(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastSentAt]);

  return (
    <div className="auth-container">
      {toast.show && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast({ show: false, type: "", message: "" })}
        />
      )}

      <div className="bg-overlay">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="grid-pattern"></div>
      </div>

      <div className="content-wrapper">
        <div className="welcome-section">
          <div className="welcome-content">
            <div className="logo-header">
              <div className="logo-icon">
                <svg className="icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8V8.5l8-4.5 8 4.5V12c0 4.41-3.59 8-8 8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h1 className="logo-text">Grova</h1>
            </div>

            {view === "signin" ? (
              <>
                <h2 className="welcome-title">
                  Welcome Back
                  <span className="highlight"> Grova Builder</span>
                </h2>
                <p className="welcome-description">
                  Great to see you again. Jump back into your on-chain world.
                </p>
              </>
            ) : (
              <>
                <h2 className="welcome-title">
                  Join the
                  <span className="highlight"> Grova Revolution</span>
                </h2>
                <p className="welcome-description">
                  Reimagining social on chain. Own your content, gamify
                  engagement.
                </p>
              </>
            )}

            <div className="features-list">
              <div className="feature-item">
                <div className="feature-icon">🎮</div>
                <div className="feature-content">
                  <h3 className="feature-title">Gamified Engagement</h3>
                  <p className="feature-desc">Earn rewards and level up</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔗</div>
                <div className="feature-content">
                  <h3 className="feature-title">On-Chain Ownership</h3>
                  <p className="feature-desc">Your data truly belongs to you</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🛡️</div>
                <div className="feature-content">
                  <h3 className="feature-title">Enterprise Security</h3>
                  <p className="feature-desc">Bank-grade encryption</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-section">
          <div className="auth-card">
            <div className="auth-cardContent">
              <div className="mobile-logo">
                <div className="logo-icon">
                  <svg className="icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8V8.5l8-4.5 8 4.5V12c0 4.41-3.59 8-8 8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h1 className="logo-text-mobile">Grova</h1>
              </div>

              {step === "code" && (
                <div className="email-sent-view fade-in">
                  <div className="success-icon-large">🔐</div>
                  <h2 className="email-sent-title">Enter Verification Code</h2>
                  <p className="email-sent-subtitle">
                    Code sent to <strong>{pendingData.email}</strong>
                  </p>
                  <p className="email-sent-instructions">
                    Check your browser console for the code (in development).
                  </p>

                  <CodeInput
                    digits={codeDigits}
                    setDigits={setCodeDigits}
                    onComplete={handleCodeSubmit}
                    disabled={isSubmitting}
                  />

                  <button
                    onClick={handleCodeSubmit}
                    className="submit-button"
                    disabled={isSubmitting || codeDigits.join("").length !== 6}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner"></span>
                        Verifying...
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </button>

                  <div className="email-sent-actions">
                    <button
                      onClick={handleResendCode}
                      className="resend-button"
                      disabled={isSubmitting || cooldownSeconds > 0}
                    >
                      {isSubmitting
                        ? "Sending..."
                        : cooldownSeconds > 0
                          ? `Resend in ${cooldownSeconds}s`
                          : "Resend Code"}
                    </button>
                    <button
                      onClick={handleBackToForm}
                      className="back-to-signin-button"
                      disabled={isSubmitting}
                    >
                      Back
                    </button>
                  </div>

                  <div className="email-help-text">
                    <p className="cant-find-email-title">
                      💡 <strong>Development Mode</strong>
                    </p>
                    <ul>
                      <p>Open browser console (F12)</p>
                      <p>Look for "Code generated" message</p>
                      <p>Enter the 6-digit code above</p>
                    </ul>
                  </div>
                </div>
              )}

              {step === "newpassword" && (
                <div className="recovery-view fade-in">
                  <div className="recovery-header">
                    <h2 className="recovery-title">Set New Password</h2>
                    <button
                      className="back-button"
                      onClick={() => {
                        resetForm();
                        setView("signin");
                      }}
                      disabled={isSubmitting}
                    >
                      <ArrowBigLeft size={20} />
                      Back
                    </button>
                  </div>

                  <p className="recovery-subtitle">
                    Choose a strong password for your account.
                  </p>

                  <form
                    onSubmit={handleNewPasswordSubmit}
                    className="form-fields"
                  >
                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <input
                        type="password"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleChange}
                        className={`form-input ${errors.newPassword ? "error" : ""}`}
                        placeholder="••••••••"
                        disabled={isSubmitting}
                        autoFocus
                      />
                      {errors.newPassword && (
                        <span className="error-text">{errors.newPassword}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <input
                        type="password"
                        name="confirmNewPassword"
                        value={formData.confirmNewPassword}
                        onChange={handleChange}
                        className={`form-input ${errors.confirmNewPassword ? "error" : ""}`}
                        placeholder="••••••••"
                        disabled={isSubmitting}
                      />
                      {errors.confirmNewPassword && (
                        <span className="error-text">
                          {errors.confirmNewPassword}
                        </span>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="submit-button"
                      disabled={isSubmitting}
                    >
                      {getMainButtonText()}
                    </button>
                  </form>
                </div>
              )}

              {step === "form" && (
                <>
                  {view === "recovery" ? (
                    <div className="recovery-view fade-in">
                      <div className="recovery-header">
                        <h2 className="recovery-title">Recover Account</h2>
                        <button
                          className="back-button"
                          onClick={() => setView("signin")}
                          disabled={isSubmitting}
                        >
                          <ArrowBigLeft size={20} />
                          Back
                        </button>
                      </div>

                      <p className="recovery-subtitle">
                        Enter your email for a recovery code.
                      </p>

                      <form onSubmit={handleFormSubmit} className="form-fields">
                        <div className="form-group">
                          <label className="form-label">Email Address</label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`form-input ${errors.email ? "error" : ""}`}
                            placeholder="you@grova.app"
                            disabled={isSubmitting}
                            autoFocus
                          />
                          {errors.email && (
                            <span className="error-text">{errors.email}</span>
                          )}
                        </div>

                        <button
                          type="submit"
                          className="submit-button"
                          disabled={isSubmitting}
                        >
                          {getMainButtonText()}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <form onSubmit={handleFormSubmit}>
                      <div className="form-fields">
                        {view === "signup" && (
                          <div className="form-group fade-in">
                            <label className="form-label">Full Name</label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              className={`form-input ${errors.name ? "error" : ""}`}
                              placeholder="Your full name"
                              disabled={isSubmitting}
                              autoFocus
                            />
                            {errors.name && (
                              <span className="error-text">{errors.name}</span>
                            )}
                          </div>
                        )}

                        <div className="form-group">
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`form-input ${errors.email ? "error" : ""}`}
                            placeholder="you@grova.app"
                            disabled={isSubmitting}
                            autoFocus={view === "signin"}
                          />
                          {errors.email && (
                            <span className="error-text">{errors.email}</span>
                          )}
                        </div>

                        <div className="form-group">
                          <label className="form-label">Password</label>
                          <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className={`form-input ${errors.password ? "error" : ""}`}
                            placeholder="••••••••"
                            disabled={isSubmitting}
                          />
                          {errors.password && (
                            <span className="error-text">
                              {errors.password}
                            </span>
                          )}
                        </div>

                        {view === "signup" && (
                          <div className="form-group fade-in">
                            <label className="form-label">
                              Confirm Password
                            </label>
                            <input
                              type="password"
                              name="confirmPassword"
                              value={formData.confirmPassword}
                              onChange={handleChange}
                              className={`form-input ${errors.confirmPassword ? "error" : ""}`}
                              placeholder="••••••••"
                              disabled={isSubmitting}
                            />
                            {errors.confirmPassword && (
                              <span className="error-text">
                                {errors.confirmPassword}
                              </span>
                            )}
                          </div>
                        )}

                        {view === "signin" && (
                          <div className="form-options">
                            <label className="checkbox-label">
                              <input type="checkbox" className="checkbox" />
                              Remember me
                            </label>
                            <button
                              type="button"
                              className="forgot-link"
                              onClick={() => {
                                setView("recovery");
                                resetForm();
                              }}
                              disabled={isSubmitting}
                            >
                              Forgot password?
                            </button>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="submit-button"
                          disabled={isSubmitting}
                        >
                          {getMainButtonText()}
                        </button>
                      </div>

                      <p className="footer-text">
                        {view === "signin"
                          ? "New to Grova? "
                          : "Already on Grova? "}
                        <button
                          type="button"
                          onClick={() => {
                            setView(view === "signin" ? "signup" : "signin");
                            resetForm();
                          }}
                          className="footer-link"
                          disabled={isSubmitting}
                        >
                          {view === "signin" ? "Join now" : "Sign in"}
                        </button>
                      </p>
                    </form>
                  )}
                </>
              )}
            </div>

            <p className="terms-text">
              By continuing, you agree to Grova's{" "}
              <button type="button" className="terms-link">
                Terms
              </button>{" "}
              and{" "}
              <button type="button" className="terms-link">
                Privacy
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
