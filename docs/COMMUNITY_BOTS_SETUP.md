# Community Bots Setup

Apply `supabase/migrations/065_community_bots.sql` before opening the Bots tool.

## Supabase secrets

Set these secrets for the `community-bot` Edge Function:

```sh
supabase secrets set \
  DISCORD_BOT_TOKEN="your-discord-bot-token" \
  TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
```

The function also uses the platform-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` values.

Deploy it with:

```sh
supabase functions deploy community-bot
```

## Discord

1. Open the Discord Developer Portal and create or select the Xeevia application.
2. Create a Bot and copy its token into `DISCORD_BOT_TOKEN`.
3. Add the application client ID to the frontend environment as `REACT_APP_DISCORD_BOT_CLIENT_ID`.
4. Invite the bot with the dashboard link. Required permissions are View Channels, Send Messages, Embed Links, and Attach Files.
5. In the Bots dashboard, add each target channel ID and its server ID.

The bot token must never be placed in frontend environment variables or database rows.

## Telegram

1. Open Telegram and message `@BotFather`.
2. Run `/newbot`, choose a name and username, and copy the token into `TELEGRAM_BOT_TOKEN`.
3. Add the bot to each target group or channel and grant permission to post.
4. Add each target chat ID in the Bots dashboard. Use the channel/group ID supplied by Telegram, commonly a negative number or `-100...` channel ID.

The first outbound flow is text plus the Xeevia link. Media attachments can be added to the Edge Function with platform-specific upload calls after the bot destination is verified.
