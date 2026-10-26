import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VerificationPanelView from "./VerificationPanelView";

const panel = {
  name: "Community verification",
  message: "Complete the check to join.",
  accentColor: "#9cff00",
  panel: { theme: "aurora" },
  completion: {
    title: "Congratulations, you're verified!",
    message: "Your role is ready. Enjoy your adventure here with us.",
  },
  roleChoices: [{ id: "verified", name: "Verified", color: "#9cff00" }],
  methods: {
    quick: {
      ready: true,
      enabled: true,
      title: "Verify",
      description: "Confirm to continue.",
      buttonLabel: "Verify me",
      successTitle: "Verified",
      successDescription: "You're in.",
      requires: [],
    },
  },
};

describe("VerificationPanelView completion experience", () => {
  it("shows the editable congratulations card only after the role is assigned", async () => {
    const onComplete = jest.fn().mockResolvedValue({ success: true, method: "quick", role_id: "verified" });
    render(<VerificationPanelView panel={panel} onComplete={onComplete} onlyMethods={["quick"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Verify me" }));

    expect(await screen.findByRole("dialog", { name: "Congratulations, you're verified!" })).not.toBeNull();
    expect(screen.getByText("Your role is ready. Enjoy your adventure here with us.")).not.toBeNull();
    expect(screen.getByText("Verified")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continue to community" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("does not show congratulations when verification is waiting for role selection", async () => {
    const onComplete = jest.fn().mockResolvedValue({ success: true, needs_role_selection: true });
    render(<VerificationPanelView panel={panel} onComplete={onComplete} onlyMethods={["quick"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Verify me" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
