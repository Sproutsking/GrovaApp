// src/services/auth/emailVerification.js
import supabase from '../config/supabase';

const VERIFICATION_EXPIRY = 10 * 60 * 1000; // 10 minutes

// Generate 6-digit verification code
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Hash code using Web Crypto API
const hashCode = async (code) => {
  try {
    const encoder = new TextEncoder();
    const salt = process.env.REACT_APP_ENCRYPTION_KEY || 'grova-default-salt-key-2024';
    const data = encoder.encode(code + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Hash error:', error);
    throw new Error('Failed to hash verification code');
  }
};

// Verify hash
const verifyHash = async (code, hash) => {
  try {
    const codeHash = await hashCode(code);
    return codeHash === hash;
  } catch (error) {
    console.error('Verify hash error:', error);
    return false;
  }
};

// Store verification code with encryption
export const storeVerificationCode = async (email, code) => {
  try {
    const hashedCode = await hashCode(code);
    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY).toISOString();

    // Delete any existing codes for this email
    await supabase
      .from('verification_codes')
      .delete()
      .eq('email', email.toLowerCase());

    // Insert new code
    const { error } = await supabase
      .from('verification_codes')
      .insert({
        email: email.toLowerCase(),
        code_hash: hashedCode,
        expires_at: expiresAt,
        attempts: 0,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Failed to store verification code:', error);
    throw new Error('Failed to store verification code');
  }
};

// Verify code
export const verifyCode = async (email, code) => {
  try {
    // Get stored code
    const { data, error } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !data) {
      throw new Error('No verification code found. Please request a new code.');
    }

    // Check expiry
    if (new Date(data.expires_at) < new Date()) {
      await supabase
        .from('verification_codes')
        .delete()
        .eq('email', email.toLowerCase());
      throw new Error('Verification code expired. Please request a new code.');
    }

    // Check attempts
    if (data.attempts >= 5) {
      await supabase
        .from('verification_codes')
        .delete()
        .eq('email', email.toLowerCase());
      throw new Error('Too many failed attempts. Please request a new code.');
    }

    // Verify code
    const isValid = await verifyHash(code, data.code_hash);

    if (!isValid) {
      // Increment attempts
      await supabase
        .from('verification_codes')
        .update({ attempts: data.attempts + 1 })
        .eq('email', email.toLowerCase());

      const attemptsLeft = 5 - (data.attempts + 1);
      throw new Error(`Invalid verification code. ${attemptsLeft} attempts remaining.`);
    }

    // Delete code after successful verification
    await supabase
      .from('verification_codes')
      .delete()
      .eq('email', email.toLowerCase());

    return true;
  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
};

// Clean up expired codes (call this periodically or before inserting new codes)
export const cleanupExpiredCodes = async () => {
  try {
    const { error } = await supabase
      .from('verification_codes')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Failed to cleanup expired codes:', error);
    return false;
  }
};

// Send verification email (console log for now, implement email service later)
export const sendVerificationEmail = async (email, code, fullName) => {
  try {
    console.log('='.repeat(60));
    console.log('📧 VERIFICATION EMAIL');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Name: ${fullName}`);
    console.log(`\n🔐 Your Verification Code: ${code}`);
    console.log(`\n⏰ This code expires in 10 minutes`);
    console.log('='.repeat(60));
    
    // TODO: Implement actual email sending here
    // Options:
    // 1. Supabase Edge Function with Resend/SendGrid
    // 2. Third-party service like EmailJS
    // 3. Your own backend API
    
    // For now, we'll just log it
    // In production, you would call your email service:
    /*
    const { error } = await supabase.functions.invoke('send-verification-email', {
      body: { 
        email, 
        code, 
        fullName 
      }
    });
    
    if (error) throw error;
    */
    
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // Don't throw - allow signup to continue even if email fails
    // User can still see code in console for testing
    return false;
  }
};