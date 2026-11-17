import { createCommunityInviteMessage, parseCommunityInviteMessage } from "./communityInviteMessage";

describe("community invite messages", () => {
  it("serializes and parses a community invite for direct-message cards", () => {
    const community = {
      name: "Design Club",
      description: "A place for designers",
      icon: "🎨",
      banner_gradient: "linear-gradient(135deg, #123, #456)",
      icon_border: "lime",
    };
    const message = createCommunityInviteMessage(community, "https://xeevia.example/?invite=ABC123");

    expect(parseCommunityInviteMessage(message)).toEqual({
      name: "Design Club",
      description: "A place for designers",
      icon: "🎨",
      bannerGradient: "linear-gradient(135deg, #123, #456)",
      iconBorder: "lime",
      inviteLink: "https://xeevia.example/?invite=ABC123",
    });
  });

  it("rejects malformed or non-web invite URLs", () => {
    expect(parseCommunityInviteMessage("__XEEVIA_COMMUNITY_INVITE__:not-json")).toBeNull();
    expect(parseCommunityInviteMessage(
      createCommunityInviteMessage({ name: "Unsafe" }, "javascript:alert(1)"),
    )).toBeNull();
  });
});
