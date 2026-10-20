import { formatProfileTag, normalizeProfileTags, PROFILE_TAG_OPTIONS } from "./profileTags";

describe("profile tags", () => {
  test("keeps only supported unique tags and caps the public list at five", () => {
    expect(normalizeProfileTags([
      "FOUNDER",
      "creator",
      "creator",
      "unverified role",
      ...PROFILE_TAG_OPTIONS,
    ])).toEqual(["creator", "founder", "builder", "artist", "designer"]);
  });

  test("formats multi-word labels for display", () => {
    expect(formatProfileTag("community leader")).toBe("Community Leader");
  });
});
