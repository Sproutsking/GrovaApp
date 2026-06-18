// scripts/check-withdraw.js
// Usage:
//  SUPABASE_URL="https://<ref>.supabase.co" TOKEN="<user_jwt_or_service_role>" WITHDRAWAL_ID="<id>" node scripts/check-withdraw.js

const SUPABASE_URL = process.env.SUPABASE_URL;
const TOKEN = process.env.TOKEN;
const WITHDRAWAL_ID = process.env.WITHDRAWAL_ID;
if (!SUPABASE_URL) {
  console.error('Set SUPABASE_URL env var');
  process.exit(2);
}
if (!TOKEN) {
  console.error('Set TOKEN env var (user JWT or service role key)');
  process.exit(2);
}
if (!WITHDRAWAL_ID) {
  console.error('Set WITHDRAWAL_ID env var (an existing withdrawal_queue id)');
  process.exit(2);
}

(async () => {
  try {
    // If you're calling with the service role key, include it as `internal_key`
    // in the request body so the function authenticates as internal.
    const INTERNAL_KEY = process.env.INTERNAL_KEY;
    const body = { withdrawal_id: WITHDRAWAL_ID };
    if (INTERNAL_KEY) body.internal_key = INTERNAL_KEY;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/withdraw-paystack-init`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    console.log('status:', res.status);
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('fetch error', e);
    process.exit(1);
  }
})();