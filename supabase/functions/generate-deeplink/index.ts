import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { connection_id, change_set } = body;
    if (!connection_id || !change_set) return json({ ok: false, error: "missing params" }, 400);

    // Basic placeholder: generate a simple instruction set for manual update
    const instructions = {
      steps: [
        `Open the platform settings for connection ${connection_id}`,
        `Update display name to: ${change_set.display_name ?? "(no change)"}`,
        `Update bio to: ${change_set.bio ?? "(no change)"}`,
        `If profile image needs update, download from: ${change_set.profile_picture_url ?? "(no change)"}`,
      ],
    };

    const { data } = await supabase.from("deep_links").insert({ connection_id, platform: "unknown", instructions, link_url: null }).select().single();

    return json({ ok: true, deep_link: data });
  } catch (err) {
    console.error("generate-deeplink error", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
