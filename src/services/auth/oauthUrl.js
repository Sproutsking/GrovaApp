export function isOAuthCallbackUrl(rawUrl = "") {
  try {
    const input = typeof rawUrl === "string" ? rawUrl : String(rawUrl || "");
    const fallback = input.startsWith("?") || input.startsWith("#") ? `https://app.local${input}` : input;
    const url = new URL(fallback, "https://app.local");
    const params = url.searchParams;

    if (params.has("error") || params.has("error_code")) {
      return false;
    }

    const code = params.get("code");
    return Boolean(code && code.trim().length > 0);
  } catch {
    return false;
  }
}

export function cleanOAuthCallbackParams(rawUrl = "") {
  try {
    const input = typeof rawUrl === "string" ? rawUrl : String(rawUrl || "");
    const fallback = input.startsWith("?") || input.startsWith("#") ? `https://app.local${input}` : input;
    const url = new URL(fallback, "https://app.local");

    ["error", "error_code", "error_description", "state", "code"].forEach((key) => {
      url.searchParams.delete(key);
    });

    return url;
  } catch {
    return new URL("https://app.local");
  }
}
