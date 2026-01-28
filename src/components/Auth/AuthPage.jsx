// src/components/Auth/AuthPage.jsx
// ULTRA-FAST AUTHENTICATION PAGE WITH RESEND COOLDOWN

import { ArrowBigLeft } from 'lucide-react';
import React, { useState, useCallback, useEffect } from 'react';
import authService from '../../services/auth/authService';
import Toast from './Toast';
import './AuthPage.css';

function AuthPage() {
  const [view, setView] = useState('signin');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    recoveryEmail: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, type: '', message: '' });
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [lastSentAt, setLastSentAt] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes in ms

  const validateEmail = useCallback((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), []);

  const showToast = useCallback((type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: '', message: '' }), 5000);
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (view === 'signup') {
      if (!formData.name.trim()) newErrors.name = 'Full name required';
      if (!formData.email.trim()) newErrors.email = 'Email required';
      else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email';
      if (!formData.password) newErrors.password = 'Password required';
      else if (formData.password.length < 8) newErrors.password = 'Min 8 characters';
      else if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Need uppercase';
      else if (!/[a-z]/.test(formData.password)) newErrors.password = 'Need lowercase';
      else if (!/\d/.test(formData.password)) newErrors.password = 'Need number';
      else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) newErrors.password = 'Need special char';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    } else if (view === 'signin') {
      if (!formData.email.trim()) newErrors.email = 'Email required';
      else if (!validateEmail(formData.email)) newErrors.email = 'Invalid email';
      if (!formData.password) newErrors.password = 'Password required';
    } else if (view === 'recovery') {
      if (!formData.recoveryEmail.trim()) newErrors.recoveryEmail = 'Email required';
      else if (!validateEmail(formData.recoveryEmail)) newErrors.recoveryEmail = 'Invalid email';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [view, formData, validateEmail]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }, [errors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToast('error', 'Please fix the errors above');
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    
    const startTime = Date.now();
    console.log('⏱️ Starting auth request...');

    try {
      if (view === 'recovery') {
        console.log('🔑 Password recovery...');
        const result = await authService.resetPassword(formData.recoveryEmail);
        console.log(`✅ Recovery completed in ${Date.now() - startTime}ms`);
        showToast('success', '✅ Recovery link sent! Check your inbox.');
        setFormData(prev => ({ ...prev, recoveryEmail: '' }));
        setTimeout(() => setView('signin'), 2000);

      } else if (view === 'signin') {
        console.log('🔐 Signing in...');
        const result = await authService.signIn(formData.email, formData.password);
        console.log(`✅ Signin completed in ${Date.now() - startTime}ms`);
        
        if (result.success) {
          showToast('success', '✅ Welcome back to Grova!');
        }

      } else if (view === 'signup') {
        console.log('📝 Signing up...');
        const result = await authService.signUp(
          formData.email,
          formData.password,
          formData.name
        );
        console.log(`✅ Signup completed in ${Date.now() - startTime}ms`);

        if (result.success) {
          setSentEmail(formData.email);
          setEmailSent(true);
          setLastSentAt(Date.now()); // Start cooldown timer
          showToast('success', '✅ Verification email sent! Check inbox & spam.');
          
          setFormData({
            name: '',
            email: '',
            password: '',
            confirmPassword: '',
            recoveryEmail: '',
          });
        }
      }
    } catch (error) {
      console.error('❌ Auth error:', error);
      console.log(`⏱️ Failed after ${Date.now() - startTime}ms`);
      
      let errorMessage = error.message || 'An error occurred';
      
      if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        errorMessage = '⚠️ Connection issue. Please check your internet and try again.';
      }
      
      showToast('error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cooldown countdown logic
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

  const handleResendEmail = async () => {
    if (cooldownSeconds > 0) return;

    setIsSubmitting(true);
    try {
      await authService.resendVerificationEmail(sentEmail);
      setLastSentAt(Date.now()); // Reset cooldown on success
      showToast('success', '✅ New verification email sent!');
    } catch (error) {
      showToast('error', error.message || 'Failed to resend verification email');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      {toast.show && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast({ show: false, type: '', message: '' })}
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

            {view === 'signin' ? (
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
                  Reimagining social on chain. Own your content, gamify engagement.
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

              {emailSent ? (
                <div className="email-sent-view fade-in">
                  <div className="success-icon-large">📧</div>
                  <h2 className="email-sent-title">Check Your Email</h2>
                  <p className="email-sent-subtitle">
                    We sent a verification link to <strong>{sentEmail}</strong>
                  </p>
                  <p className="email-sent-instructions">
                    Click the link in the email to verify your account. (valid for a short time)
                  </p>
                  
                  <div className="email-sent-actions">
                    <button 
                      onClick={handleResendEmail}
                      className="resend-button"
                      disabled={isSubmitting || cooldownSeconds > 0}
                    >
                      {isSubmitting 
                        ? 'Sending...' 
                        : cooldownSeconds > 0 
                          ? `Resend available in ${cooldownSeconds}s` 
                          : 'Resend Email'}
                    </button>
                    <button 
                      onClick={() => {
                        setEmailSent(false);
                        setView('signin');
                        setLastSentAt(null);
                      }}
                      className="back-to-signin-button"
                    >
                      Back to Sign In
                    </button>
                  </div>

                  <div className="email-help-text">
                    <p className="cant-find-email-title">💡 <strong>Can't find the email?</strong></p>
                    <ul>
                      <p>Check spam/junk/promotions folder</p>
                      <p>Make sure {sentEmail} is correct</p>
                      <p>Wait a few minutes — delivery can take time</p>
                    </ul>
                  </div>
                </div>
              ) : (
                <>
                  {view === 'recovery' && (
                    <div className="recovery-view fade-in">
                      <div className="recovery-header">
                        <h2 className="recovery-title">Recover Account</h2>
                        <button 
                          className="back-button" 
                          onClick={() => setView('signin')} 
                          disabled={isSubmitting}
                        >
                          <ArrowBigLeft size={20} />
                          Back
                        </button>
                      </div>
                      
                      <p className="recovery-subtitle">Enter your email for a recovery link.</p>
                      <form onSubmit={handleSubmit} className="form-fields">
                        <div className="form-group">
                          <label className="form-label">Email Address</label>
                          <input
                            type="email"
                            name="recoveryEmail"
                            value={formData.recoveryEmail}
                            onChange={handleChange}
                            className={`form-input ${errors.recoveryEmail ? 'error' : ''}`}
                            placeholder="you@grova.app"
                            disabled={isSubmitting}
                            autoFocus
                          />
                          {errors.recoveryEmail && <span className="error-text">{errors.recoveryEmail}</span>}
                        </div>
                        <button type="submit" className="submit-button" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="spinner"></span>
                              Sending...
                            </>
                          ) : 'Send Recovery Link'}
                        </button>
                      </form>
                    </div>
                  )}

                  {view !== 'recovery' && (
                    <form onSubmit={handleSubmit}>
                      <div className="toggle-container">
                        <button 
                          type="button" 
                          onClick={() => setView('signin')} 
                          className={`toggle-button ${view === 'signin' ? 'active' : ''}`} 
                          disabled={isSubmitting}
                        >
                          Sign In
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setView('signup')} 
                          className={`toggle-button ${view === 'signup' ? 'active' : ''}`} 
                          disabled={isSubmitting}
                        >
                          Sign Up
                        </button>
                      </div>

                      <div className="form-fields">
                        {view === 'signup' && (
                          <div className="form-group fade-in">
                            <label className="form-label">Full Name</label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              className={`form-input ${errors.name ? 'error' : ''}`}
                              placeholder="Your full name"
                              disabled={isSubmitting}
                              autoFocus
                            />
                            {errors.name && <span className="error-text">{errors.name}</span>}
                          </div>
                        )}

                        <div className="form-group">
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`form-input ${errors.email ? 'error' : ''}`}
                            placeholder="you@grova.app"
                            disabled={isSubmitting}
                            autoFocus={view === 'signin'}
                          />
                          {errors.email && <span className="error-text">{errors.email}</span>}
                        </div>

                        <div className="form-group">
                          <label className="form-label">Password</label>
                          <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className={`form-input ${errors.password ? 'error' : ''}`}
                            placeholder="••••••••"
                            disabled={isSubmitting}
                          />
                          {errors.password && <span className="error-text">{errors.password}</span>}
                        </div>

                        {view === 'signup' && (
                          <div className="form-group fade-in">
                            <label className="form-label">Confirm Password</label>
                            <input
                              type="password"
                              name="confirmPassword"
                              value={formData.confirmPassword}
                              onChange={handleChange}
                              className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                              placeholder="••••••••"
                              disabled={isSubmitting}
                            />
                            {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                          </div>
                        )}

                        {view === 'signin' && (
                          <div className="form-options">
                            <label className="checkbox-label">
                              <input type="checkbox" className="checkbox" />
                              Remember me
                            </label>
                            <button 
                              type="button" 
                              className="forgot-link" 
                              onClick={() => setView('recovery')} 
                              disabled={isSubmitting}
                            >
                              Forgot?
                            </button>
                          </div>
                        )}

                        <button type="submit" className="submit-button" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="spinner"></span>
                              {view === 'signin' ? 'Signing In...' : 'Creating...'}
                            </>
                          ) : (
                            view === 'signin' ? 'Sign In' : 'Create Account'
                          )}
                        </button>
                      </div>

                      <p className="footer-text">
                        {view === 'signin' ? 'New to Grova? ' : 'Already on Grova? '}
                        <button 
                          type="button" 
                          onClick={() => setView(view === 'signin' ? 'signup' : 'signin')} 
                          className="footer-link" 
                          disabled={isSubmitting}
                        >
                          {view === 'signin' ? 'Join now' : 'Sign in'}
                        </button>
                      </p>
                    </form>
                  )}
                </>
              )}
            </div>

            <p className="terms-text">
              By continuing, you agree to Grova's{' '}
              <button type="button" className="terms-link">Terms</button> and{' '}
              <button type="button" className="terms-link">Privacy</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;