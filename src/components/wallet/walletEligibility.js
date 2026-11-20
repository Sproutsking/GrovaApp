export function isNigerianUser(profile) {
  if (!profile) return false;
  if (typeof profile.region === "string") {
    const region = profile.region.toLowerCase();
    if (region === "ng" || region.includes("nigeria")) return true;
  }
  if (typeof profile.phone === "string") {
    const phone = profile.phone.replace(/[\s\-()+]/g, "");
    if (phone.startsWith("234") || /^0[789][01]/.test(phone)) return true;
  }
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (timezone.toLowerCase().includes("lagos")) return true;
  } catch {
    return false;
  }
  return false;
}

export function isPayWaveEligible(profile, nativeCurrency) {
  return isNigerianUser(profile) || nativeCurrency === "NGN";
}
