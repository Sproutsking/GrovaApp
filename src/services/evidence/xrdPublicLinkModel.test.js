import { normalizeXrdPublicLink, projectPublicXrdLink } from "./xrdPublicLinkModel";

const unsafeScriptUrl = ["java", "script"].join("") + ":alert(1)";

describe("normalizeXrdPublicLink", () => {
  it("normalizes an owner-provided public URL", () => {
    expect(normalizeXrdPublicLink({
      category: "social",
      label: "GitHub",
      url: "https://github.com/sprouts",
      visibility: "public",
    })).toEqual({
      category: "social",
      label: "GitHub",
      url: "https://github.com/sprouts",
      visibility: "public",
    });
  });

  it.each([
    [unsafeScriptUrl, "social", "Link"],
    ["https://user:password@example.com", "social", "Link"],
    ["https://example.com", "internal", "Link"],
  ])("rejects unsafe or invalid link input", (url, category, label) => {
    expect(() => normalizeXrdPublicLink({ url, category, label })).toThrow();
  });
});

describe("projectPublicXrdLink", () => {
  it("excludes private and malformed links from the public profile", () => {
    expect(projectPublicXrdLink({
      id: "private",
      category: "portfolio",
      label: "Portfolio",
      url: "https://example.com",
      visibility: "private",
    })).toBeNull();
    expect(projectPublicXrdLink({
      id: "invalid",
      category: "report",
      label: "Report",
      url: unsafeScriptUrl,
      visibility: "public",
    })).toBeNull();
  });

  it("projects only the public link fields", () => {
    expect(projectPublicXrdLink({
      id: "public",
      profile_id: "owner-id",
      category: "report",
      label: "Annual report",
      url: "https://example.com/report",
      visibility: "public",
      private_metadata: "not exposed",
    })).toEqual({
      id: "public",
      category: "report",
      label: "Annual report",
      url: "https://example.com/report",
      visibility: "public",
      created_at: null,
    });
  });
});
