import { buildActivityPlatformGroups } from "./MyContentSection";

describe("buildActivityPlatformGroups", () => {
  it("always lists Xeevia first and does not invent linked-platform activity", () => {
    const groups = buildActivityPlatformGroups([{ id: "native-comment" }]);

    expect(groups.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "xeevia", label: "Xeevia" },
    ]);
    expect(groups[0].items).toHaveLength(1);
  });

  it("adds only platforms present on synced activity records", () => {
    const groups = buildActivityPlatformGroups([
      { id: "native-comment" },
      { id: "x-comment", provider: "twitter" },
      { id: "linkedin-reply", platform: "linkedin" },
    ]);

    expect(groups.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "xeevia", label: "Xeevia" },
      { key: "x", label: "X" },
      { key: "linkedin", label: "LinkedIn" },
    ]);
    expect(groups[1].items.map(({ id }) => id)).toEqual(["x-comment"]);
    expect(groups[2].items.map(({ id }) => id)).toEqual(["linkedin-reply"]);
  });
});
