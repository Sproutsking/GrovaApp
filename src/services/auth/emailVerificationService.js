// src/services/auth/emailVerificationService.js
import { supabase } from "../config/supabase";

class EmailVerificationService {
  async sendOTP(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
    return { success: true };
  }

  async verifyOTP(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token,
      type: "email",
    });
    if (error) throw error;
    if (!data?.user) throw new Error("Verification failed — no user returned");
    return { user: data.user, session: data.session };
  }

  // Alias used by authService
  async initiateSignup(email, fullName) {
    return this.sendOTP(email, fullName);
  }

  async initiatePasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      { redirectTo: `${window.location.origin}/auth/callback?type=recovery` },
    );
    if (error) throw error;
    return { success: true };
  }

  async resendCode(email, fullName = "User", type = "email_verify") {
    return this.sendOTP(email);
  }
}

const emailVerificationService = new EmailVerificationService();
export default emailVerificationService;
