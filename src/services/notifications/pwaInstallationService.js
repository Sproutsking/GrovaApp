import { supabase } from "../config/supabase";

const INSTALLATION_ID_KEY = "xv_pwa_installation_id";

function createInstallationId() {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    throw new Error("Secure random generation is unavailable in this browser.");
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getPwaInstallationId(storage = window.localStorage) {
  if (!storage) throw new Error("Browser storage is unavailable.");

  let installationId = storage.getItem(INSTALLATION_ID_KEY);
  if (!installationId) {
    installationId = createInstallationId();
    storage.setItem(INSTALLATION_ID_KEY, installationId);
  }
  return installationId;
}

export async function reportPwaInstallation(userId) {
  if (!userId) throw new Error("A signed-in account is required to report an installation.");

  const installationId = getPwaInstallationId();
  const { error } = await supabase
    .from("pwa_install_reports")
    .upsert(
      { user_id: userId, installation_id: installationId, last_confirmed_at: new Date().toISOString() },
      { onConflict: "user_id,installation_id" },
    );

  if (error) throw error;
  return installationId;
}

export async function listPwaInstallReports(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("pwa_install_reports")
    .select("installation_id, first_reported_at, last_confirmed_at")
    .eq("user_id", userId)
    .order("last_confirmed_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listCurrentAccountPwaInstallReports() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) return null;

  return {
    userId: data.user.id,
    reports: await listPwaInstallReports(data.user.id),
  };
}
