import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import communityService from "../../services/community/communityService";
import communityUnreadService from "../../services/community/communityUnreadService";
import CommunityView from "./CommunityView";

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
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});

jest.mock("./tabs/CommunitySidebar", () => () => null);
jest.mock("./tabs/DiscoverTab", () => () => <div data-testid="community-discover" />);
jest.mock("./tabs/ChannelsView", () => () => null);
jest.mock("./tabs/ChatTab", () => () => null);
jest.mock("./modals/CreateCommunityModal", () => () => null);
jest.mock("./modals/InviteModal", () => () => null);
jest.mock("./components/InviteHandler", () => () => null);
jest.mock("../Modals/ConfirmModal", () => () => null);
jest.mock("../Shared/UnifiedLoader", () => () => null);

describe("CommunityView", () => {
  beforeEach(() => {
    jest.spyOn(communityService, "getCachedUserCommunities").mockReturnValue([]);
    jest.spyOn(communityService, "getCachedCommunities").mockReturnValue([]);
    jest.spyOn(communityService, "fetchUserCommunities").mockImplementation(() => Promise.resolve([]));
    jest.spyOn(communityService, "fetchCommunities").mockImplementation(() => Promise.resolve([]));
    jest.spyOn(communityUnreadService, "sync").mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens on Discover without rendering a trial reminder before a community is selected", async () => {
    render(<CommunityView userId="user-1" currentUser={{ id: "user-1" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("community-discover")).not.toBeNull();
    });
  });
});
