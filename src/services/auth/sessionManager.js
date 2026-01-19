// src/services/auth/sessionManager.js
import { supabase } from '../config/supabase';

class SessionManager {
  constructor() {
    this.inactivityTimeout = 15 * 60 * 1000; // 15 minutes
    this.timeoutId = null;
    this.lastActivity = Date.now();
    this.isActive = false;
    this.onExpireCallback = null;
    this.activityUpdateInterval = null;
  }

  // Start monitoring session
  startSession(onExpire) {
    if (this.isActive) {
      console.log('⚠️ Session already active');
      return;
    }

    console.log('🔐 Starting session monitoring...');
    this.onExpireCallback = onExpire;
    this.isActive = true;
    this.lastActivity = Date.now();
    this.setupActivityListeners();
    this.startInactivityTimer();
    
    // Update session activity every 5 minutes
    this.activityUpdateInterval = setInterval(() => {
      if (this.isActive) {
        this.updateSessionActivity();
      }
    }, 5 * 60 * 1000);
  }

  // Stop monitoring session
  stopSession() {
    if (!this.isActive) {
      return;
    }

    console.log('🛑 Stopping session monitoring...');
    this.isActive = false;
    this.removeActivityListeners();
    this.clearInactivityTimer();
    
    if (this.activityUpdateInterval) {
      clearInterval(this.activityUpdateInterval);
      this.activityUpdateInterval = null;
    }
  }

  // Setup activity listeners
  setupActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, this.handleActivity);
    });
  }

  // Remove activity listeners
  removeActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.removeEventListener(event, this.handleActivity);
    });
  }

  // Handle user activity
  handleActivity = () => {
    if (!this.isActive) return;
    
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;
    
    // Only update if more than 30 seconds have passed since last activity
    if (timeSinceLastActivity < 30000) return;
    
    this.lastActivity = now;
    this.clearInactivityTimer();
    this.startInactivityTimer();
  };

  // Start inactivity timer
  startInactivityTimer() {
    this.clearInactivityTimer();
    this.timeoutId = setTimeout(() => {
      this.handleSessionExpired();
    }, this.inactivityTimeout);
  }

  // Clear inactivity timer
  clearInactivityTimer() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  // Handle session expiration
  async handleSessionExpired() {
    console.log('⏱️ Session expired due to inactivity');
    
    const userId = await this.getCurrentUserId();
    if (userId) {
      await this.endSession(userId);
    }
    
    this.stopSession();
    
    // Sign out user
    await supabase.auth.signOut();
    
    // Notify app
    if (this.onExpireCallback) {
      this.onExpireCallback('Session expired due to inactivity. Please sign in again.');
    }
  }

  // Get current user ID
  async getCurrentUserId() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user ? user.id : null;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  // Update session activity in database
  async updateSessionActivity() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      await supabase
        .from('user_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          is_active: true 
        })
        .eq('user_id', userId)
        .eq('is_active', true);
    } catch (error) {
      console.error('Failed to update session activity:', error);
    }
  }

  // Create new session record
  async createSession(userId) {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          last_activity: new Date().toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Session record created');
      return data;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  // End session
  async endSession(userId) {
    try {
      await supabase
        .from('user_sessions')
        .update({ 
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);
      
      console.log('✅ Session ended in database');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }

  // Check if session is valid
  async isSessionValid() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { data: userSession } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (!userSession) return false;

      // Check if session is too old
      const lastActivity = new Date(userSession.last_activity).getTime();
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;

      if (timeSinceActivity > this.inactivityTimeout) {
        await this.endSession(session.user.id);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  // Reset inactivity timer (useful for important actions)
  resetInactivityTimer() {
    if (!this.isActive) return;
    
    this.lastActivity = Date.now();
    this.clearInactivityTimer();
    this.startInactivityTimer();
  }
}

export default new SessionManager();