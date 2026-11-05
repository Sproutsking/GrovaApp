import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { supabase } from "../../../services/config/supabase";
import CommunityToolPanelPosts from "./CommunityToolPanelPosts";

jest.mock("../../../services/config/supabase", () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() })),
    removeChannel: jest.fn(),
  },
}));

jest.mock("./TicketToolPanel", () => ({
  __esModule: true,
  default: ({ channelId }) => <div data-testid="ticket-panel" data-channel-id={channelId} />,
}));

jest.mock("../verification/VerificationPanel", () => ({
  __esModule: true,
  default: ({ panelType, published }) => <div data-testid={`${panelType}-panel`} data-published={String(Boolean(published))} />,
}));

describe("CommunityToolPanelPosts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads and displays the saved panels in their selected channel", async () => {
    const subscription = { on: jest.fn(), subscribe: jest.fn() };
    subscription.on.mockReturnValue(subscription);
    subscription.subscribe.mockReturnValue(subscription);
    supabase.channel.mockReturnValue(subscription);
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({
        data: [
          { id: "rules-post", tool_type: "rules", channel_id: "rules-channel" },
          { id: "verification-post", tool_type: "verification", channel_id: "rules-channel" },
          { id: "ticket-post", tool_type: "tickets", channel_id: "rules-channel" },
        ],
      }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    supabase.from.mockReturnValue(query);

    render(
      <CommunityToolPanelPosts
        communityId="community-1"
        userId="user-1"
        channelId="rules-channel"
      />,
    );

    expect(await screen.findByTestId("rules-panel")).not.toBeNull();
    expect(screen.getByTestId("rules-panel").getAttribute("data-published")).toBe("true");
    expect(screen.getByTestId("verification-panel").getAttribute("data-published")).toBe("true");
    expect(screen.getByTestId("ticket-panel").getAttribute("data-channel-id")).toBe("rules-channel");
    await waitFor(() => expect(query.eq).toHaveBeenCalledWith("channel_id", "rules-channel"));
  });

  it("revalidates cached empty results when a member returns to the channel", async () => {
    const subscription = { on: jest.fn(), subscribe: jest.fn() };
    subscription.on.mockReturnValue(subscription);
    subscription.subscribe.mockReturnValue(subscription);
    supabase.channel.mockReturnValue(subscription);

    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    supabase.from.mockReturnValue(query);

    const props = {
      communityId: "posts-cache-community",
      userId: "posts-cache-member",
      channelId: "posts-cache-channel",
    };
    const view = render(<CommunityToolPanelPosts {...props} />);
    await waitFor(() => expect(supabase.from).toHaveBeenCalledTimes(1));
    view.unmount();

    render(<CommunityToolPanelPosts {...props} />);
    await waitFor(() => expect(supabase.from).toHaveBeenCalledTimes(2));
    expect(supabase.channel).toHaveBeenCalledTimes(2);
  });

  it("renders a configured verification panel immediately while checking publication", () => {
    const subscription = { on: jest.fn(), subscribe: jest.fn() };
    subscription.on.mockReturnValue(subscription);
    subscription.subscribe.mockReturnValue(subscription);
    supabase.channel.mockReturnValue(subscription);
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(() => new Promise(() => {})),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    supabase.from.mockReturnValue(query);

    render(
      <CommunityToolPanelPosts
        communityId="instant-panel-community"
        userId="instant-panel-member"
        channelId="instant-panel-channel"
        legacyVerificationPanel
        fallbackPanelType="verification"
      />,
    );

    expect(screen.getByTestId("verification-panel")).not.toBeNull();
    expect(screen.queryByText("Loading community panel…")).toBeNull();
  });

  it("shows setup status to managers while a legacy panel is unpublished", async () => {
    const subscription = { on: jest.fn(), subscribe: jest.fn() };
    subscription.on.mockReturnValue(subscription);
    subscription.subscribe.mockReturnValue(subscription);
    supabase.channel.mockReturnValue(subscription);
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    supabase.from.mockReturnValue(query);

    render(
      <CommunityToolPanelPosts
        communityId="setup-status-community"
        userId="setup-status-owner"
        channelId="setup-status-channel"
        legacyTicketPanel
        canManage
      />,
    );

    expect(await screen.findByText("Setup in progress")).not.toBeNull();
    expect(screen.queryByTestId("ticket-panel")).toBeNull();
  });

  it("hides an unpublished legacy panel from members", async () => {
    const subscription = { on: jest.fn(), subscribe: jest.fn() };
    subscription.on.mockReturnValue(subscription);
    subscription.subscribe.mockReturnValue(subscription);
    supabase.channel.mockReturnValue(subscription);
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    supabase.from.mockReturnValue(query);

    render(
      <CommunityToolPanelPosts
        communityId="unpublished-member-community"
        userId="unpublished-member"
        channelId="unpublished-channel"
        legacyVerificationPanel
      />,
    );

    await waitFor(() => expect(query.order).toHaveBeenCalled());
    expect(screen.queryByText("Setup in progress")).toBeNull();
    expect(screen.queryByTestId("verification-panel")).toBeNull();
  });

  it("explains when a configured panel is unavailable to a member", async () => {
    const subscription = { on: jest.fn(), subscribe: jest.fn() };
    subscription.on.mockReturnValue(subscription);
    subscription.subscribe.mockReturnValue(subscription);
    supabase.channel.mockReturnValue(subscription);
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    supabase.from.mockReturnValue(query);

    render(
      <CommunityToolPanelPosts
        communityId="unavailable-panel-community"
        userId="unavailable-panel-member"
        channelId="unavailable-panel-channel"
        legacyVerificationPanel
      />,
    );

    expect(await screen.findByText(/No published panel is available here yet/)).not.toBeNull();
  });
});
