import { supabase } from "../config/supabase";
import { normalizeXrdPublicLink } from "./xrdPublicLinkModel";

const OWNER_LINK_FIELDS = "id,category,label,url,visibility,created_at,updated_at";

export async function listOwnerXrdLinks(profileId) {
  if (!profileId) throw new Error("A profile is required to load XRD links.");
  const { data, error } = await supabase
    .from("xrd_public_links")
    .select(OWNER_LINK_FIELDS)
    .eq("profile_id", profileId)
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load XRD links: ${error.message}`);
  return data || [];
}

export async function saveOwnerXrdLink(profileId, input, linkId = null) {
  if (!profileId) throw new Error("A profile is required to save an XRD link.");
  const link = normalizeXrdPublicLink(input);
  const values = { ...link, profile_id: profileId, updated_at: new Date().toISOString() };
  const query = supabase.from("xrd_public_links");
  const result = linkId
    ? await query.update(values).eq("id", linkId).eq("profile_id", profileId).select(OWNER_LINK_FIELDS).maybeSingle()
    : await query.insert(values).select(OWNER_LINK_FIELDS).single();

  if (result.error) throw new Error(`Could not save XRD link: ${result.error.message}`);
  if (!result.data) throw new Error("The XRD link was not found or could not be saved.");
  return result.data;
}

export async function deleteOwnerXrdLink(profileId, linkId) {
  if (!profileId || !linkId) throw new Error("A profile and link are required to delete an XRD link.");
  const { data, error } = await supabase
    .from("xrd_public_links")
    .delete()
    .eq("id", linkId)
    .eq("profile_id", profileId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Could not delete XRD link: ${error.message}`);
  if (!data) throw new Error("The XRD link was not found or could not be deleted.");
}
