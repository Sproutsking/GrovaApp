import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import verificationService from "../../../services/community/verificationService";
import VerificationPanel from "./VerificationPanel";

jest.mock("../../../services/community/verificationService", () => ({
  __esModule: true,
  default: { getPanel: jest.fn(), complete: jest.fn() },
}));

describe("VerificationPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("limits a published rules panel to the rules step", async () => {
    verificationService.getPanel.mockResolvedValue({
      configured: true,
      name: "Community access",
      message: "Complete the required step.",
      rulesGate: { enabled: false },
      methods: {
        rules: {
          ready: true,
          title: "Community rules",
          description: "Read these rules.",
          items: [{ id: "rule-1", title: "Be respectful", body: "" }],
          requireScroll: false,
          requireEachRule: false,
          acceptLabel: "I agree",
          buttonLabel: "Continue",
        },
        quick: {
          ready: true,
          title: "Quick verification",
          description: "Verify your account.",
          requires: [],
        },
      },
    });

    render(<VerificationPanel communityId="community-1" channelId="rules-channel" panelType="rules" />);

    expect(await screen.findByRole("heading", { name: "Community rules" })).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Quick verification" })).toBeNull();
  });

  it("automatically grants the only selected role after verification", async () => {
    verificationService.getPanel.mockResolvedValue({
      configured: true,
      name: "Community access",
      message: "Complete the required step.",
      roleChoices: [{ id: "verified-role", name: "Verified", color: "#9cff00" }],
      methods: {
        quick: {
          ready: true,
          title: "Quick verification",
          description: "Verify your account.",
          buttonLabel: "Verify me",
          successTitle: "Verified",
          successDescription: "Your access has been updated.",
          requires: [],
        },
      },
    });
    verificationService.complete
      .mockResolvedValueOnce({ success: true, needs_role_selection: true })
      .mockResolvedValueOnce({ success: true, method: "quick", role_id: "verified-role" });

    render(<VerificationPanel communityId="community-1" channelId="verify-channel" />);

    fireEvent.click(await screen.findByRole("button", { name: "Verify me" }));

    expect(await screen.findByRole("dialog", { name: "Congratulations, you're verified!" })).not.toBeNull();
    expect(verificationService.complete).toHaveBeenNthCalledWith(1, "community-1", "quick", {});
    expect(verificationService.complete).toHaveBeenNthCalledWith(2, "community-1", "quick", { roleId: "verified-role" });
    await waitFor(() => expect(verificationService.getPanel).toHaveBeenCalledTimes(2));
  });
});
