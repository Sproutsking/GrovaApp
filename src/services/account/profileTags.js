export const PROFILE_TAG_OPTIONS = [
  "creator",
  "founder",
  "builder",
  "artist",
  "designer",
  "developer",
  "educator",
  "entrepreneur",
  "researcher",
  "writer",
  "community leader",
];

export const normalizeProfileTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const selected = new Set(
    tags
      .filter((tag) => typeof tag === "string")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => PROFILE_TAG_OPTIONS.includes(tag)),
  );
  return PROFILE_TAG_OPTIONS.filter((tag) => selected.has(tag)).slice(0, 5);
};

export const formatProfileTag = (tag) =>
  String(tag)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
