# Call ICE configuration

This authenticated Edge Function mints short-lived Twilio Network Traversal
credentials for WebRTC calls. The Twilio account credentials stay server-side;
only the temporary ICE server credentials are returned to the signed-in user.

Configure these Supabase secrets with a Twilio Account SID and an API Key SID
and Secret (use an API key with access to the Network Traversal Tokens API):

```sh
supabase secrets set \
  TWILIO_ACCOUNT_SID=AC... \
  TWILIO_API_KEY_SID=SK... \
  TWILIO_API_KEY_SECRET=...
```

Deploy the function after setting the secrets:

```sh
supabase functions deploy get-call-ice-config
```

The function requests 1-hour credentials. The app falls back to public STUN
servers if the function or Twilio is unavailable, but restrictive networks may
then be unable to connect.
