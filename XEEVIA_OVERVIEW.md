# XEEVIA Platform Overview

## What is XEEVIA?
XEEVIA is a full-featured digital creator platform and social finance experience built for modern content communities, seamless wallet interactions, and web-native payments.

At its core, XEEVIA combines:
- social publishing and content discovery,
- community management and messaging,
- a dual-currency wallet economy,
- fast in-app payments and peer-to-peer transfers,
- a Progressive Web App shell for instant mobile-like performance.

XEEVIA is designed to make creator value flow directly through the platform while keeping account security, speed, and real-world payments front and center.

## Key Product Experience

### Social and Content
- Feed and discovery streams with personalized, trending, and community content.
- Full post creation and rich media support including images, video, and reels.
- Explore and search features for tags, trending topics, communities, and live streams.
- Content distribution tools for cross-posting and preserving canonical content on XEEVIA.

### Communities and Messaging
- Community spaces with dedicated tabs and real-time interaction.
- Direct messaging, group chat support, and incoming call handling.
- Notifications, support channels, and in-app toasts for live updates.

### Wallet and Payments
- XEEVIA Wallet with dual-currency support: $XEV token economy and EP credits.
- PayWave service for instant NGN payments, airtime, data, bills, and financial services.
- Secure deposit, withdrawal, and P2P money transfer flows.
- Premium service section for rewards, upgrade tiers, gift cards, and embedded financial products.
- Integrated Paystack and OPay support for local currency settlement.

### Creator Value and Premium Tools
- Boost and premium profile features for creator monetization.
- Reward systems, gift cards, scholarship and staking-style products.
- Admin tools for platform control, audit trails, and service moderation.

## Architecture and Codebase

### Frontend
- **React 18** application built with **Create React App** (`react-scripts`).
- `src/App.jsx` serves as the main shell, with heavy use of `React.lazy` and `Suspense` for deferred component loading.
- Client-side navigation is managed with custom tab rendering rather than bulky route frameworks, delivering a fast shell-first experience.
- Progressive Web App support through service worker registration, update/install prompt handling, and offline fallback pages.

### Backend and Services
- **Supabase** powers authentication, database, real-time updates, and edge functions.
- `supabase/functions/` contains serverless logic for payment checkout, push notification handling, 2FA, streaming, and withdrawals.
- Supabase Realtime channels are used for live wallet balance updates and notifications.

### Integrations
- **OneSignal** for push notifications and in-app toast dispatch.
- **Cloudflare Stream** for video playback and live streaming support.
- **Lucide React** for iconography and fast UI visuals.
- **WebPush / PWA** for installable app behavior and refresh/update prompts.
- **Crypto libraries** like `@solana/web3.js`, `@emurgo/cardano-serialization-lib-browser`, `crypto-js`, `otpauth`, and `qrcode` for wallet, identity, and security features.

## Platform Features

### Navigation and UX
- App shell with shared headers, sidebars, mobile bottom navigation, and service modals.
- Fast tab switching with preloaded views and deferred render paths.
- Smooth service panel animations and instant open/close transitions.
- Adaptive mobile/desktop layouts with custom bottom sheets and desktop modal UX.

### Security and Wallet Hardening
- PIN-protected withdrawal and P2P flows.
- Account verification, two-factor authentication (2FA), and secure session handling.
- Payment gating and audit-aware write flows using `xrcService`.

### Advanced Content and Community
- `XRCOracleExplorer` for chain explorer and content provenance.
- Community moderation, role management, and topic-specific sections.
- Support center with FAQ, contact, and help tabs built into the app.

## Technology Stack

### Core Technologies
- React 18
- Create React App
- JavaScript / JSX
- CSS-driven component styling

### Backend and Infrastructure
- Supabase (Auth, Database, Realtime, Storage)
- Supabase Edge Functions
- Vercel-friendly deployment pipeline

### Payment and Wallet
- Paystack integration
- OPay integration
- In-app wallet balance updates
- XEEVIA dual-currency wallet model

### Notifications and Offline
- OneSignal push notifications
- Service worker registration and offline caching
- Custom prompt management for update/install flows

### Developer and Build Tools
- `react-scripts` build tooling
- `cross-env` build environment control
- `npm` scripts for local development, production build, and wallet checks

## Why XEEVIA?
XEEVIA is more than a social app. It is a mobile-first creator ecosystem that connects content, community, and commerce in one experience.

Its core strength is combining a polished, high-speed interface with deep payment and wallet functionality, while preserving creator ownership, secure finance flows, and real-time interaction.

This overview is intended to capture XEEVIA’s current identity, feature set, and engineering direction as present in the repository.
