import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import communityService from "../../../services/community/communityService";
import FollowModel from "../../../models/FollowModel";
import dmMessageService from "../../../services/messages/dmMessageService";
import InviteModal from "./InviteModal";

jest.mock("../../../services/community/communityService", () => ({
  __esModule: true,
  default: { createInvite: jest.fn() },
}));
jest.mock("../../../models/FollowModel", () => ({
  __esModule: true,
  default: { getMutualFriends: jest.fn() },
}));
jest.mock("../../../services/messages/dmMessageService", () => ({
  __esModule: true,
  default: {
    createConversation: jest.fn(),
    sendMessage: jest.fn(),
  },
}));

describe("InviteModal DM sharing", () => {
  beforeEach(() => {
    communityService.createInvite.mockResolvedValue({ code: "ABC123" });
    FollowModel.getMutualFriends.mockResolvedValue([
      { id: "friend-1", full_name: "Friend", username: "friend" },
    ]);
    dmMessageService.createConversation.mockResolvedValue({ id: "conversation-1" });
    dmMessageService.sendMessage.mockResolvedValue({ id: "message-1" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("sends a structured community invitation to a mutual friend by DM", async () => {
    render(<InviteModal community={{ id: "community-1", name: "Design Club" }} userId="user-1" onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /send by message/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send invite/i }));

    await waitFor(() => {
      expect(dmMessageService.createConversation).toHaveBeenCalledWith("user-1", "friend-1");
      expect(dmMessageService.sendMessage).toHaveBeenCalledWith(
        "conversation-1",
        expect.stringContaining("__XEEVIA_COMMUNITY_INVITE__:"),
        "user-1",
      );
    });
    expect((await screen.findByRole("button", { name: /sent/i })).disabled).toBe(true);
  });
});
