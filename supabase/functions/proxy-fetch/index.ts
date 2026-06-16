// Simple Supabase Edge Function to proxy fetch external URLs.
// Deploy: supabase functions deploy proxy-fetch --no-verify-jwt
// Allows client to call /functions/v1/proxy-fetch?url=ENCODED_URL

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

async function fetchUrl(target: string) {
  const res = await fetch(target, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text;
}

addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });

  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) return new Response(JSON.stringify({ error: "missing url" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const body = await fetchUrl(target);
    return new Response(body, { status: 200, headers: { ...CORS, "Content-Type": "text/plain;charset=utf-8" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }
}
