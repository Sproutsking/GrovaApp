import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient, getAuthUser, json, err } from "../_shared/utils.ts";

const db = serviceClient();

function normalizePermissions(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

async function hasGraphAccess(authUser: string | null, targetUser: string | null) {
  if (!authUser || !targetUser) return { allowed: false, level: "none" };
  if (authUser === targetUser) return { allowed: true, level: "full" };

  const { data, error } = await db
    .from("connections")
    .select("provider, permissions, auth_status")
    .eq("user_id", authUser)
    .eq("auth_status", "active");

  if (error) return { allowed: false, level: "none" };

  const targetRows = await db
    .from("connections")
    .select("provider, permissions, auth_status")
    .eq("user_id", targetUser)
    .eq("auth_status", "active");

  if (targetRows.error) return { allowed: false, level: "none" };

  const targetProviders = new Set((targetRows.data || []).map((row) => row.provider).filter(Boolean));
  for (const row of data || []) {
    if (!row.provider || !targetProviders.has(row.provider)) continue;
    const permissions = normalizePermissions(row.permissions);
    if (permissions.includes("graph.read") || permissions.includes("*")) {
      return { allowed: true, level: "full" };
    }
  }

  return { allowed: false, level: "none" };
}

serve(async (req) => {
  const userId = await getAuthUser(req);
  if (!userId) return err("Unauthorized", 401);

  const url = new URL(req.url);
  let body = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const profileId = url.searchParams.get("profile_id") || body.profile_id || null;
  const category = url.searchParams.get("category") || body.category || null;
  const relation = url.searchParams.get("relation") || body.relation || null;
  const limit = Number(url.searchParams.get("limit") || body.limit || 100);

  if (!profileId) return err("profile_id is required", 400);

  const access = await hasGraphAccess(userId, profileId);
  if (!access.allowed) return err("Forbidden", 403);

  const itemsQuery = db
    .from("evidence_items")
    .select("*")
    .eq("profile_id", profileId)
    .limit(limit);
  if (category) {
    itemsQuery.or(`provider.eq.${category},evidence_type.eq.${category}`);
  }

  const { data: items, error: itemsErr } = await itemsQuery;
  if (itemsErr) return err(itemsErr.message, 500);

  const itemIds = (items || []).map((item) => item.id).filter(Boolean);
  const edgesQuery = db
    .from("evidence_edges")
    .select("*")
    .or(itemIds.length ? `source_id.in.(${itemIds.join(",")}),target_id.in.(${itemIds.join(",")})` : "source_id.eq.null")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (relation) {
    edgesQuery.eq("relation", relation);
  }

  const { data: edges, error: edgesErr } = await edgesQuery;
  if (edgesErr) return err(edgesErr.message, 500);

  return json({ ok: true, profile_id: profileId, access_level: access.level, items: items || [], edges: edges || [] });
});
