// src/services/auth/authService.js - FAST & RELIABLE
import { supabase } from '../config/supabase';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.authListeners = [];
    this.sessionCache = null;
    this.lastSessionCheck = 0;
    this.SESSION_CACHE_TTL = 30000;
    this.setupAuthListener();
  }

  setupAuthListener() {
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth Event:', event);

      if (session?.user) {
        this.currentUser = session.user;
        this.sessionCache = session;
        this.lastSessionCheck = Date.now();
        
        if (event === 'SIGNED_IN') {
          this.ensureProfileExistsQuick(session.user).catch(err => {
            console.warn('Profile creation warning:', err);
          });
        }
        
        this.notifyAuthListeners(session.user);
      } else {
        this.currentUser = null;
        this.sessionCache = null;
        this.notifyAuthListeners(null);
      }
    });
  }

  onAuthStateChange(callback) {
    this.authListeners.push(callback);
    return () => {
      this.authListeners = this.authListeners.filter(cb => cb !== callback);
    };
  }

  notifyAuthListeners(user) {
    this.authListeners.forEach(callback => {
      try {
        callback(user);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  async signUp(email, password, fullName) {
    const startTime = Date.now();
    console.log('📝 Starting signup...');

    try {
      if (!email?.trim() || !password || !fullName?.trim()) {
        throw new Error('All fields are required');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      if (!this.isStrongPassword(password)) {
        throw new Error('Password must contain uppercase, lowercase, number, and special character');
      }

      const emailLower = email.toLowerCase().trim();
      const username = this.generateUsername(fullName);

      console.log('✅ Validation passed, calling Supabase...');

      const { data, error } = await supabase.auth.signUp({
        email: emailLower,
        password,
        options: {
          data: { 
            full_name: fullName,
            username: username
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      console.log(`⏱️ Signup completed in ${Date.now() - startTime}ms`);

      if (error) throw error;
      if (!data.user) throw new Error('Failed to create account');

      console.log('✅ Account created, user ID:', data.user.id);

      return {
        success: true,
        message: 'Verification email sent! Check your inbox.',
        needsVerification: true,
        user: data.user
      };

    } catch (error) {
      console.error('❌ Signup error:', error);
      throw this.formatError(error);
    }
  }

  async signIn(email, password) {
    const startTime = Date.now();
    console.log('🔐 Starting signin...');

    try {
      const emailLower = email.toLowerCase().trim();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password
      });

      console.log(`⏱️ Signin completed in ${Date.now() - startTime}ms`);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Please verify your email before signing in');
        }
        throw error;
      }

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error('Please verify your email before signing in');
      }

      this.currentUser = data.user;
      this.sessionCache = data.session;
      this.lastSessionCheck = Date.now();
      
      console.log('✅ Sign in successful, loading app...');

      return {
        success: true,
        user: data.user,
        session: data.session
      };

    } catch (error) {
      console.error('❌ Signin error:', error);
      throw this.formatError(error);
    }
  }

  async signOut() {
    try {
      console.log('👋 Signing out...');
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      this.currentUser = null;
      this.sessionCache = null;
      this.lastSessionCheck = 0;
      this.notifyAuthListeners(null);

      return { success: true };
    } catch (error) {
      console.error('❌ Signout error:', error);
      throw this.formatError(error);
    }
  }

  async getSession() {
    try {
      const now = Date.now();
      if (this.sessionCache && (now - this.lastSessionCheck) < this.SESSION_CACHE_TTL) {
        return this.sessionCache;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      this.sessionCache = session;
      this.lastSessionCheck = now;
      return session;
    } catch (error) {
      console.error('❌ Get session error:', error);
      return null;
    }
  }

  async getCurrentUser() {
    try {
      if (this.currentUser) {
        return this.currentUser;
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;

      if (user) {
        this.currentUser = user;
      }

      return user;
    } catch (error) {
      console.error('❌ Get user error:', error);
      return null;
    }
  }

  async getUserProfile(userId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .is('deleted_at', null)
        .abortSignal(controller.signal)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        console.error('❌ Profile fetch error:', error);
        return null;
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ Profile fetch timeout');
      } else {
        console.error('❌ Failed to fetch user profile:', error);
      }
      return null;
    }
  }

  async ensureProfileExistsQuick(user) {
    try {
      console.log(`🔍 Quick profile check for ${user.id}`);
      
      const profile = await this.getUserProfile(user.id);
      
      if (profile) {
        console.log('✅ Profile exists');
        return true;
      }

      console.log('🔧 Profile missing, creating via RPC...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const username = user.user_metadata?.username || this.generateUsername(
        user.user_metadata?.full_name || 'Grova User'
      );
      const fullName = user.user_metadata?.full_name || 'Grova User';

      const { data, error } = await supabase.rpc('create_user_profile', {
        p_user_id: user.id,
        p_email: user.email,
        p_full_name: fullName,
        p_username: username
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error('❌ RPC creation failed:', error);
        return false;
      }

      console.log('✅ Profile created via RPC');
      return true;

    } catch (error) {
      console.error('❌ Quick profile check error:', error);
      return false;
    }
  }

  async ensureProfileExists(user) {
    return this.ensureProfileExistsQuick(user);
  }

  async resendVerificationEmail(email) {
    try {
      const emailLower = email.toLowerCase().trim();

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailLower,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.warn('Supabase resend error:', error.code, error.message, error.status);

        if (error.status === 429 || 
            error.message?.includes('after') || 
            error.message?.includes('rate limit') || 
            error.message?.includes('security purposes')) {
          throw new Error('Too many requests — please wait 60 seconds before trying again.');
        }
        
        throw error;
      }

      return {
        success: true,
        message: 'Verification email resent successfully!'
      };
    } catch (error) {
      console.error('❌ Resend email error:', error);
      throw error; // Let UI show the message
    }
  }

  async resetPassword(email) {
    try {
      const emailLower = email.toLowerCase().trim();

      const { error } = await supabase.auth.resetPasswordForEmail(emailLower, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Password reset link sent!'
      };
    } catch (error) {
      console.error('❌ Password reset error:', error);
      throw new Error('Failed to send password reset link');
    }
  }

  isStrongPassword(password) {
    return password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(password);
  }

  generateUsername(fullName) {
    const base = fullName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 15);
    const random = Math.floor(Math.random() * 90000) + 10000;
    return `${base}_${random}`;
  }

  formatError(error) {
    if (error.message) return error;
    return new Error('An unexpected error occurred. Please try again.');
  }
}

const authService = new AuthService(); 

export default authService;