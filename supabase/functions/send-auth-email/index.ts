// ============================================================================
// supabase/functions/send-auth-email/index.ts
//
// WHAT THIS DOES:
//   Supabase normally sends OTP/magic link emails itself.
//   When you connect this as an Auth Hook (Auth → Hooks → Send Email),
//   Supabase calls THIS function instead of sending its own email.
//   This function builds your branded Xeevia HTML and sends it via Brevo.
//
// SETUP:
//   1. Deploy: supabase functions deploy send-auth-email --no-verify-jwt
//   2. In Supabase Dashboard → Auth → Hooks → Send Email Hook
//      → Type: Supabase Edge Functions
//      → Function: send-auth-email
//      → Enable it
//
// FIX APPLIED:
//   Sender changed from noreply@xeevia.app (unverified) to
//   infinitesprout@gmail.com which is your verified Brevo sender.
//   This was causing Brevo to silently reject all emails.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface AuthHookPayload {
  type: "signup" | "magiclink" | "recovery" | "email_change" | "invite";
  email: string;
  data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
  };
}

async function sendViaBrevo(
  to: string,
  subject: string,
  html: string,
  textContent: string,
): Promise<void> {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) {
    throw new Error(
      "BREVO_API_KEY secret is not set. Run: supabase secrets set BREVO_API_KEY=your_key",
    );
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "Xeevia",
        email: "infinitesprout@gmail.com", // ✅ FIXED: verified Brevo sender
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
}

function buildOtpEmail(email: string, token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Xeevia Code</title>
</head>
<body style="margin:0;padding:0;background:#080808;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;color:#080808;">
    Your Xeevia verification code — expires in 5 minutes ·&nbsp;·&nbsp;·&nbsp;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080808;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

          <!-- LOGO -->
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#84cc16 0%,#4d7c0f 100%);border-radius:14px;padding:10px 28px;">
                    <span style="font-size:22px;font-weight:900;color:#000000;letter-spacing:4px;text-transform:uppercase;">XEEVIA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CARD -->
          <tr>
            <td style="background:#0f0f10;border:1px solid #1f1f23;border-radius:24px;overflow:hidden;">

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(90deg,#84cc16,#65a30d,#3f6212);height:3px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:44px 44px 40px;">

                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px;">
                      <tr>
                        <td align="center" style="width:72px;height:72px;background:rgba(132,204,22,0.08);border:2px solid rgba(132,204,22,0.3);border-radius:50%;padding:18px;">
                          🔒
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="padding-bottom:10px;">
                          <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">
                            Verify it's you
                          </h1>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-bottom:36px;">
                          <p style="margin:0;font-size:15px;color:#71717a;line-height:1.6;max-width:320px;">
                            Use the code below to continue to your Xeevia account.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- CODE BOX -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                      <tr>
                        <td align="center">
                          <table cellpadding="0" cellspacing="0" border="0" style="background:#141415;border:1px solid #2a2a2e;border-radius:16px;width:100%;">
                            <tr>
                              <td align="center" style="padding:28px 24px 20px;">
                                <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#52525b;letter-spacing:3px;text-transform:uppercase;">
                                  Verification Code
                                </p>
                                <p style="margin:0;font-size:52px;font-weight:900;letter-spacing:14px;color:#a3e635;font-family:'Courier New',Courier,monospace;line-height:1;">
                                  ${token}
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#0d0d0e;border-top:1px solid #1f1f23;border-radius:0 0 16px 16px;padding:12px 24px;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                  <tr>
                                    <td><span style="font-size:12px;color:#52525b;">⏱ Expires in</span></td>
                                    <td align="right"><span style="font-size:12px;font-weight:700;color:#84cc16;">5 minutes</span></td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- SECURITY ROWS -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #1a1a1d;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:28px;vertical-align:top;padding-top:1px;">🔑</td>
                              <td><span style="font-size:13px;color:#71717a;line-height:1.5;">One-time use only — invalid after first use</span></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #1a1a1d;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:28px;vertical-align:top;padding-top:1px;">🛡️</td>
                              <td><span style="font-size:13px;color:#71717a;line-height:1.5;">Never share this — Xeevia will never ask for it</span></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:28px;vertical-align:top;padding-top:1px;">🚫</td>
                              <td><span style="font-size:13px;color:#71717a;line-height:1.5;">Didn't request this? Ignore it — your account is safe</span></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(90deg,#3f6212,#65a30d,#84cc16);height:2px;font-size:0;line-height:0;opacity:0.4;">&nbsp;</td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#3f3f46;">
                Sent to <span style="color:#52525b;">${email}</span>
              </p>
              <p style="margin:0;font-size:12px;color:#3f3f46;">
                © 2025 Xeevia · Built for the culture
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: AuthHookPayload = await req.json();
    const { type, email, data } = payload;

    console.log(`[send-auth-email] type=${type} email=${email}`);

    if (type === "signup" || type === "magiclink" || type === "recovery") {
      const token = data?.token;

      if (!token) {
        console.error(
          "[send-auth-email] No token in payload:",
          JSON.stringify(payload),
        );
        return new Response(JSON.stringify({ error: "No token in payload" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const html = buildOtpEmail(email, token);
      const textContent = `Your Xeevia verification code: ${token}\n\nExpires in 5 minutes.\n\nNever share this code. Xeevia will never ask for it.`;

      await sendViaBrevo(email, "Your Xeevia Code", html, textContent);
      console.log(`[send-auth-email] ✓ Sent via Brevo to ${email}`);
    } else {
      console.log(`[send-auth-email] Unhandled type: ${type} — skipping`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-auth-email] Error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
