// src/services/security/SecurityService.js
import { supabase } from '../config/supabase';

class SecurityService {
  constructor() {
    this.deviceFingerprint = null;
    this.sessionKey = null;
    this.lastActivity = Date.now();
    this.isInitialized = false;
  }

  // ────────────────────────────────────────────────
  // Initialization & Device Fingerprint
  // ────────────────────────────────────────────────
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Generate stable session key
      this.sessionKey = crypto.randomUUID?.() || 
        Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

      // Enhanced device fingerprint (more stable than before)
      const components = [
        navigator.userAgent,
        navigator.language || navigator.userLanguage,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
        navigator.hardwareConcurrency || 'unknown',
        navigator.deviceMemory || 'unknown',
        navigator.platform || 'unknown'
      ];

      const str = components.join('|');
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
      }

      this.deviceFingerprint = Math.abs(hash).toString(36) + '-' + 
        btoa(navigator.userAgent.slice(0, 80)).slice(0, 32);

      sessionStorage.setItem('device_fp', this.deviceFingerprint);
      this.isInitialized = true;

      this.startActivityTracking();
      console.debug('SecurityService initialized');
    } catch (err) {
      console.warn('Security init failed:', err);
    }
  }

  getDeviceFingerprint() {
    return this.deviceFingerprint;
  }

  // ────────────────────────────────────────────────
  // Session & Activity Monitoring
  // ────────────────────────────────────────────────
  startActivityTracking() {
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart'];
    const update = () => { this.lastActivity = Date.now(); };

    events.forEach(ev => 
      document.addEventListener(ev, update, { passive: true })
    );

    // Check inactivity every 3 minutes
    setInterval(() => this.checkInactivity(), 3 * 60 * 1000);
  }

  async checkInactivity() {
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    if (Date.now() - this.lastActivity > INACTIVITY_TIMEOUT) {
      await this.terminateSession('Inactivity timeout');
    }
  }

  async terminateSession(reason = 'Manual termination') {
    try {
      await supabase.auth.signOut();
      sessionStorage.clear();
      window.location.replace('/login?reason=session_ended');
    } catch (err) {
      console.error('Session termination failed:', err);
    }
  }

  // ────────────────────────────────────────────────
  // Core Security Event Logging
  // ────────────────────────────────────────────────
  async logSecurityEvent(eventType, severity = 'info', metadata = {}) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const event = {
        user_id: user.id,
        event_type: eventType,
        severity,
        ip_address: null,           // filled later if you have server-side IP
        user_agent: navigator.userAgent,
        device_fingerprint: this.deviceFingerprint,
        location_data: null,        // can be enriched later
        metadata: { ...metadata, client_time: new Date().toISOString() },
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('security_events')
        .insert(event);

      if (error) throw error;

      if (severity === 'critical' || severity === 'warning') {
        console.warn(`Security [${severity.toUpperCase()}] ${eventType}`, metadata);
      }
    } catch (err) {
      // Silent fail — never break main app flow
      console.debug('Could not log security event:', err.message);
    }
  }

  // ────────────────────────────────────────────────
  // Trusted Devices / Fingerprints
  // ────────────────────────────────────────────────
  async getTrustedDevices(userId) {
    try {
      const { data, error } = await supabase
        .from('device_fingerprints')
        .select(`
          id,
          fingerprint_hash,
          device_name,
          browser,
          os,
          is_trusted,
          first_seen,
          last_seen,
          location_country,
          location_city,
          ip_address
        `)
        .eq('user_id', userId)
        .eq('is_trusted', true)
        .order('last_seen', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getTrustedDevices failed:', err);
      return [];
    }
  }

  async trustCurrentDevice(userId, customName = null) {
    try {
      const fp = {
        user_id: userId,
        fingerprint_hash: this.deviceFingerprint,
        device_name: customName || this.guessDeviceName(),
        browser: this.guessBrowser(),
        os: this.guessOS(),
        is_trusted: true,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        ip_address: await this.getApproximateIP()
      };

      const { error } = await supabase
        .from('device_fingerprints')
        .upsert(fp, { onConflict: 'user_id, fingerprint_hash' });

      if (error) throw error;

      await this.logSecurityEvent('device_trusted', 'info', {
        fingerprint: this.deviceFingerprint,
        name: fp.device_name
      });

      return true;
    } catch (err) {
      console.error('trustCurrentDevice failed:', err);
      return false;
    }
  }

  async removeTrustedDevice(userId, deviceId) {
    try {
      const { error } = await supabase
        .from('device_fingerprints')
        .update({ is_trusted: false, last_seen: new Date().toISOString() })
        .eq('id', deviceId)
        .eq('user_id', userId);

      if (error) throw error;

      await this.logSecurityEvent('device_untrusted', 'warning', { device_id: deviceId });
      return true;
    } catch (err) {
      console.error('removeTrustedDevice failed:', err);
      return false;
    }
  }

  // ────────────────────────────────────────────────
  // Active Sessions (recommended for "Where you're logged in")
  // ────────────────────────────────────────────────
  async getActiveSessions(userId) {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select(`
          id,
          ip_address,
          user_agent,
          location_data,
          last_activity,
          created_at,
          expires_at,
          is_active,
          device_fingerprint_id,
          device_fingerprints!device_fingerprint_id (
            device_name,
            browser,
            os,
            location_country,
            location_city
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (error) throw error;

      return (data || []).map(s => ({
        ...s,
        current: s.device_fingerprint_id === this.deviceFingerprint,
        deviceName: s.device_fingerprints?.device_name || this.guessDeviceName(s.user_agent),
        browser: s.device_fingerprints?.browser || this.guessBrowser(s.user_agent),
        os: s.device_fingerprints?.os || this.guessOS(s.user_agent),
        location: this.formatLocation(s)
      }));
    } catch (err) {
      console.error('getActiveSessions failed:', err);
      return [];
    }
  }

  async terminateSessionById(sessionId, userId) {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) throw error;

      await this.logSecurityEvent('session_terminated', 'info', { session_id: sessionId });
      return true;
    } catch (err) {
      console.error('terminateSessionById failed:', err);
      return false;
    }
  }

  // ────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────
  guessDeviceName(ua = navigator.userAgent) {
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet|iPad/i.test(ua)) return 'Tablet';
    return 'Computer';
  }

  guessBrowser(ua = navigator.userAgent) {
    if (/edg/i.test(ua)) return 'Edge';
    if (/firefox/i.test(ua)) return 'Firefox';
    if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera';
    if (/chrome/i.test(ua)) return 'Chrome';
    if (/safari/i.test(ua)) return 'Safari';
    return 'Unknown';
  }

  guessOS(ua = navigator.userAgent) {
    if (/windows/i.test(ua)) return 'Windows';
    if (/macintosh|mac os/i.test(ua)) return 'macOS';
    if (/linux/i.test(ua)) return 'Linux';
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
    return 'Unknown';
  }

  formatLocation(session) {
    const loc = session.location_data || session.device_fingerprints || {};
    const parts = [
      loc.location_city || loc.city,
      loc.location_country || loc.country
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Unknown';
  }

  async getApproximateIP() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const { ip } = await res.json();
      return ip;
    } catch {
      return null;
    }
  }

  // Legacy / compatibility methods (keep if needed)
  async getTrustedDevicesLegacy(userId) { return this.getTrustedDevices(userId); }
  async removeDevice(userId, deviceId) { return this.removeTrustedDevice(userId, deviceId); }
}

const securityService = new SecurityService();

// Auto-init in browser
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => securityService.initialize(), 800);
  });
}

export default securityService;