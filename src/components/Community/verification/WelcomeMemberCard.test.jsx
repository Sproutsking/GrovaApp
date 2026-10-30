import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { supabase } from "../../../services/config/supabase";
import WelcomeMemberCard from "./WelcomeMemberCard";

jest.mock("../../../services/config/supabase", () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

jest.mock("../../../services/shared/mediaUrlService", () => ({
  __esModule: true,
  default: { resolveAvatarUrl: jest.fn(() => null) },
}));

jest.mock("../../Shared/BoostAvatarRing", () => () => null);

jest.mock("../../../services/boost/boostThemes", () => ({
  getBoostNameDesign: () => ({}),
}));

jest.mock("./WelcomeChannelCard", () => ({
  getWelcomeDesign: () => ({ craft: "banner-hero" }),
  getWelcomeTheme: () => ({ accent: "#9cff00" }),
  WelcomeCardFrame: ({ actions, heading }) => <div>{heading}{actions}</div>,
}));

describe("WelcomeMemberCard", () => {
  const props = {
    communityId: "community-1",
    memberId: "member-1",
    community: { name: "Community" },
  };
  let subscription;

  beforeEach(() => {
    window.localStorage.clear();
    subscription = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    };
    supabase.channel.mockReturnValue(subscription);
    supabase.removeChannel.mockResolvedValue(undefined);
    supabase.from.mockImplementation((table) => {
      const data = table === "profiles"
        ? { id: "member-1", username: "member", full_name: "New member" }
        : null;
      const query = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data }),
      };
      return query;
    });
  });

  it("shows Browse channels only to the member being welcomed", async () => {
    const { rerender } = render(<WelcomeMemberCard {...props} viewerId="another-member" />);

    await screen.findByRole("button", { name: "New member" });
    expect(screen.queryByRole("button", { name: "Browse channels" })).toBeNull();

    rerender(<WelcomeMemberCard {...props} viewerId="member-1" />);
    expect(await screen.findByRole("button", { name: "Browse channels" })).not.toBeNull();
  });

  it("starts channel browsing and remembers the dismissal", async () => {
    const onBrowse = jest.fn();
    const cardProps = { ...props, viewerId: "member-1", onBrowse };
    const { unmount } = render(<WelcomeMemberCard {...cardProps} />);

    fireEvent.click(await screen.findByRole("button", { name: "Browse channels" }));

    expect(onBrowse).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Browse channels" })).toBeNull();
    expect(window.localStorage.getItem("community-welcome-browse:community-1:member-1:member-1")).toBe("1");

    unmount();
    render(<WelcomeMemberCard {...cardProps} />);
    await screen.findByRole("button", { name: "New member" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Browse channels" })).toBeNull());
  });
});
