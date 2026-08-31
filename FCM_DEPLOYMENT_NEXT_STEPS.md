# 🚀 Firebase FCM Deployment - Next Steps

**Status**: Edge Function DEPLOYED ✅ | Database Schema PENDING ⏳

---

## Step 1️⃣ : Add Database Schema (Manual SQL)

**Go to**: [Supabase Dashboard](https://app.supabase.com) → SQL Editor → New Query

**Copy & Paste this SQL**:
```sql
-- Add FCM support to push_subscriptions
ALTER TABLE IF EXISTS public.push_subscriptions
ADD COLUMN IF NOT EXISTS fcm_token TEXT UNIQUE;

ALTER TABLE IF EXISTS public.push_subscriptions
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'legacy' 
CHECK (provider IN ('legacy', 'onesignal', 'fcm'));

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_provider 
  ON public.push_subscriptions(user_id, provider, is_active);

-- Verify the schema was created
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'push_subscriptions' 
ORDER BY ordinal_position;
```

**Expected Result**:
- Column `fcm_token` added (TEXT, UNIQUE)
- Column `provider` added (TEXT, DEFAULT 'legacy')
- Index created on (user_id, provider, is_active)
- Schema verification shows new columns

---

## Step 2️⃣ : Get Firebase Credentials

**Go to**: [Firebase Console](https://console.firebase.google.com)

**Follow these steps**:
1. Select your Xeevia project
2. Click ⚙️ **Project Settings** (top left)
3. Go to **Service Accounts** tab
4. Click **Generate New Private Key** (blue button)
5. A JSON file will download — open it in a text editor
6. Copy these 3 values:
   - `"project_id"` → use as `FIREBASE_PROJECT_ID`
   - `"private_key"` → use as `FIREBASE_PRIVATE_KEY` (include the `\n` characters!)
   - `"client_email"` → use as `FIREBASE_CLIENT_EMAIL`

**Example JSON snippet**:
```json
{
  "type": "service_account",
  "project_id": "xeevia-app-prod",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xyz@xeevia-app-prod.iam.gserviceaccount.com",
  ...
}
```

---

## Step 3️⃣ : Set Edge Function Secrets

**Go to**: [Supabase Dashboard](https://app.supabase.com) → Functions → `send-push-fcm` → Secrets

**Add 3 secrets** (copy-paste from Firebase JSON):

### Secret 1:
```
Name:  FIREBASE_PROJECT_ID
Value: xeevia-app-prod
```

### Secret 2:
```
Name:  FIREBASE_PRIVATE_KEY
Value: -----BEGIN PRIVATE KEY-----
       MIIEvQI...
       -----END PRIVATE KEY-----
```
⚠️ **Keep the `\n` newline characters exactly as they are in the JSON file!**

### Secret 3:
```
Name:  FIREBASE_CLIENT_EMAIL
Value: firebase-adminsdk-xyz@xeevia-app-prod.iam.gserviceaccount.com
```

**Click "Save" after each secret**

---

## Step 4️⃣ : Update Local .env (Optional, for local testing)

**Edit**: `.env` (at project root)

**Add these 5 values** (from Firebase Console → Project Settings):
```env
REACT_APP_FIREBASE_PROJECT_ID=xeevia-app-prod
REACT_APP_FIREBASE_SENDER_ID=123456789
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc...
REACT_APP_FIREBASE_MESSAGING_VAPID_KEY=BJX...
```

To find these values:
- Go to Firebase Console → Project Settings
- Copy from **General** tab (Sender ID, Project ID)
- Click your web app → copy apiKey, appId, messagingSenderId
- Go to **Cloud Messaging** tab → copy **Web Push certificates** (VAPID key)

---

## Step 5️⃣ : Test the Setup

### Test 1: Verify Schema
```bash
# In your terminal:
cd /workspaces/GrovaApp
psql postgresql://username:password@db.rxtijxlvacqjiocdwzrh.supabase.co:5432/postgres \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'push_subscriptions' AND column_name IN ('fcm_token', 'provider');"
```

### Test 2: Check Edge Function is Running
```bash
# The function is already ACTIVE at:
# https://rxtijxlvacqjiocdwzrh.supabase.co/functions/v1/send-push-fcm

# Test with curl (requires auth):
curl -X POST https://rxtijxlvacqjiocdwzrh.supabase.co/functions/v1/send-push-fcm \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"recipient_user_id":"test-user","type":"test","title":"Test","message":"FCM works!"}'
```

### Test 3: App Permission Flow
1. Open https://app.xeevia.com in your browser
2. Log in
3. Browser should ask for notification permission → click **Allow**
4. Check browser DevTools Console:
   ```
   [Push] ✅ FCM token saved to DB
   [Push] ✅ Firebase FCM subscription registered
   ```
5. Verify token in Supabase:
   ```sql
   SELECT user_id, fcm_token, provider, is_active, updated_at
   FROM push_subscriptions
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY updated_at DESC
   LIMIT 1;
   ```

---

## 📋 Quick Checklist

- [ ] Database schema columns added (fcm_token, provider, index)
- [ ] Firebase credentials obtained from console
- [ ] 3 secrets set in Edge Function dashboard
- [ ] Local .env updated (if testing locally)
- [ ] Edge Function status = ACTIVE in Supabase dashboard
- [ ] Permission flow tested in browser
- [ ] Token appears in push_subscriptions table

---

## 🆘 Troubleshooting

### Error: "Edge Function secrets not found"
→ Make sure you clicked "Save" after entering each secret in the dashboard

### Error: "PRIVATE_KEY format invalid"
→ Copy the `private_key` value **exactly** from the JSON file, including all `\n` characters

### Browser doesn't ask for permission
→ Check `.env` has REACT_APP_FIREBASE_* variables
→ Rebuild: `npm run build`
→ Clear browser storage: DevTools → Application → Clear site data

### Token not saved to database
→ Check browser console for errors
→ Verify Supabase RLS policies allow INSERT to push_subscriptions
→ Run: `SELECT * FROM push_subscriptions LIMIT 1;` to see if table is writable

### Edge Function returns 500 error
→ Check Function logs: Supabase Dashboard → Functions → send-push-fcm → Logs
→ Verify secrets are set correctly (no spaces, no quotes around values)
→ PRIVATE_KEY must include literal `\n` newlines, not escaped

---

## 📞 Need Help?

Check [FCM_MIGRATION_COMPLETE.md](FCM_MIGRATION_COMPLETE.md) for:
- Full architecture explanation
- Database schema details
- Code examples
- Security considerations
- Testing procedures

---

**Status**: 🟡 Awaiting your input on steps 1-3  
**Next**: Once done, notification delivery will be live! 🚀
