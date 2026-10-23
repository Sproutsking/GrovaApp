import { createCommunityMention, resolveCommunityMention } from "./communityMentions";

describe("community mentions", () => {
  const members = [{ user: { id: "user-1", username: "river", full_name: "River Stone" } }];
  const roles = [{ id: "role-1", name: "Community Guides", color: "#a78bfa" }];
  const channels = [{ id: "channel-1", name: "project updates" }];

  it("creates distinct role, user, and channel tokens for names containing spaces", () => {
    expect(createCommunityMention({ type: "role", name: "Community Guides" }, "@")).toBe("@&community-guides ");
    expect(createCommunityMention({ type: "user", username: "river" }, "@")).toBe("@river ");
    expect(createCommunityMention({ type: "channel", name: "project updates" }, "#")).toBe("#project-updates ");
  });

  it("resolves role and channel tokens to their original entities and display labels", () => {
    expect(resolveCommunityMention("@&community-guides", { roles, members, channels })).toMatchObject({
      type: "role",
      entity: roles[0],
      label: "@Community Guides",
    });
    expect(resolveCommunityMention("#project-updates", { roles, members, channels })).toMatchObject({
      type: "channel",
      entity: channels[0],
      label: "#project updates",
    });
  });

  it("resolves multiword user display names and preserves special mention tokens", () => {
    expect(resolveCommunityMention("@river-stone", { roles, members, channels })).toMatchObject({
      type: "user",
      entity: members[0].user,
      label: "@River Stone",
    });
    expect(resolveCommunityMention("@everyone")).toMatchObject({ type: "everyone", slug: "everyone" });
  });
});
