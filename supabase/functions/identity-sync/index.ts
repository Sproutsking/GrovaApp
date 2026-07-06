import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient, json, err } from "../_shared/utils.ts";
import { decryptString } from "../_shared/crypto.ts";

const db = serviceClient();

async function verifyToken(provider: string, accessToken: string) {
  switch (provider) {
    case "x": {
      const response = await fetch("https://api.twitter.com/2/users/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.errors?.[0]?.message || String(response.status));
      }
      const data = await response.json();
      return { provider, externalId: data.data?.id || null };
    }
    case "facebook":
    case "instagram": {
      const response = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || String(response.status));
      }
      const data = await response.json();
      return { provider, externalId: data.id || null };
    }
    case "linkedin": {
      const response = await fetch("https://api.linkedin.com/v2/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || String(response.status));
      }
      const data = await response.json();
      return { provider, externalId: data.id || null };
    }
    default:
      return { provider, externalId: null };
  }
}

serve(async () => {
  let activeJobId: string | null = null;
  try {
    const { data: jobs, error: jobsErr } = await db
      .from("sync_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (jobsErr) return err(jobsErr.message, 500);
    if (!jobs || jobs.length === 0) return json({ ok: true, message: "no jobs" });

    const job = jobs[0];
    activeJobId = job.id;

    await db.from("sync_jobs").update({ status: "running", attempts: (job.attempts || 0) + 1 }).eq("id", job.id);

    const { data: connections, error: connErr } = await db
      .from("connections")
      .select("id, provider")
      .eq("user_id", job.profile_id)
      .eq("auth_status", "active");

    if (connErr) throw connErr;

    const logs: Array<Record<string, unknown>> = [];

    for (const connection of connections || []) {
      const { data: tokenRow, error: tokenErr } = await db
        .from("tokens")
        .select("encrypted_token, revoked")
        .eq("connection_id", connection.id)
        .eq("revoked", false)
        .maybeSingle();

      if (tokenErr || !tokenRow) continue;

      let accessToken = tokenRow.encrypted_token;
      if (accessToken instanceof Uint8Array || accessToken instanceof ArrayBuffer) {
        accessToken = await decryptString(new Uint8Array(accessToken));
      } else if (typeof accessToken === "string") {
        try {
          accessToken = await decryptString(accessToken);
        } catch {
          // keep plaintext fallback
        }
      }

      try {
        const result = await verifyToken(connection.provider, accessToken);
        logs.push({
          sync_job_id: job.id,
          platform: connection.provider,
          action: "verify",
          result: { verified: true, ...result },
        });
      } catch (verifyErr) {
        logs.push({
          sync_job_id: job.id,
          platform: connection.provider,
          action: "verify",
          result: { verified: false, error: String(verifyErr) },
        });
      }
    }

    if (logs.length > 0) {
      await db.from("sync_logs").insert(logs);
    }

    await db.from("sync_jobs").update({ status: "success", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
    return json({ ok: true, job: job.id, processed: logs.length });
  } catch (err) {
    console.error("identity-sync error", err);
    if (activeJobId) {
      await db.from("sync_jobs").update({ status: "failed", error_message: String(err), updated_at: new Date().toISOString() }).eq("id", activeJobId).catch(() => {});
    }
    return err(String(err), 500);
  }
});
