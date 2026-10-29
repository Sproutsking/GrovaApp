import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SocialUpdatesDashboard from "./SocialUpdatesDashboard";
import socialUpdatesService from "../../../services/community/socialUpdatesService";

jest.mock("../../../services/community/socialUpdatesService", () => ({
  __esModule: true,
  default: {
    listConnections: jest.fn(),
    listRouting: jest.fn(),
    saveProfileConnection: jest.fn(),
    connectLinkedSource: jest.fn(),
    saveRouting: jest.fn(),
    setRoutingEnabled: jest.fn(),
    removeRouting: jest.fn(),
    requestSync: jest.fn(),
  },
  SOCIAL_UPDATE_PROVIDER_IDS: ["x", "kick"],
  SOCIAL_PUBLIC_PROFILE_PROVIDER_IDS: ["youtube", "github", "reddit"],
  SOCIAL_PROVIDERS: [{ id: "x", label: "X", ready: true }, { id: "kick", label: "Kick", ready: false }],
}));

jest.mock("../../../services/community/channelService", () => ({ __esModule: true, default: {} }));
jest.mock("../modals/CreateChannelModal", () => () => null);
jest.mock("../../Account/IdentitySection", () => ({ PLATFORM_ICONS: {} }));
jest.mock("../../../services/community/platformCapabilities", () => ({
  getPlatformCapabilities: (provider) => provider === "x"
    ? { label: "X", inboundReady: true, inboundAdapter: "x", canDetectLive: false }
    : { label: "Kick", inboundReady: false, inboundAdapter: null, canDetectLive: false },
  getInboundReadyPlatforms: () => ["x"],
}));

const channels = [{ id: "general", name: "general", type: "text" }];
const linkedSources = [{ provider: "x", platform_user_id: "x-account", auth_status: "active" }];

describe("SocialUpdatesDashboard account activation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socialUpdatesService.listConnections.mockResolvedValue([]);
    socialUpdatesService.listRouting.mockResolvedValue([]);
  });

  it("keeps a platform inactive and unavailable until its account is linked", async () => {
    render(<SocialUpdatesDashboard communityId="community" channels={channels} canManage />);

    const toggle = await screen.findByRole("switch", { name: "X inactive" });
    expect(toggle.disabled).toBe(true);
  });

  it("lets a linked platform switch its saved route on and off", async () => {
    socialUpdatesService.listConnections.mockResolvedValue([{
      id: "source-x",
      provider: "x",
      provider_account_id: "x-account",
      display_name: "My X account",
      status: "active",
    }]);
    socialUpdatesService.listRouting.mockResolvedValue([{
      id: "route-x",
      provider: "x",
      channel_id: "general",
      enabled: true,
      connection: { provider: "x" },
    }]);

    render(<SocialUpdatesDashboard communityId="community" channels={channels} linkedSources={linkedSources} canManage />);

    const toggle = await screen.findByRole("switch", { name: "X active" });
    expect(toggle.disabled).toBe(false);
    fireEvent.click(toggle);

    await waitFor(() => expect(socialUpdatesService.setRoutingEnabled).toHaveBeenCalledWith("route-x", false));
  });

  it("activates a linked platform's saved destination only after the switch is turned on", async () => {
    socialUpdatesService.listConnections.mockResolvedValue([{
      id: "source-x",
      provider: "x",
      provider_account_id: "x-account",
      display_name: "My X account",
      status: "active",
    }]);
    socialUpdatesService.listRouting.mockResolvedValue([{
      id: "route-x",
      provider: "x",
      channel_id: "general",
      enabled: false,
      connection: { provider: "x" },
    }]);

    render(<SocialUpdatesDashboard communityId="community" channels={channels} linkedSources={linkedSources} canManage />);

    fireEvent.click(await screen.findByRole("switch", { name: "X inactive" }));

    await waitFor(() => expect(socialUpdatesService.setRoutingEnabled).toHaveBeenCalledWith("route-x", true));
  });

  it("activates a newly created route on the first switch action", async () => {
    socialUpdatesService.listConnections.mockResolvedValue([{
      id: "source-x",
      provider: "x",
      provider_account_id: "x-account",
      display_name: "My X account",
      status: "active",
    }]);

    render(<SocialUpdatesDashboard communityId="community" channels={channels} linkedSources={linkedSources} canManage />);

    fireEvent.click(await screen.findByRole("switch", { name: "X inactive" }));

    await waitFor(() => expect(socialUpdatesService.saveRouting).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: "source-x",
      channelId: "general",
      enabled: true,
    })));
  });

  it("keeps an errored source visible so its route can be retried", async () => {
    socialUpdatesService.listConnections.mockResolvedValue([{
      id: "source-x",
      provider: "x",
      provider_account_id: "x-account",
      display_name: "My X account",
      status: "error",
    }]);
    socialUpdatesService.listRouting.mockResolvedValue([{
      id: "route-x",
      provider: "x",
      channel_id: "general",
      enabled: true,
      connection: { provider: "x" },
    }]);

    render(<SocialUpdatesDashboard communityId="community" channels={channels} linkedSources={linkedSources} canManage />);

    expect(await screen.findByText("Sync error")).not.toBeNull();
    expect(screen.getByRole("switch", { name: "X active" }).disabled).toBe(false);
  });

  it("opens the route picker below its trigger and saves the chosen channel", async () => {
    socialUpdatesService.listConnections.mockResolvedValue([{
      id: "source-x",
      provider: "x",
      provider_account_id: "x-account",
      display_name: "My X account",
      status: "active",
    }]);
    socialUpdatesService.listRouting.mockResolvedValue([{
      id: "route-x",
      provider: "x",
      channel_id: "general",
      enabled: true,
      connection: { provider: "x" },
    }]);
    render(
      <SocialUpdatesDashboard
        communityId="community"
        channels={[...channels, { id: "announcements", name: "announcements", type: "text" }]}
        linkedSources={linkedSources}
        canManage
      />,
    );

    const trigger = await screen.findByRole("button", { name: /Sending updates to #general/ });
    jest.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      top: 100,
      right: 500,
      bottom: 144,
      left: 100,
      width: 400,
      height: 44,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("listbox", { name: "X update channel" });
    expect(menu.style.position).toBe("fixed");
    expect(Number(menu.style.zIndex)).toBeGreaterThan(100002);
    expect(Number.parseFloat(menu.style.top)).toBe(152);
    expect(Number.parseFloat(menu.style.maxHeight)).toBeLessThanOrEqual(window.innerHeight - 164);

    fireEvent.click(screen.getByRole("option", { name: /announcements/ }));

    await waitFor(() => expect(socialUpdatesService.saveRouting).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: "source-x",
      channelId: "announcements",
      enabled: true,
    })));
  });

  it("does not allow a linked platform with no inbound adapter to be activated", async () => {
    socialUpdatesService.listConnections.mockResolvedValue([{
      id: "source-kick",
      provider: "kick",
      provider_account_id: "kick-account",
      status: "active",
    }]);

    render(<SocialUpdatesDashboard communityId="community" channels={channels} canManage />);

    expect(await screen.findByText("Unavailable")).not.toBeNull();
    expect(screen.getByRole("switch", { name: "Kick inactive" }).disabled).toBe(true);
  });
});
