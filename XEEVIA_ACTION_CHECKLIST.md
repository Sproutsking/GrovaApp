# XEEVIA Architecture - Immediate Action Checklist

**Purpose:** Quick reference for next 13 weeks of work  
**Owner:** Development Team  
**Status:** Planning → Execution

---

## 🎯 This Week (Week 1: Documentation Foundation)

### Priority 1: Create Documentation Structure
- [ ] Create `/docs/` directory structure:
  ```
  docs/
  ├── ARCHITECTURE.md (overview, diagram)
  ├── schema/
  │   ├── TABLES.md (auto-generated reference)
  │   ├── identity-schema.sql
  │   ├── core-schema.sql
  │   └── wallet-schema.sql
  ├── services/
  │   ├── auth-service.md
  │   ├── wallet-service.md
  │   ├── content-service.md
  │   └── xrc-service.md
  ├── api/
  │   ├── oauth-endpoints.md
  │   ├── rest-endpoints.md
  │   └── realtime-subscriptions.md
  ├── config/
  │   ├── env-variables.md
  │   ├── feature-flags.md
  │   └── secrets-management.md
  ├── DEPRECATIONS.md (what's being removed)
  └── FAQ.md (common questions)
  ```

### Priority 2: Audit Secrets
- [ ] List all `process.env.*` used in codebase
  ```bash
  grep -r "process\.env\.REACT_APP" src/ | cut -d: -f2 | sort -u
  ```
- [ ] Categorize as "Required" vs "Deprecated"
- [ ] Create `/docs/config/SECRETS_AUDIT.md`
- [ ] Plan removal dates for deprecated secrets

### Priority 3: Tag Database Tables
- [ ] Add comment to each table: which Supabase it should belong to
- [ ] Categorize all 138 tables into:
  - 30-40 tables → IDENTITY
  - 60-70 tables → CORE
  - 25-35 tables → WALLET
- [ ] Create `/docs/schema/TABLE_ASSIGNMENTS.md`

### Priority 4: Service Layer Audit
- [ ] List all service files in `/src/services/`
- [ ] For each: document purpose, dependencies, current usage
- [ ] Create `/docs/services/SERVICE_INVENTORY.md`

---

## 🔐 Week 2-3: Make Xeevia an OAuth Provider

### Pre-Requisites
- [ ] Review Supabase Auth docs on custom OAuth
- [ ] Create OAuth tables (4 new tables)
- [ ] Set up edge functions deployment

### Backend
- [ ] Create `supabase/functions/oauth-authorize/`
- [ ] Create `supabase/functions/oauth-token/`
- [ ] Create `supabase/functions/oauth-userinfo/`
- [ ] Create `supabase/functions/oauth-identity/`
- [ ] Add rate limiting + security checks
- [ ] Create OAuth verification test suite

### Frontend
- [ ] Create `src/components/OAuth/OAuthAuthorize.jsx` (login + consent)
- [ ] Create `src/components/Admin/OAuthApps.jsx` (developer dashboard)
- [ ] Create `src/Modals/OAuthConsentModal.jsx`
- [ ] Route: `/auth/oauth/authorize`
- [ ] Route: `/admin/oauth-apps`

### Testing
- [ ] Unit tests for token exchange
- [ ] Integration test: mock external app OAuth flow
- [ ] Security: validate redirect_uri, client_secret, scope
- [ ] Test refresh token flow

**Deliverable:** External app can authenticate users via Xeevia

---

## 🔑 Week 4-5: Perfect Multi-Factor Authentication

### Phase 1: SMS OTP
- [ ] Review Twilio integration (already in env)
- [ ] Create `src/services/auth/smsOtpService.js`
- [ ] Wire UI in `src/components/Auth/` to use SMS
- [ ] Add SMS rate limiting (max 3 sends per hour)
- [ ] Test end-to-end

### Phase 2: Email OTP
- [ ] Refactor email sending to EmailJS template
- [ ] Create `src/services/auth/emailOtpService.js`
- [ ] Add resend limit + backoff
- [ ] Create `src/components/Auth/EmailOtpInput.jsx`

### Phase 3: WebAuthn (Biometric)
- [ ] Install `@simplewebauthn/browser`, `@simplewebauthn/server`
- [ ] Create `src/services/auth/webauthnService.js`
- [ ] Create `webauthn_credentials` table
- [ ] Create `src/components/Auth/BiometricSetup.jsx`
- [ ] Test with Windows Hello, FaceID, fingerprint

### Phase 4: Recovery Codes + Device Trust
- [ ] Refactor TwoFactorSetupModal to show 16 recovery codes
- [ ] Create `src/components/Auth/RecoveryCodesDisplay.jsx` (with download/print)
- [ ] Create `trusted_devices_enhanced` table
- [ ] Implement device trust checkbox post-2FA
- [ ] Add geolocation check + IP lookup

### Phase 5: Integration
- [ ] Update login flow to check all MFA methods
- [ ] Create MFA preference screen (which methods enabled?)
- [ ] Create MFA management UI in settings
- [ ] Test: SMS + TOTP + recovery code flows

**Deliverable:** Users can protect accounts with multiple MFA methods

---

## 🗄️ Week 6-8: Multi-Supabase Migration

### Phase 1: Preparation (Week 6)
- [ ] Provision 3 new Supabase projects:
  - `grova-identity`
  - `grova-core`
  - `grova-wallet`
- [ ] Create migration scripts for each database
- [ ] Run migrations in test environment
- [ ] Validate schema consistency

### Phase 2: Service Layer Abstraction (Week 6-7)
- [ ] Create `src/services/supabase/multiSupabaseClient.js`:
  ```typescript
  class MultiSupabaseClient {
    identity = createClient(IDENTITY_URL, IDENTITY_KEY)
    core = createClient(CORE_URL, CORE_KEY)
    wallet = createClient(WALLET_URL, WALLET_KEY)
    
    query(domain, table) {
      const client = this[domain];
      return client.from(table);
    }
  }
  ```
- [ ] Create service layer adapters:
  - `src/services/profile/profileServiceMulti.js`
  - `src/services/wallet/walletServiceMulti.js`
  - `src/services/content/contentServiceMulti.js`
- [ ] Add feature flag: `USE_MULTI_SUPABASE`

### Phase 3: Gradual Cutover (Week 7-8)
- [ ] Enable multi-Supabase in dev environment
- [ ] Test with small user cohort (internal team)
- [ ] Monitor performance + errors
- [ ] Gradual rollout: 5% → 25% → 50% → 100%
- [ ] Monitoring dashboard for cross-database queries

### Phase 4: Validation (Week 8)
- [ ] Sync verification: compare old vs new DB
- [ ] Failover testing: what if one Supabase goes down?
- [ ] Data consistency checks
- [ ] Performance benchmarks

**Deliverable:** All data properly distributed across 3 databases

---

## 🖼️ Week 9-10: Multi-Cloudinary Strategy

### Phase 1: Provision Accounts (Week 9)
- [ ] Create 4 new Cloudinary accounts:
  - `xeevia-profiles` (avatars, covers)
  - `xeevia-content` (posts, images)
  - `xeevia-reels` (videos, streaming)
  - `xeevia-admin` (internal, backups)
- [ ] Configure each with appropriate transformations
- [ ] Set up CDN + backup policies

### Phase 2: Update Services (Week 9)
- [ ] Create `src/services/shared/multiCloudinaryService.js`
- [ ] Update `MediaUploader.jsx` to use appropriate account
- [ ] Create transformation presets per account:
  ```typescript
  const AVATAR_TRANSFORMS = {
    thumb: { width: 100, height: 100, crop: 'fill' },
    display: { width: 200, height: 200, crop: 'fill' }
  };
  ```

### Phase 3: Migration (Week 10)
- [ ] Export all existing media from old account
- [ ] Migrate avatars → `xeevia-profiles`
- [ ] Migrate post images → `xeevia-content`
- [ ] Migrate videos → `xeevia-reels`
- [ ] Update `image_ids`, `video_ids` in DB with new URLs
- [ ] Parallel run: old + new account for 1 week

### Phase 4: Optimize
- [ ] Configure auto-scaling per account
- [ ] Set up rate limiting alarms
- [ ] Create cost dashboard

**Deliverable:** Media properly organized across 4 accounts with optimized delivery

---

## 📚 Week 11-12: Feature Enablement (Use What We Built)

### Real-Time Features
- [ ] Expose typing indicators in comments
- [ ] Show live viewers in posts/streams
- [ ] Real-time cursor in collaborative features
- [ ] Test performance with 1000+ users

### Evidence Visualization
- [ ] Create "Trust Score" card on profile
- [ ] Build XRC evidence explorer (public)
- [ ] Show "verified post" badges with proof
- [ ] Create evidence timeline UI

### Push Notifications Enhancement
- [ ] Add action buttons (reply, retweet, etc.)
- [ ] Add deep linking to content
- [ ] Create notification scheduling API
- [ ] Test with OnSignal + native push

### Community Features
- [ ] Enable voting/polls
- [ ] Create role-based access UI
- [ ] Build moderation queue
- [ ] Create report + review system

### Wallet Intelligence
- [ ] Create portfolio dashboard
- [ ] Build transaction analytics
- [ ] Add spend categorization
- [ ] Create budget alerts

**Deliverable:** 10 major features now fully functional

---

## 🧹 Week 13: Cleanup & Final Polish

### Remove Deprecated Code
- [ ] Delete `src/services/auth/legacyAuthService.js`
- [ ] Delete `src/services/wallet/oldPaymentService.js`
- [ ] Delete duplicate components
- [ ] Remove unused imports from index files

### Archive Old Data
- [ ] Move backup tables to archive schema:
  ```sql
  CREATE SCHEMA archive;
  ALTER TABLE public.posts_backup SET SCHEMA archive;
  ALTER TABLE public.reels_backup SET SCHEMA archive;
  ```
- [ ] Document retention policy
- [ ] Set expiration dates

### Final Documentation Pass
- [ ] Ensure every service has README
- [ ] Ensure every endpoint is documented
- [ ] Create "Architecture Decision Records" (ADRs)
- [ ] Create "Troubleshooting Guide"
- [ ] Create "Runbook" for common operations

### Deploy & Verify
- [ ] Merge all to `main`
- [ ] Deploy to staging
- [ ] Run full test suite
- [ ] Deploy to production with monitoring

**Deliverable:** Clean, well-documented codebase ready for team handoff

---

## 📊 Success Criteria

**By End of Week 13, Xeevia Will:**

✅ Be an OAuth provider (external apps can authenticate)  
✅ Have perfect MFA (6 methods, all optional)  
✅ Have organized databases (3 Supabase instances, clear boundaries)  
✅ Have optimized media delivery (4 Cloudinary accounts, separate transformations)  
✅ Have enabled 10+ hidden features (real-time, evidence, community, wallet AI)  
✅ Have comprehensive documentation (every service, every table, every endpoint)  
✅ Have clean codebase (no deprecated code, no unused secrets, no confusion)  

**Team will be able to:**
- Onboard a new developer in 1 day (vs 1 week currently)
- Add a new OAuth client in < 5 minutes
- Scale any component independently
- Understand data flow without reading code

---

## 🔄 Weekly Check-ins

**Every Friday at 2pm:**
- What did we complete?
- What blockers came up?
- Do estimates need adjustment?
- Which item moves to next week?

**Metrics to track:**
- Deployment frequency (target: daily)
- Test coverage (target: >80%)
- Documentation completeness (target: 100%)
- Team onboarding time (target: <1 day)

---

## Questions to Answer Before Starting

1. **Multi-Supabase:** Is PCI-DSS compliance required? (Affects wallet DB design)
2. **OAuth:** What scopes should we expose first? (identity, email, connections, trust_score)
3. **MFA:** Do we require TFA for everyone or make it optional?
4. **Documentation:** Markdown files or Notion? (Affects tooling)
5. **Cloudinary:** Should we geo-replicate the reels account?

---

**Next Step:** Schedule planning session to confirm approach + estimates.
