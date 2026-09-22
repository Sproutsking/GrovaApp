import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function publicBaseUrl() {
  return (
    Deno.env.get("SOUND_LIBRARY_PUBLIC_URL") ||
    Deno.env.get("R2_PUBLIC_URL") ||
    Deno.env.get("REACT_APP_R2_PUBLIC_URL") ||
    ""
  ).replace(/\/$/, "");
}

function resolveUrl(row: Record<string, unknown>, base: string) {
  const direct = typeof row.audio_url === "string" ? row.audio_url : "";
  if (/^https?:\/\//i.test(direct)) return direct;
  const path = typeof row.storage_path === "string" && row.storage_path
    ? row.storage_path
    : typeof row.name === "string" ? row.name : "";
  if (!path) return null;
  if (base) {
    const filename = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(path) ? path : `${path}.mp3`;
    return `${base}/${filename.split("/").map(encodeURIComponent).join("/")}`;
  }
  if (row.storage_path) {
    const { data } = supabase.storage.from("sounds").getPublicUrl(String(row.storage_path));
    return data.publicUrl || null;
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const { data, error } = await supabase
    .from("sounds")
    .select("id,name,total_uses,category,is_trending,duration,audio_url,storage_path")
    .order("total_uses", { ascending: false })
    .limit(300);
  if (error) return json({ error: error.message }, 500);

  const base = publicBaseUrl();
  return json({
    configured: Boolean(base || data?.some((row) => row.audio_url || row.storage_path)),
    sounds: (data || []).filter((row) => row.name).map((row) => ({
      id: row.id || row.name,
      name: row.name,
      url: resolveUrl(row, base),
      uses: row.total_uses || 0,
      category: row.category || "all",
      trending: Boolean(row.is_trending),
      duration: row.duration || null,
    })),
  });
});
