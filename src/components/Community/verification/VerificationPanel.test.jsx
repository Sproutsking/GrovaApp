import React from "react";
import { render, screen } from "@testing-library/react";
import verificationService from "../../../services/community/verificationService";
import VerificationPanel from "./VerificationPanel";

jest.mock("../../../services/community/verificationService", () => ({
  __esModule: true,
  default: { getPanel: jest.fn(), complete: jest.fn() },
}));

describe("VerificationPanel", () => {
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
});
