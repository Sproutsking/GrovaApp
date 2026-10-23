import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VerificationToolDashboard from "./VerificationToolDashboard";

describe("VerificationToolDashboard", () => {
  it("explains why an enabled method cannot be used by members", () => {
    render(
      <VerificationToolDashboard
        value={{ methods: { quick: { enabled: true } } }}
        roles={[{ id: "default", name: "Novice", position: 2, is_default: true, permissions: {} }]}
      />,
    );

    expect(screen.getByText("Choose at least one role members can unlock.")).not.toBeNull();
    expect(screen.getByText("No eligible access roles selected. Choose a safe role above the default member role.")).not.toBeNull();
  });

  it("does not save role selection when no eligible role is selected", () => {
    const onSave = jest.fn();
    render(
      <VerificationToolDashboard
        focusMode="role_grant"
        value={{ roleGrant: { enabled: false, roleIds: [] } }}
        roles={[{ id: "default", name: "Novice", position: 2, is_default: true, permissions: {} }]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByLabelText("Enable verified role selection"));
    fireEvent.click(screen.getByRole("button", { name: "Save role grant" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Choose at least one eligible role");
  });

  it("shows the saved check as ready when returning to the setup overview", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const props = {
      value: {
        roleGrant: { enabled: true, roleIds: ["verified"] },
        methods: { quick: { enabled: false } },
      },
      roles: [
        { id: "default", name: "Novice", position: 2, is_default: true, permissions: {} },
        { id: "verified", name: "Verified", position: 1, permissions: {} },
      ],
      selectedChannelIds: ["verification"],
      onSave,
    };
    const { rerender } = render(<VerificationToolDashboard {...props} focusMode="quick" />);

    fireEvent.click(screen.getByLabelText("Activate Quick Verify"));
    fireEvent.click(screen.getByRole("button", { name: "Save Quick Verify" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    rerender(<VerificationToolDashboard {...props} focusMode={null} />);

    expect(screen.getByText("Ready")).not.toBeNull();
    expect(screen.getByText("Quick verify", { selector: "span" })).not.toBeNull();
  });
});
