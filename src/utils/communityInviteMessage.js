const COMMUNITY_INVITE_PREFIX = "__XEEVIA_COMMUNITY_INVITE__:";

export const createCommunityInviteMessage = (community, inviteLink) => (
  `${COMMUNITY_INVITE_PREFIX}${JSON.stringify({
    name: community?.name || "Community",
    description: community?.description || "",
    icon: community?.icon || "",
    bannerGradient: community?.banner_gradient || "",
    iconBorder: community?.icon_border || "",
    inviteLink,
  })}`
);

export const parseCommunityInviteMessage = (content) => {
  if (typeof content !== "string" || !content.startsWith(COMMUNITY_INVITE_PREFIX)) return null;

  try {
    const invite = JSON.parse(content.slice(COMMUNITY_INVITE_PREFIX.length));
    if (typeof invite?.name !== "string" || !invite.name.trim()) return null;
    if (typeof invite?.inviteLink !== "string") return null;

    const url = new URL(invite.inviteLink);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!url.searchParams.get("invite") && !/^\/invite\/[^/]+/.test(url.pathname)) return null;

    return {
      name: invite.name,
      description: typeof invite.description === "string" ? invite.description : "",
      icon: typeof invite.icon === "string" ? invite.icon : "",
      bannerGradient: typeof invite.bannerGradient === "string" ? invite.bannerGradient : "",
      iconBorder: typeof invite.iconBorder === "string" ? invite.iconBorder : "",
      inviteLink: url.toString(),
    };
  } catch {
    return null;
  }
};
