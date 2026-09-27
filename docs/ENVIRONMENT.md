# Environment Configuration

The frontend is Create React App. It reads `.env` files when `npm start` or a production build starts, and embeds every `REACT_APP_*` variable into the generated browser JavaScript. Restart the dev server after changing `.env`; already-built assets do not update when the file changes.

`.env` is gitignored by design. A local `.env` therefore does not reach GitHub or Vercel. In Vercel, add the required browser variables under **Project Settings → Environment Variables** for Development, Preview, and Production, then redeploy. The build now checks `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` and fails clearly when either is missing or a placeholder.

Use `.env.example` as the variable-name reference. Only public browser configuration belongs under `REACT_APP_`. Never use that prefix for API secrets, private keys, service-role keys, or encryption keys: CRA publishes those values in browser assets. Store server-only credentials in Vercel server environment variables or Supabase Edge Function secrets instead. Rotate any secret that has previously been built into a deployed frontend bundle.