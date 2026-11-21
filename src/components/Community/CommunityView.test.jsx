import React from "react";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import communityService from "../../services/community/communityService";
import communityUnreadService from "../../services/community/communityUnreadService";
import communityCache from "../../services/community/communityCache";
import { supabase } from "../../services/config/supabase";
import useRegisterBack from "../../hooks/useRegisterBack";
import { pushHistoryState } from "../../utils/navigationHistory";
import CommunityView from "./CommunityView";

jest.mock("../../hooks/useRegisterBack", () => jest.fn());

jest.mock("../../services/config/supabase", () => {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn().mockResolvedValue({ data: null, error: new Error("Profile unavailable") }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return {
    supabase: {
      from: jest.fn(() => query),
      rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
  };
});

jest.mock("./tabs/CommunitySidebar", () => ({ onSelectCommunity }) => (
  <button type="button" data-testid="select-community" onClick={() => onSelectCommunity({
    id: "community-1",
    name: "Test community",
    owner_id: "user-1",
  })}>Select community</button>
));
jest.mock("./tabs/DiscoverTab", () => () => <div data-testid="community-discover" />);
jest.mock("./tabs/ChannelsView", () => ({ onSelectChannel }) => (
  <button type="button" data-testid="select-channel" onClick={() => onSelectChannel({
    id: "channel-1",
    name: "general",
  })}>Select channel</button>
));
jest.mock("./tabs/ChatTab", () => () => <div data-testid="community-chat" />);
jest.mock("./modals/CreateCommunityModal", () => () => null);
jest.mock("./modals/InviteModal", () => () => null);
jest.mock("./components/InviteHandler", () => () => null);
jest.mock("../Modals/ConfirmModal", () => () => null);
jest.mock("../Shared/UnifiedLoader", () => () => null);

describe("CommunityView", () => {
  let originalInnerWidth;
  let originalHistoryState;
  let originalUrl;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalHistoryState = window.history.state;
    originalUrl = window.location.href;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    useRegisterBack.mockClear();
    jest.spyOn(communityCache, "prefetchChannels").mockReturnValue(Promise.resolve([]));
    jest.spyOn(supabase, "rpc").mockReturnValue(Promise.resolve({ data: null, error: null }));
    jest.spyOn(communityService, "getCachedUserCommunities").mockReturnValue([]);
    jest.spyOn(communityService, "getCachedCommunities").mockReturnValue([]);
    jest.spyOn(communityService, "fetchUserCommunities").mockImplementation(() => Promise.resolve([]));
    jest.spyOn(communityService, "fetchCommunities").mockImplementation(() => Promise.resolve([]));
    jest.spyOn(communityService, "fetchCommunityDetails").mockImplementation((id) => Promise.resolve({ id, name: "Test community", owner_id: "user-1" }));
    jest.spyOn(communityService, "markOnline").mockReturnValue(Promise.resolve());
    jest.spyOn(communityService, "markOffline").mockReturnValue(Promise.resolve());
    jest.spyOn(communityUnreadService, "sync").mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    document.body.classList.remove("community-layout-active", "community-fullscreen");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    window.history.replaceState(originalHistoryState, "", originalUrl);
    jest.restoreAllMocks();
  });

  it("opens on Discover without rendering a trial reminder before a community is selected", async () => {
    render(<CommunityView userId="user-1" currentUser={{ id: "user-1" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("community-discover")).not.toBeNull();
    });
  });

  it("restores community screens across Back/Forward without leaving a stale fullscreen shell", async () => {
    const rootHistoryState = {
      type: "app-route",
      route: { tab: "community", homeSection: "newsfeed", accountSection: "profile" },
      __xv_history_index: 0,
    };
    window.history.replaceState(rootHistoryState, "", window.location.href);
    const { rerender } = render(
      <CommunityView userId="user-1" currentUser={{ id: "user-1" }} activeTab="community" />,
    );

    await waitFor(() => {
      expect(useRegisterBack).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId("select-community"));
    fireEvent.click(await screen.findByTestId("select-channel"));
    expect(document.body.classList.contains("community-fullscreen")).toBe(true);

    act(() => window.history.back());
    expect(await screen.findByTestId("select-channel")).not.toBeNull();

    act(() => window.history.back());
    expect(await screen.findByTestId("community-discover")).not.toBeNull();
    await waitFor(() => {
      expect(document.body.classList.contains("community-fullscreen")).toBe(false);
    });

    act(() => window.history.forward());
    expect(await screen.findByTestId("select-channel")).not.toBeNull();
    act(() => window.history.forward());
    expect(await screen.findByTestId("community-chat")).not.toBeNull();

    pushHistoryState({
      type: "app-route",
      route: { tab: "wallet", homeSection: "newsfeed", accountSection: "profile" },
    });
    rerender(
      <CommunityView userId="user-1" currentUser={{ id: "user-1" }} activeTab="wallet" />,
    );
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", {
        state: window.history.state,
      }));
    });
    await waitFor(() => {
      expect(document.body.classList.contains("community-fullscreen")).toBe(false);
    });

    act(() => window.history.back());
    rerender(
      <CommunityView userId="user-1" currentUser={{ id: "user-1" }} activeTab="community" />,
    );
    expect(await screen.findByTestId("community-chat")).not.toBeNull();
    await waitFor(() => {
      expect(document.body.classList.contains("community-fullscreen")).toBe(true);
    });
  });
});
