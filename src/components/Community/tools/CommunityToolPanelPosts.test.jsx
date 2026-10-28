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
  default: ({ panelType }) => <div data-testid={`${panelType}-panel`} />,
}));

describe("CommunityToolPanelPosts", () => {
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
    expect(screen.getByTestId("ticket-panel").getAttribute("data-channel-id")).toBe("rules-channel");
    await waitFor(() => expect(query.eq).toHaveBeenCalledWith("channel_id", "rules-channel"));
  });
});
