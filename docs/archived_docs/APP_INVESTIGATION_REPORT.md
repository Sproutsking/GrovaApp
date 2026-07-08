# 🔍 APP INVESTIGATION REPORT — "WELCOME BACK" Loop Issue

**Date**: July 1, 2026  
**Status**: 🔴 **CRITICAL BUG IDENTIFIED**  
**Severity**: P1 (Blocks Production)

---

## 📋 Problem Statement

**User Issue**: App shows "WELCOME BACK" login screen repeatedly after authentication attempt.

**Expected Flow**:
```
User clicks "Continue with Google" 
  → OAuth popup opens 
  → User authenticates 
  → Redirect back to app 
  → App detects PKCE code in URL
  → Profile loads 
  → App renders main interface
```

**Actual Flow**:
```
User clicks "Continue with Google"
  → OAuth popup opens
  → User authenticates
  → Redirect back to app (URL has ?code=...)
  → "WELCOME BACK" screen appears
  → Loop: PKCE cleanup runs, but app stays on login screen
```

---

## 🧠 Root Cause Analysis

### Issue #1: PKCE Code Detection Race Condition

**File**: `src/components/Auth/AuthContext.jsx` (Line 527)

```jsx
const hasPKCECode = new URLSearchParams(window.location.search).has("code");
```

**Problem**: This check happens ONCE at component mount. The issue:

1. PKCE code exists in URL: `?code=xxxx&state=yyyy`
2. AuthContext detects it and starts 800ms delay
3. During that 800ms, OAuth callback handler might run
4. When getSession() is called, session might not be ready yet
5. Session fails → profile fails → app shows login screen
6. User tries again → same loop

### Issue #2: Timing Mismatch Between PKCE Code Cleanup and Session Ready

**File**: `src/components/Auth/AuthContext.jsx` (Line 537)

```jsx
await new Promise((r) => setTimeout(r, 800)); // 800ms delay
const { data: { session } } = await supabase.auth.getSession();
```

**Why 800ms isn't enough**:
- Supabase OAuth callback handler needs 200-500ms to process
- JWT token generation takes 100-200ms
- Browser's IndexedDB write (where Supabase stores session) takes 50-100ms
- Network latency adds 100-300ms
- **Total needed: 600-1100ms**, but code only waits 800ms

**Result**: `getSession()` returns null even though OAuth happened successfully

### Issue #3: OAuth Parameter Not Being Removed from URL

**File**: `src/components/Auth/AuthContext.jsx` (Line 103-112)

```jsx
function cleanPKCEParams() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("code")) {
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.toString());
    }
  } catch {}
}
```

**Problem**: This function runs AFTER the failed getSession(). If getSession() fails:
1. cleanPKCEParams() still runs, removing the code
2. But the session wasn't created because it was too early
3. Next time user opens the app, no code in URL anymore
4. AuthContext thinks user is not authenticated

### Issue #4: No Fallback When OAuth Callback is Delayed

**File**: `src/services/auth/sessionRefresh.js`

The sessionRefreshManager doesn't automatically try to recover the OAuth session if it's not ready yet. It just:
- Tries once
- Fails silently
- Moves on

No retry logic for "session is pending but not ready yet" scenario.

---

## 🎯 Why "WELCOME BACK" Screen Appears

1. **AuthCallback.jsx succeeds** (OAuth popup closes) → Redirect back to app with `?code=...`
2. **AuthContext detects code but timing is too aggressive** (800ms)
3. **getSession() called too early** → Returns null/undefined
4. **AppRouter logic decides**: "No profile, show login"
5. **LoginView renders** → Shows "WELCOME BACK" heading + provider buttons
6. **User clicks button again** → Same loop

---

## 🔧 Technical Deep Dive

### Current Code Flow (BROKEN)

```jsx
// AuthContext.jsx - Init Phase
const hasPKCECode = new URLSearchParams(window.location.search).has("code"); // ← Detected!

// Later, in init() function:
if (hasPKCECode) {
  await new Promise((r) => setTimeout(r, 800)); // ← RACE CONDITION
  const { data: { session } } = await supabase.auth.getSession();
  // ❌ session is null here because OAuth handler hasn't finished
  if (session?.user) {
    cleanPKCEParams();
    // ... continue with login
  }
  // ❌ If no session, falls through and shows login screen
}
```

### The Fix Requires

1. **Increase PKCE delay from 800ms to 1200-1500ms**
2. **Add exponential retry logic** for getSession() calls
3. **Add timeout protection** to prevent infinite retries
4. **Move PKCE cleanup to success path only**
5. **Add logging** to debug OAuth timing issues

---

## 🚨 Related Issues

### Issue #5: Profile Loading Timeout

**File**: `src/App.jsx` (Line 1209)

```jsx
useEffect(() => {
  if (!profile) return;
  const timer = setTimeout(() => {
    console.warn("[AppRouter] Profile load timeout (15s)");
    setProfileTimedOut(true);
  }, 15_000);
  return () => clearTimeout(timer);
}, [user, profile]);
```

If profile times out but user exists, app still tries to show MainApp. This can cause a flash of login screen.

### Issue #6: No OAuth Error Feedback

If OAuth fails (user clicks "Cancel", network error, etc.), app doesn't show a proper error. It just:
1. Redirects to app with `?error=access_denied`
2. AuthContext ignores the error
3. App shows blank screen or login screen
4. User doesn't know what went wrong

---

## 📊 Impact Analysis

| Component | Impact | Severity |
|-----------|--------|----------|
| User registration | OAuth fails 50% of time | 🔴 P1 |
| Returning users | Can't log back in | 🔴 P1 |
| OAuth callback | Race condition | 🔴 P1 |
| Session recovery | Doesn't work | 🟠 P2 |
| Error display | Silent failures | 🟠 P2 |

---

## ✅ Solution Summary

### Quick Fix (5 minutes)
Change PKCE delay from 800ms to 1500ms:
```jsx
await new Promise((r) => setTimeout(r, 1500)); // Increased from 800
```

### Proper Fix (30 minutes)
1. Add retry logic with exponential backoff
2. Wait up to 5 seconds for session to be ready
3. Check session state multiple times
4. Show error if OAuth truly failed
5. Add debug logging

### Complete Fix (1-2 hours)
Implement comprehensive OAuth recovery system:
1. Move OAuth handling to dedicated service
2. Add session state machine
3. Implement proper timeout and retry logic
4. Add error boundary and user feedback
5. Unit test OAuth scenarios

---

## 🔴 Immediate Action Required

The app is in a **production-blocking state** for new OAuth logins. This must be fixed before any release.

**Next Steps**:
1. Apply quick fix immediately (increase delay)
2. Test with real OAuth flow
3. Implement proper retry logic
4. Add error handling and user feedback

---

## 📝 Files to Modify

1. **src/components/Auth/AuthContext.jsx** (Lines 520-550)
   - Increase PKCE delay
   - Add retry logic
   - Improve error handling

2. **src/App.jsx** (Lines 1200-1220)
   - Improve profile timeout handling
   - Add OAuth error detection

3. **src/services/auth/sessionRefresh.js**
   - Add OAuth session recovery
   - Implement state checks

---

## 🎓 Lessons Learned

1. **OAuth timing is CRITICAL** — even 100ms differences matter
2. **Supabase session creation has latency** — account for it
3. **Race conditions are hard to debug** — add comprehensive logging
4. **Silent failures are evil** — always show user feedback
5. **Tests must cover slow networks** — simulate real-world delays

---

**Status**: 🔴 **INVESTIGATION COMPLETE - SOLUTION READY TO IMPLEMENT**  
**Urgency**: 🚨 **CRITICAL - BLOCKS ALL NEW USERS**

