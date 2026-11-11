export const XRD_PUBLIC_LINK_CATEGORIES = ["social", "portfolio", "report"];

export function normalizeXrdPublicLink(input = {}) {
  const category = String(input.category || "").trim().toLowerCase();
  const label = String(input.label || "").trim();
  const visibility = String(input.visibility || "private").trim().toLowerCase();
  const rawUrl = String(input.url || "").trim();

  if (!XRD_PUBLIC_LINK_CATEGORIES.includes(category)) {
    throw new Error("Choose a valid link category.");
  }
  if (!label || label.length > 80) {
    throw new Error("Link labels must be between 1 and 80 characters.");
  }
  if (!["private", "public"].includes(visibility)) {
    throw new Error("Choose whether this link is private or public.");
  }
  if (!rawUrl || rawUrl.length > 2048) {
    throw new Error("Enter a valid web link.");
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid web link.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Links must use HTTP or HTTPS and cannot contain credentials.");
  }

  return { category, label, url: url.href, visibility };
}

export function projectPublicXrdLink(link) {
  if (String(link?.visibility || "").toLowerCase() !== "public") return null;
  try {
    const normalized = normalizeXrdPublicLink(link);
    return {
      id: link.id || null,
      ...normalized,
      created_at: link.created_at || null,
    };
  } catch {
    return null;
  }
}
