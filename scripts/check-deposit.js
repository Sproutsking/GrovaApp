// scripts/check-deposit.js
// Usage:
//  SUPABASE_URL="https://<ref>.supabase.co" TOKEN="<user_jwt_or_service_role>" node scripts/check-deposit.js

const SUPABASE_URL = process.env.SUPABASE_URL;
const TOKEN = process.env.TOKEN;
if (!SUPABASE_URL) {
  console.error('Set SUPABASE_URL env var');
  process.exit(2);
}
if (!TOKEN) {
  console.error('Set TOKEN env var (user JWT or service role key)');
  process.exit(2);
}

(async () => {
  try {
        // Allow passing USER_ID when running with a service role key so the
        // function can attribute the deposit to a specific user.
        const USER_ID = process.env.USER_ID;
        const body = { nairaAmount: 500, currency: 'EP' };
        if (USER_ID) body.userId = USER_ID;

        const res = await fetch(`${SUPABASE_URL}/functions/v1/deposit-paystack-init`, {
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
