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
    // fetch a pending job (simple single-job processor)
    const { data: jobs } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (!jobs || jobs.length === 0) return json({ ok: true, message: "no jobs" });

    const job = jobs[0];

    // mark running
    await supabase.from("sync_jobs").update({ status: "running" }).eq("id", job.id);

    // placeholder: load connections and attempt API updates
    // For now, write a simple log and mark success
    await supabase.from("sync_logs").insert({ sync_job_id: job.id, platform: "placeholder", action: "noop", result: { message: "stubbed" } });

    await supabase.from("sync_jobs").update({ status: "success" }).eq("id", job.id);

    return json({ ok: true, job: job.id });
  } catch (err) {
    console.error("identity-sync error", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
