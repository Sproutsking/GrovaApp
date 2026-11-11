import { supabase } from "../config/supabase";

export const normalizeXrdShareHandle = (value) => {
  const handle = String(value || "").trim().replace(/^@+/, "");
  if (!handle || handle.includes("/") || handle.includes("?") || handle.includes("#")) {
    throw new Error("A valid XRD profile handle is required.");
  }
  return handle;
};

const isMissingPublicLinksRpc = (error) => (
  error?.code === "PGRST202" ||
  error?.code === "42883" ||
  /get_public_xrd_links.*(schema cache|does not exist|not found)/i.test(error?.message || "")
);

export async function getPublicXrdShare(username) {
  const handle = normalizeXrdShareHandle(username);
  const { data, error } = await supabase.rpc("get_public_xrd_share", { p_username: handle });
  if (error) throw error;
  if (!data) return null;
  if (!data.profile?.id || !data.profile?.username) {
    throw new Error("The public XRD response is incomplete.");
  }
  const { data: links, error: linksError } = await supabase.rpc("get_public_xrd_links", { p_username: handle });
  const linksUnavailable = Boolean(linksError && isMissingPublicLinksRpc(linksError));
  if (linksError && !linksUnavailable) throw linksError;

  return {
    profile: data.profile,
    claims: Array.isArray(data.claims) ? data.claims : [],
    evidenceItems: Array.isArray(data.evidenceItems) ? data.evidenceItems : [],
    bindings: Array.isArray(data.bindings) ? data.bindings : [],
    links: linksUnavailable ? [] : Array.isArray(links) ? links : [],
    linksWarning: linksUnavailable
      ? "Social, portfolio, and report links are temporarily unavailable. Apply the XRD public links database migration to enable them."
      : "",
    identityDetails: data.identityDetails && typeof data.identityDetails === "object" && !Array.isArray(data.identityDetails)
      ? Object.fromEntries(Object.entries(data.identityDetails).filter(([, value]) => typeof value === "string"))
      : {},
  };
}

export const buildXrcDeepLink = ({ username, profileId, section = "Overview", xrdRecordId } = {}) => {
  const handle = normalizeXrdShareHandle(username);
  if (!profileId) throw new Error("A profile is required to open XRC provenance.");
  const params = new URLSearchParams({ profileId, section });
  if (xrdRecordId) params.set("xrdRecordId", xrdRecordId);
  return `/xrc/${encodeURIComponent(handle)}?${params.toString()}`;
};

export const buildPublicXrdLink = (username, origin = "") => {
  const handle = normalizeXrdShareHandle(username);
  const path = `/xrd/${encodeURIComponent(handle)}`;
  return origin ? new URL(path, origin).toString() : path;
};
