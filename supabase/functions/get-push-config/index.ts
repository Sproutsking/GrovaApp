import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !supabaseUrl || !anonKey) {
    return json({ error: "Authentication required" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const firebase = {
    apiKey: Deno.env.get("REACT_APP_FIREBASE_API_KEY") || "",
    projectId: Deno.env.get("REACT_APP_FIREBASE_PROJECT_ID") || "",
    messagingSenderId: Deno.env.get("REACT_APP_FIREBASE_SENDER_ID") || "",
    appId: Deno.env.get("REACT_APP_FIREBASE_APP_ID") || "",
  };
  const vapidKey = Deno.env.get("REACT_APP_FIREBASE_MESSAGING_VAPID_KEY") || "";
  const serverProjectId = Deno.env.get("FIREBASE_PROJECT_ID") || "";

  if (
    !firebase.apiKey ||
    !firebase.projectId ||
    !firebase.messagingSenderId ||
    !firebase.appId ||
    !vapidKey
  ) {
    console.error("[get-push-config] Firebase web configuration is incomplete");
    return json({ error: "Push notifications are not configured" }, 503);
  }

  if (!serverProjectId || firebase.projectId !== serverProjectId) {
    console.error("[get-push-config] Client and server Firebase projects do not match");
    return json({ error: "Push notifications are not configured" }, 503);
  }

  return json({ firebase, vapidKey });
});
