import { groupVisibleChannels } from "./groupVisibleChannels";

describe("groupVisibleChannels", () => {
  it("omits categories with no channels visible to the current member", () => {
    expect(groupVisibleChannels(
      [{ id: "general", category: "Welcome" }],
      ["Welcome", "Private", "Rules"],
    )).toEqual([["Welcome", [{ id: "general", category: "Welcome" }]]]);
  });

  it("keeps visible categories ordered and groups uncategorized channels", () => {
    expect(groupVisibleChannels([
      { id: "misc", category: null },
      { id: "support", category: "Support" },
      { id: "welcome", category: "Welcome" },
    ], ["Welcome", "Support"])).toEqual([
      ["Welcome", [{ id: "welcome", category: "Welcome" }]],
      ["Support", [{ id: "support", category: "Support" }]],
      ["Channels", [{ id: "misc", category: null }]],
    ]);
  });
});
