# Platform Capability Matrix

This document separates four different jobs. A platform can support one without supporting the others.

- **Identity**: prove that a person controls an account or profile.
- **Inbound**: read creator activity into a Xeevia channel or Live feed.
- **Outbound**: publish a Xeevia post to the platform.
- **Live**: detect and display a currently live session.

A public profile link is enough for identity/discovery. It is not enough for API ingestion or publishing. Those actions require the provider's authorization and approved scopes.

## Product Capability Matrix

| Platform | Identity | Inbound creator content | Live detection | Outbound distribution | Current adapter state |
| --- | --- | --- | --- | --- | --- |
| X | OAuth/profile | Planned | No | Yes | Existing outbound adapter; inbound adapter still needed |
| Facebook Pages | OAuth | Planned | Possible | Yes | Existing outbound adapter; Page-token and inbound adapter still needed |
| Instagram Professional | Meta OAuth | Planned | Possible | Yes | Existing outbound adapter; media/account validation and inbound adapter still needed |
| TikTok | OAuth/profile | Planned | No | Not enabled | Requires approved TikTok Content API adapter |
| YouTube | Google OAuth/profile | Yes | Yes | No | Inbound adapter exists; production credentials and channel-ID resolution required |
| Twitch | Twitch OAuth/profile | Yes | Yes | No | Inbound live adapter exists; production credentials and token flow required |
| Kick | Profile | Planned | Possible | No | Identity/discovery only until an approved API adapter is available |
| Snapchat | Profile | Not assumed | No | No | Identity/discovery only; Snapchat APIs do not provide a general public story-sync contract |
| Discord | OAuth | Planned for authorized servers | No | No | Requires server/bot ingestion adapter |
| LinkedIn | OAuth | Planned | No | Yes | Existing outbound adapter; inbound adapter still needed |
| Google, GitHub, Wallet | Yes | No | No | No | Identity, verification, and evidence only |

The source of truth for this matrix in code is [`platformCapabilities.js`](../src/services/community/platformCapabilities.js).

## Credential Ownership

Never place provider secrets in React environment variables or browser code. Store them in Supabase project secrets and keep creator access/refresh tokens in the protected `tokens` table. The browser should only initiate OAuth and call Xeevia Edge Functions.

### X

**Used for**: outbound posts now; inbound posts later.

- Create an app in the [X Developer Portal](https://developer.x.com/en/portal/dashboard).
- Configure OAuth 2.0 with PKCE.
- Request `tweet.read`, `tweet.write`, `users.read`, `offline.access`, and media scopes only when required.
- Provider/app credentials belong in Supabase Auth/provider configuration.
- Creator access and refresh tokens belong in `tokens`.
- No separate API key is needed by the frontend.

### Facebook Pages and Instagram Professional

**Used for**: Page posts, Instagram media publishing, Page/Instagram inbound activity, and possible live discovery.

- Create a Meta app in [Meta for Developers](https://developers.facebook.com/apps/).
- Configure Facebook Login and the required Graph API products.
- App ID and App Secret belong in Supabase Auth/provider configuration or Edge Function secrets.
- Facebook requires Page authorization and a Page access token for Page publishing/reading.
- Instagram publishing and reading require a Professional Instagram account connected to a Facebook Page and the approved Graph scopes.
- Typical scopes include `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, and `instagram_content_publish`; request only what the approved use case needs.
- Do not treat a Facebook user token as an Instagram publishing token without resolving the connected professional account.

### TikTok

**Used for**: creator video import and outbound publishing only after approval.

- Create an app in the [TikTok for Developers portal](https://developers.tiktok.com/).
- Use Login Kit for identity and the approved Content Posting/Display APIs for creator content.
- Client key and client secret belong in the server/provider configuration.
- Creator OAuth tokens belong in `tokens`.
- TikTok API products and scopes require review/approval; the platform must remain disabled until the exact product is approved and an adapter is tested.

### YouTube

**Used for**: channel videos, Shorts metadata, and live discovery.

- Create a project in [Google Cloud Console](https://console.cloud.google.com/).
- Enable YouTube Data API v3.
- Use a restricted `YOUTUBE_API_KEY` in Supabase secrets for public channel/video polling.
- Use Google OAuth client credentials through Supabase Auth for creator-owned channel access and private/live management scopes.
- The inbound worker currently reads `YOUTUBE_API_KEY`; creator OAuth is still required when the channel or endpoint is not public.
- Resolve and persist the canonical YouTube channel ID after OAuth or URL verification. Do not rely on a handle string forever.

### Twitch

**Used for**: current live streams and creator stream metadata.

- Register an application in the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
- `TWITCH_CLIENT_ID` is the application identifier and may be used by the server.
- `TWITCH_CLIENT_SECRET` must remain a Supabase secret and is used for token exchange/refresh.
- Creator OAuth tokens belong in `tokens`; request `user:read:email` only when needed and use the least privilege for stream reads.
- For near-real-time live state, configure EventSub with a public webhook endpoint and a signing secret. Polling remains the fallback.
- The inbound worker currently reads `TWITCH_CLIENT_ID` and the stored creator token.

### Kick

**Used for**: identity/discovery now; live/content ingestion only after an approved supported API is selected.

- Do not substitute an undocumented scraper for a production integration.
- Obtain official API/partner access from [Kick Developers](https://developers.kick.com/) if the required endpoint is available for the account and use case.
- Until an official adapter, scopes, rate limits, webhook contract, and terms are verified, Kick should remain profile-link discovery plus a future adapter slot.

### LinkedIn

**Used for**: outbound professional posts now; inbound activity later.

- Create an app in the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps).
- Configure OAuth 2.0 and request `openid`, `profile`, `email`, and `w_member_social` as applicable.
- Client ID and secret belong in provider configuration; creator tokens belong in `tokens`.
- Organization/page publishing requires separate organization permissions and administrator authorization.

### Discord

**Used for**: community identity and future authorized-server ingestion.

- Create a bot/application in the [Discord Developer Portal](https://discord.com/developers/applications).
- Store the bot token only as a Supabase secret.
- Use OAuth for user identity and explicit bot authorization for server messages/events.
- Do not ingest messages merely because a user linked a Discord profile.

## Operational Rules

1. A source route may be created for any connected identity, but automatic sync is enabled only when `inboundReady` is true and valid credentials exist.
2. Outbound distribution is enabled only when `outboundReady` is true and a registered adapter exists.
3. Profile-link connections must be shown as discoverable sources, not silently treated as API-authorized sources.
4. Every inbound adapter writes normalized activities with an idempotent `(connection_id, external_id, activity_type)` key.
5. Every sync records status, item counts, and provider errors in `community_sync_runs`.
6. Live activities are queried by `activity_type = 'live'` and `status = 'live'`; they are not mixed into ordinary posts.
7. Provider credentials and creator tokens are never exposed to React components.

## Required Supabase Secrets

Already required by the application:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

For the implemented inbound adapters:

```text
YOUTUBE_API_KEY
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET   # required for refresh/token exchange when OAuth is enabled
```

For outbound adapters and future inbound adapters, add provider secrets only when their corresponding server-side adapter is implemented:

```text
X_CLIENT_ID
X_CLIENT_SECRET
META_APP_ID
META_APP_SECRET
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
DISCORD_BOT_TOKEN
KICK_CLIENT_ID
KICK_CLIENT_SECRET
```

These names are the Xeevia deployment contract. The actual provider OAuth client values come from each provider's developer console; they must not be committed to the repository.
