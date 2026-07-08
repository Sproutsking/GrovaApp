# REACT_APP env usage report

Generated from grep across src/ on Wed Jul  8 23:21:58 UTC 2026

## REACT_APP_APP_URL

 - src/components/Admin/sections/InviteSection.jsx:29:  process.env.REACT_APP_APP_URL ||
 - src/components/Auth/PaywallGate.jsx:34:  process.env.REACT_APP_APP_URL ||

## REACT_APP_ASSEMBLYAI_API_KEY

 - src/services/transcription/transcriptionService.js:9:  apiKey: process.env.REACT_APP_ASSEMBLYAI_API_KEY || "",
 - src/services/transcription/transcriptionService.js:20:  if (!process.env.REACT_APP_ASSEMBLYAI_API_KEY) {

## REACT_APP_CLOUDFLARE_ACCOUNT_ID

 - src/services/config/cloudflare.js:5:  ACCOUNT_ID: process.env.REACT_APP_CLOUDFLARE_ACCOUNT_ID,
 - src/services/config/cloudflare.js:7:  BASE_URL: `https://api.cloudflare.com/client/v4/accounts/${process.env.REACT_APP_CLOUDFLARE_ACCOUNT_ID}/stream`

## REACT_APP_CLOUDFLARE_IMAGES_ACCOUNT_ID

 - src/services/config/cloudflare.js:12:  ACCOUNT_ID: process.env.REACT_APP_CLOUDFLARE_IMAGES_ACCOUNT_ID,
 - src/services/config/cloudflare.js:15:  UPLOAD_URL: `https://api.cloudflare.com/client/v4/accounts/${process.env.REACT_APP_CLOUDFLARE_IMAGES_ACCOUNT_ID}/images/v1`,
 - src/services/config/cloudflare.js:16:  DELIVERY_URL: `https://imagedelivery.net/${process.env.REACT_APP_CLOUDFLARE_IMAGES_ACCOUNT_ID}`

## REACT_APP_CLOUDFLARE_IMAGES_HASH

 - src/services/config/cloudflare.js:14:  DELIVERY_HASH: process.env.REACT_APP_CLOUDFLARE_IMAGES_HASH,

## REACT_APP_CLOUDFLARE_IMAGES_TOKEN

 - src/services/config/cloudflare.js:13:  API_TOKEN: process.env.REACT_APP_CLOUDFLARE_IMAGES_TOKEN,

## REACT_APP_CLOUDFLARE_STREAM_TOKEN

 - src/services/config/cloudflare.js:6:  API_TOKEN: process.env.REACT_APP_CLOUDFLARE_STREAM_TOKEN,

## REACT_APP_CLOUDINARY_API_KEY

 - src/services/config/cloudinary.js:6:  API_KEY: process.env.REACT_APP_CLOUDINARY_API_KEY,

## REACT_APP_CLOUDINARY_API_SECRET

 - src/services/config/cloudinary.js:7:  API_SECRET: process.env.REACT_APP_CLOUDINARY_API_SECRET,

## REACT_APP_CLOUDINARY_CLOUD_NAME

 - src/services/media/videoEditorService.js:8:    this.cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
 - src/services/upload/uploadService.js:10:    this.cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
 - src/services/config/cloudinary.js:5:  CLOUD_NAME: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
 - src/services/config/cloudinary.js:11:  UPLOAD_URL: `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}`,
 - src/services/config/cloudinary.js:12:  DELIVERY_URL: `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}`
 - src/services/shared/mediaUrlService.js:8:    this.cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
 - src/services/shared/mediaUrlService.js:13:      console.error('❌ REACT_APP_CLOUDINARY_CLOUD_NAME not set in .env');
 - src/components/Home/PostCard.jsx:78:  window.__CLD_CLOUD__ || process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "grova";
 - src/components/Home/PostTab.jsx:81:    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||
 - src/components/Home/HomeView.jsx:141:    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || null;
 - src/components/Home/preloadEngine.js:16:    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||
 - src/components/Home/FeedTab.jsx:128:    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||

## REACT_APP_CLOUDINARY_UPLOAD_PRESET

 - src/services/media/videoEditorService.js:9:    this.uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
 - src/services/upload/uploadService.js:11:    this.uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
 - src/services/config/cloudinary.js:8:  UPLOAD_PRESET: process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET,

## REACT_APP_CULTURE_EDGE_URL

 - src/services/explore/cultureService.js:63:      const EDGE_URL = process.env.REACT_APP_CULTURE_EDGE_URL || null;

## REACT_APP_ONESIGNAL_APP_ID

 - src/services/notifications/pushService.js:48:  return Boolean(process.env.REACT_APP_ONESIGNAL_APP_ID);
 - src/services/notifications/pushService.js:664:    console.log("OneSignal App ID:   ", process.env.REACT_APP_ONESIGNAL_APP_ID ? "✅ configured" : "❌ missing");
 - src/services/notifications/pushService.js:713:    console.log("  1. Add REACT_APP_ONESIGNAL_APP_ID to your .env file");
 - src/services/notifications/onesignalService.js:22:const ONESIGNAL_APP_ID = process.env.REACT_APP_ONESIGNAL_APP_ID || "";
 - src/services/notifications/onesignalService.js:130:    console.warn("[OneSignal] Missing REACT_APP_ONESIGNAL_APP_ID; skipping initialization");
 - src/services/notifications/onesignalService.test.js:23:  process.env.REACT_APP_ONESIGNAL_APP_ID = 'test-app-id';

## REACT_APP_ONESIGNAL_SAFARI_WEB_ID

 - src/services/notifications/onesignalService.js:23:const ONESIGNAL_SAFARI_WEB_ID = process.env.REACT_APP_ONESIGNAL_SAFARI_WEB_ID || "";

## REACT_APP_PAYSTACK_PUBLIC_KEY

 - src/services/wallet/depositFundService.js:6://    REACT_APP_PAYSTACK_PUBLIC_KEY is a build-time env variable.
 - src/services/wallet/depositFundService.js:23://        2. process.env.REACT_APP_PAYSTACK_PUBLIC_KEY  ← local dev convenience
 - src/services/wallet/depositFundService.js:265://    • REACT_APP_PAYSTACK_PUBLIC_KEY no longer needs to be in your frontend
 - src/services/wallet/depositFundService.js:342:  const PAYSTACK_KEY = serverKey || process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
 - src/services/wallet/depositFundService.js:351:      "Paystack key unavailable. Ensure your edge function (deposit-paystack-init) returns `paystackKey` (Deno.env.get(\"PAYSTACK_PUBLIC_KEY\") or REACT_APP_PAYSTACK_PUBLIC_KEY). " +

## REACT_APP_PAYSTACK_SECRET_KEY

 - src/services/economy/epEconomyService.js:203:      process.env.REACT_APP_PAYSTACK_SECRET_KEY ||

## REACT_APP_PLATFORM_WALLET_USER_ID

 - src/services/wallet/epService.js:29://   REACT_APP_PLATFORM_WALLET_USER_ID  — the Supabase auth.users UUID
 - src/services/wallet/epService.js:41:// IMPORTANT: Set REACT_APP_PLATFORM_WALLET_USER_ID in your .env
 - src/services/wallet/epService.js:52:const _PLATFORM_UUID_ENV = process.env.REACT_APP_PLATFORM_WALLET_USER_ID;
 - src/services/wallet/epService.js:64:      "[epService] ⚠ REACT_APP_PLATFORM_WALLET_USER_ID is not set!\n" +
 - src/services/wallet/epService.js:66:      "  Fix: add REACT_APP_PLATFORM_WALLET_USER_ID=<your-uuid> to .env\n" +
 - src/services/wallet/epService.js:73:      `[epService] ⚠ REACT_APP_PLATFORM_WALLET_USER_ID looks invalid: "${raw}"\n` +
 - src/services/wallet/epService.js:276:      "  Set REACT_APP_PLATFORM_WALLET_USER_ID in .env to your platform account UUID.\n" +
 - src/services/wallet/epService.js:437:        "  Set REACT_APP_PLATFORM_WALLET_USER_ID in .env."

## REACT_APP_R2_PUBLIC_URL

 - src/components/Shared/SoundGallery.jsx:53:// REACT_APP_R2_PUBLIC_URL must be set in your .env, e.g.:
 - src/components/Shared/SoundGallery.jsx:54://   REACT_APP_R2_PUBLIC_URL=https://pub-xxxx.r2.dev
 - src/components/Shared/SoundGallery.jsx:57:const R2_BASE = (process.env.REACT_APP_R2_PUBLIC_URL || "").replace(/\/$/, "");
 - src/components/Shared/SoundGallery.jsx:827:                 HAS_R2 ? "R2 configured · no DB rows" : "⚠ Set REACT_APP_R2_PUBLIC_URL"}
 - src/components/Shared/SoundGallery.jsx:950:      Add <code style={{ color: "#84cc16", background: "rgba(132,204,22,.1)", padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>REACT_APP_R2_PUBLIC_URL=https://pub-xxx.r2.dev</code> to your <code style={{ color: "#84cc16" }}>.env</code> and restart.
 - src/components/Shared/SoundGallery.jsx:964:          <code style={{ color: "#84cc16", fontSize: 10 }}>REACT_APP_R2_PUBLIC_URL=https://pub-xxx.r2.dev</code>

## REACT_APP_SOLANA_RPC_URL

 - src/services/auth/paymentService.js:686:    process.env.REACT_APP_SOLANA_RPC_URL ||

## REACT_APP_SUPABASE_ANON_KEY

 - src/services/distribution/socialConnectService.js:341:    const SUPA_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
 - src/services/config/supabase.js:41:const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;
 - src/services/config/supabase.js:45:    "[Supabase] Missing env vars. Check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.",
 - src/services/auth/authService.js:100:        const SUPA_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
 - src/components/Auth/AddAccountOverlay.jsx:271:  const SUPA_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

## REACT_APP_SUPABASE_STREAM_FUNCTION_URL

 - src/services/stream/streamService.js:16://   3. Set REACT_APP_SUPABASE_STREAM_FUNCTION_URL in your .env
 - src/services/stream/streamService.js:24:  process.env.REACT_APP_SUPABASE_STREAM_FUNCTION_URL ||
 - src/components/Stream/StreamView.jsx:24://   4. .env: REACT_APP_SUPABASE_STREAM_FUNCTION_URL=...
 - src/components/Stream/StreamView.jsx:85:  process.env.REACT_APP_SUPABASE_STREAM_FUNCTION_URL ||

## REACT_APP_SUPABASE_URL

 - src/services/distribution/socialConnectService.js:340:    const SUPA_URL = process.env.REACT_APP_SUPABASE_URL || "";
 - src/services/wallet/web3PaymentService.js:127:      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/wallet/web3PaymentService.js:187:      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/wallet/web3PaymentService.js:238:        const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/wallet/web3PaymentService.js:318:      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/wallet/web3PaymentService.js:375:      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/wallet/web3PaymentService.js:463:      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/wallet/depositFundService.js:308:  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/wallet/depositFundService.js:434:  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/wallet/opayService.js:5:const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/wallet/flutterwaveService.js:5:const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/config/supabase.js:40:const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
 - src/services/config/supabase.js:45:    "[Supabase] Missing env vars. Check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.",
 - src/services/news/newsRealtime.js:155:    `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/proxy-fetch?url=${encodeURIComponent(url)}`,
 - src/services/news/newsRealtime.js:187:    `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/proxy-fetch?url=${encodeURIComponent(ytUrl)}`,
 - src/services/news/clientNewsFetcher.js:618:    `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/proxy-fetch?url=${encodeURIComponent(url)}`,
 - src/services/stream/streamService.js:25:  `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/stream`;
 - src/services/auth/paymentService.js:602:    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/web3-verify-payment",
 - src/services/auth/paymentService.js:736:    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/web3-verify-payment",
 - src/services/auth/paymentService.js:875:    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/web3-verify-payment",
 - src/services/auth/paymentService.js:928:    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/web3-verify-payment",
 - src/services/auth/paymentService.js:975:    process.env.REACT_APP_SUPABASE_URL +
 - src/services/auth/paymentService.js:1015:    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/activate-free-code",
 - src/services/auth/authService.js:99:        const SUPA_URL = process.env.REACT_APP_SUPABASE_URL || "";
 - src/components/wallet/tabs/OverviewTab.jsx:81:                ? `${process.env.REACT_APP_SUPABASE_URL || ""}/storage/v1/object/public/avatars/${data.avatar_id}`
 - src/components/wallet/components/XevAvatar.jsx:24:      if (window._env_?.REACT_APP_SUPABASE_URL)   return window._env_.REACT_APP_SUPABASE_URL;
 - src/components/wallet/components/XevAvatar.jsx:29:        process.env.REACT_APP_SUPABASE_URL   ||
 - src/components/wallet/components/QuickActions.jsx:28:        const full = { ...data, userId: data.id, author: data.full_name || data.username, avatar: data.avatar_metadata?.publicUrl || data.avatar_metadata?.url || (data.avatar_id ? `${process.env.REACT_APP_SUPABASE_URL || ""}/storage/v1/object/public/avatars/${data.avatar_id}` : null) || null };
 - src/components/Admin/useAdminData.js:99:      process.env?.REACT_APP_SUPABASE_URL ||
 - src/components/Home/NewsVideoStrip.jsx:131:    build: (u) => `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/proxy-fetch?url=${encodeURIComponent(u)}`,
 - src/components/Home/NewsCard.jsx:191:  (u) => `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/proxy-fetch?url=${encodeURIComponent(u)}`,
 - src/components/Home/PostCard.jsx:106:  const supa = process.env.REACT_APP_SUPABASE_URL;
 - src/components/Home/PostTab.jsx:105:  const supa = process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
 - src/components/Home/preloadEngine.js:103:  const supa = process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
 - src/components/Auth/AddAccountOverlay.jsx:270:  const SUPA_URL = process.env.REACT_APP_SUPABASE_URL || "";

## REACT_APP_SW_LOCALHOST

 - src/serviceWorkerRegistration.js:10://            When SW is skipped (localhost without REACT_APP_SW_LOCALHOST=true)
 - src/serviceWorkerRegistration.js:21://     REACT_APP_SW_LOCALHOST=true

## REACT_APP_TREASURY_WALLET

 - src/services/auth/paymentService.js:547:  var treasury = process.env.REACT_APP_TREASURY_WALLET;
 - src/services/auth/paymentService.js:647:  var treasury = process.env.REACT_APP_TREASURY_WALLET_SOL;
 - src/services/auth/paymentService.js:770:  var treasury = process.env.REACT_APP_TREASURY_WALLET_ADA;
 - src/components/wallet/tabs/DepositTab.jsx:30:  evm: process.env.REACT_APP_TREASURY_WALLET || "0x62438e737C597250516798F175265E0edF446616",
 - src/components/wallet/tabs/DepositTab.jsx:31:  sol: process.env.REACT_APP_TREASURY_WALLET_SOL || "9KjmVg5UasBxNoVn9f2BFW7n6Mnhdg8GGFF5QuCX2PpS",
 - src/components/wallet/tabs/DepositTab.jsx:32:  ada: process.env.REACT_APP_TREASURY_WALLET_ADA || "addr1q8zkkwvsfrhjz3l80hvqcs93wtwy99rarz8lfmtllfhxu5zcjne5v0hv4kep395qczzcysmhxxm23zueeczxhhkgjntsplwdgf",
 - src/components/Auth/PaywallPayment.jsx:247:  const treasury = process.env.REACT_APP_TREASURY_WALLET_SOL ?? "";
 - src/components/Auth/PaywallPayment.jsx:555:  const treasury = process.env.REACT_APP_TREASURY_WALLET_ADA ?? "";

## REACT_APP_TREASURY_WALLET_ADA

 - src/services/auth/paymentService.js:770:  var treasury = process.env.REACT_APP_TREASURY_WALLET_ADA;
 - src/components/wallet/tabs/DepositTab.jsx:32:  ada: process.env.REACT_APP_TREASURY_WALLET_ADA || "addr1q8zkkwvsfrhjz3l80hvqcs93wtwy99rarz8lfmtllfhxu5zcjne5v0hv4kep395qczzcysmhxxm23zueeczxhhkgjntsplwdgf",
 - src/components/Auth/PaywallPayment.jsx:555:  const treasury = process.env.REACT_APP_TREASURY_WALLET_ADA ?? "";

## REACT_APP_TREASURY_WALLET_SOL

 - src/services/auth/paymentService.js:647:  var treasury = process.env.REACT_APP_TREASURY_WALLET_SOL;
 - src/components/wallet/tabs/DepositTab.jsx:31:  sol: process.env.REACT_APP_TREASURY_WALLET_SOL || "9KjmVg5UasBxNoVn9f2BFW7n6Mnhdg8GGFF5QuCX2PpS",
 - src/components/Auth/PaywallPayment.jsx:247:  const treasury = process.env.REACT_APP_TREASURY_WALLET_SOL ?? "";

## REACT_APP_UNSPLASH_ACCESS_KEY

 - src/services/discovery/discoveryService.js:33:const UNSPLASH_KEY  = process.env.REACT_APP_UNSPLASH_ACCESS_KEY || "";

## REACT_APP_VAPID_PUBLIC_KEY

 - src/services/notifications/pushService.js:6://            reading VAPID_PUBLIC_KEY (not REACT_APP_VAPID_PUBLIC_KEY) and
 - src/services/notifications/pushService.js:31:  const k = process.env.REACT_APP_VAPID_PUBLIC_KEY;

## REACT_APP_XRC_FORCE_DEV

 - src/services/xrc/xrcGuard.js:25:const FORCE_IN_DEV = process.env.REACT_APP_XRC_FORCE_DEV === "true";
 - src/services/xrc/xrcGuard.js:36: *   - REACT_APP_XRC_FORCE_DEV=true is set, AND
