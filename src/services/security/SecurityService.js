// src/services/security/SecurityService.js - ACTUALLY FIXED
import { supabase } from '../config/supabase';

class SecurityService {
  constructor() {
    this.sessionKey = this.generateSessionKey();
    this.deviceFingerprint = null;
    this.securityEvents = [];
    this.requestCount = new Map();
    this.lastActivity = Date.now();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🛡️ Initializing Security Service...');

    try {
      const screenInfo = window.screen || {};
      
      const fingerprint = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screenInfo.width || 0}x${screenInfo.height || 0}x${screenInfo.colorDepth || 0}`,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: navigator.deviceMemory || 0,
        timestamp: Date.now()
      };

      const fingerprintString = JSON.stringify(fingerprint);
      this.deviceFingerprint = btoa(fingerprintString).substring(0, 64);
      
      sessionStorage.setItem('device_fp', this.deviceFingerprint);

      this.startSessionMonitoring();
      this.startActivityTracking();
      this.protectConsole();
      this.protectClipboard();

      this.isInitialized = true;
      console.log('✅ Security Service Active');
      
    } catch (error) {
      console.error('❌ Security initialization failed:', error);
    }
  }

  generateSessionKey() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  startSessionMonitoring() {
    setInterval(() => {
      this.validateSession();
    }, 5 * 60 * 1000);
  }

  async validateSession() {
    const now = Date.now();
    
    if (now - this.lastActivity > 30 * 60 * 1000) {
      await this.terminateSession('Session expired due to inactivity');
      return false;
    }

    const storedFp = sessionStorage.getItem('device_fp');
    if (storedFp && storedFp !== this.deviceFingerprint) {
      await this.terminateSession('Device fingerprint mismatch detected');
      return false;
    }

    return true;
  }

  async terminateSession(reason) {
    console.error('🚨 Session terminated:', reason);
    sessionStorage.clear();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  startActivityTracking() {
    const updateActivity = () => {
      this.lastActivity = Date.now();
      sessionStorage.setItem('last_activity', this.lastActivity.toString());
    };

    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab hidden
      } else {
        // Tab visible - validate session
        this.validateSession();
      }
    });
  }

  updateActivity() {
    this.lastActivity = Date.now();
    sessionStorage.setItem('last_activity', this.lastActivity.toString());
  }

  checkRateLimit(action, maxRequests = 100, windowMs = 60000) {
    const now = Date.now();
    const windowKey = Math.floor(now / windowMs);
    const key = `${action}_${windowKey}`;
    
    const count = this.requestCount.get(key) || 0;
    
    if (count >= maxRequests) {
      throw new Error('Too many requests. Please slow down.');
    }
    
    this.requestCount.set(key, count + 1);
    
    for (const [k] of this.requestCount.entries()) {
      if (!k.includes(`_${windowKey}`)) {
        this.requestCount.delete(k);
      }
    }

    return true;
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    let sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '');
    
    return sanitized;
  }

  sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        sanitized[key] = this.sanitizeInput(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = this.sanitizeObject(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
    
    return sanitized;
  }

  validateSQLInput(input) {
    const sqlPatterns = [
      /(\bOR\b|\bAND\b).*=.*/i,
      /UNION.*SELECT/i,
      /DROP\s+TABLE/i,
      /INSERT\s+INTO/i,
      /DELETE\s+FROM/i,
      /UPDATE.*SET/i,
      /--/,
      /;.*--/,
      /\/\*/,
      /xp_/i,
      /sp_/i
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) {
        throw new Error('Invalid input detected');
      }
    }
    
    return true;
  }

  protectConsole() {
    if (process.env.NODE_ENV !== 'production') return;

    const methods = ['log', 'debug', 'info', 'warn', 'error'];
    
    methods.forEach(method => {
      const original = console[method];
      console[method] = (...args) => {
        const message = args.join(' ');
        
        if (
          message.includes('supabase') ||
          message.includes('token') ||
          message.includes('password') ||
          message.includes('auth')
        ) {
          // Detected sensitive console activity
        }
        
        original.apply(console, args);
      };
    });
  }

  protectClipboard() {
    document.addEventListener('copy', (e) => {
      const selection = window.getSelection().toString();
      
      if (
        selection.includes('password') ||
        selection.includes('token') ||
        selection.includes('secret') ||
        selection.includes('key')
      ) {
        e.preventDefault();
      }
    });
  }

  // =====================================================
  // FIXED: Proper security event logging
  // =====================================================
  async logSecurityEvent(eventType, severity, metadata = {}) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Not authenticated - just store in memory
        this.securityEvents.push({
          event_type: eventType,
          severity: severity,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Build the event object - MATCH YOUR TABLE EXACTLY
      const event = {
        user_id: user.id,
        event_type: eventType,
        severity: severity,
        ip_address: null,
        user_agent: navigator.userAgent,
        device_fingerprint: this.deviceFingerprint,
        location_data: null,
        metadata: metadata || {}
      };

      // Store in memory
      this.securityEvents.push(event);
      if (this.securityEvents.length > 100) {
        this.securityEvents.shift();
      }

      // THE FIX: Use .insert() WITHOUT select() or columns
      const { error } = await supabase
        .from('security_events')
        .insert(event);

      if (error) {
        console.debug('Security log failed:', error.message);
      }

      if (severity === 'critical') {
        console.error('🚨 CRITICAL SECURITY EVENT:', eventType, metadata);
      }

    } catch (error) {
      // Silent fail - don't break the app
      console.debug('Security event error:', error);
    }
  }

  async secureRequest(url, options = {}) {
    const isValid = await this.validateSession();
    if (!isValid) {
      throw new Error('Invalid session');
    }

    this.checkRateLimit('api_request', 100, 60000);
    this.updateActivity();

    const secureOptions = {
      ...options,
      headers: {
        ...options.headers,
        'X-Device-Fingerprint': this.deviceFingerprint,
        'X-Session-Key': this.sessionKey,
        'X-Timestamp': Date.now().toString()
      }
    };

    return fetch(url, secureOptions);
  }

  getDeviceFingerprint() {
    return this.deviceFingerprint;
  }

  isSessionValid() {
    return this.validateSession();
  }

  logActivity(action, metadata = {}) {
    this.updateActivity();
    this.logSecurityEvent(action, 'info', metadata);
  }
}

const securityService = new SecurityService();

if (typeof window !== 'undefined') {
  setTimeout(() => {
    securityService.initialize();
  }, 1000);
}

export default securityService;