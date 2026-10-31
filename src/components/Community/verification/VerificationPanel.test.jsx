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

  it("renders standalone rules passively when a different channel hosts the verification gate", async () => {
    verificationService.getPanel.mockResolvedValue({
      configured: true,
      rulesGate: { enabled: true, rulesChannelId: "verification-rules" },
      rulesPanel: {
        title: "Published community rules",
        description: "These rules are a normal community post.",
        items: [{ id: "published-rule", title: "Be helpful", body: "" }],
      },
      methods: {
        rules: {
          ready: true,
          title: "Verification gate rules",
          description: "These are for gate.",
          items: [{ id: "gate-rule", title: "Complete gate", body: "" }],
          buttonLabel: "Accept and continue",
        },
      },
    });

    render(<VerificationPanel communityId="community-1" channelId="public-rules" panelType="rules" />);

    expect(await screen.findByRole("heading", { name: "Published community rules" })).not.toBeNull();
    expect(screen.getByText("Be helpful")).not.toBeNull();
    expect(screen.queryByText("Complete gate")).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept and continue" })).toBeNull();
  });

  it("keeps the configured gate channel interactive", async () => {
    verificationService.getPanel.mockResolvedValue({
      configured: true,
      rulesGate: { enabled: true, rulesChannelId: "verification-rules", flow: "rules_only" },
      methods: {
        rules: {
          ready: true,
          title: "Gate rules",
          description: "Accept to continue.",
          items: [{ id: "rule-1", title: "Be respectful", body: "" }],
          requireScroll: false,
          requireEachRule: false,
          acceptLabel: "I agree",
          buttonLabel: "Accept and continue",
        },
      },
    });

    render(<VerificationPanel communityId="community-1" channelId="verification-rules" panelType="rules" />);

    expect(await screen.findByRole("button", { name: "Accept and continue" })).not.toBeNull();
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

  it("lets a member choose one of multiple roles after passing verification", async () => {
    const panel = {
      configured: true,
      name: "Community access",
      message: "Complete the check.",
      roleChoices: [
        { id: "reader-role", name: "Reader", color: "#60a5fa", position: 1 },
        { id: "member-role", name: "Member", color: "#34d399", position: 2 },
      ],
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
      state: { completed: [], pending: [] },
    };
    verificationService.getPanel
      .mockResolvedValueOnce(panel)
      .mockResolvedValueOnce({ ...panel, state: { completed: [], pending: ["quick"] } })
      .mockResolvedValueOnce({ ...panel, state: { completed: ["quick"], pending: [] } });
    verificationService.complete
      .mockResolvedValueOnce({ success: true, needs_role_selection: true })
      .mockResolvedValueOnce({ success: true, method: "quick", role_id: "member-role" });

    render(<VerificationPanel communityId="community-1" channelId="verify-channel" />);

    fireEvent.click(await screen.findByRole("button", { name: "Verify me" }));
    fireEvent.click(await screen.findByRole("button", { name: /Member/ }));
    fireEvent.click(screen.getByRole("button", { name: "Unlock this role" }));

    expect(await screen.findByRole("dialog", { name: "Congratulations, you're verified!" })).not.toBeNull();
    expect(verificationService.complete).toHaveBeenNthCalledWith(1, "community-1", "quick", {});
    expect(verificationService.complete).toHaveBeenNthCalledWith(2, "community-1", "quick", { roleId: "member-role" });
  });
});
