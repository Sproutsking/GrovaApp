import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RulesVerificationDashboard from "./RulesVerificationDashboard";

describe("RulesVerificationDashboard previews", () => {
  it("shows one mobile preview with a device toggle", () => {
    render(<RulesVerificationDashboard />);

    expect(screen.getByText("Mobile preview")).not.toBeNull();
    expect(screen.getByRole("group", { name: "Preview device" })).not.toBeNull();
    expect(screen.queryByText("Desktop preview")).toBeNull();
    expect(screen.getByRole("separator", { name: "Resize rules editor and preview" })).not.toBeNull();
  });

  it("switches device previews and updates the selected preview as rules are edited", () => {
    render(<RulesVerificationDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
    expect(screen.getByText("Desktop preview")).not.toBeNull();
    expect(screen.queryByText("Mobile preview")).toBeNull();

    const rulesEditor = screen.getByLabelText("Community rules");

    fireEvent.change(rulesEditor, { target: { value: "Be kind\nProtect privacy" } });

    expect(screen.getByText("Protect privacy")).not.toBeNull();
    expect(screen.getByText("Be kind")).not.toBeNull();
  });

  it("allows the preview pane to be collapsed and restored", () => {
    render(<RulesVerificationDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse preview" }));
    expect(screen.queryByText("Mobile preview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));
    expect(screen.getByText("Mobile preview")).not.toBeNull();
  });

  it("supports keyboard resizing of the editor and preview split", () => {
    render(<RulesVerificationDashboard />);
    const columnSeparator = screen.getByRole("separator", { name: "Resize rules editor and preview" });

    fireEvent.keyDown(columnSeparator, { key: "ArrowRight" });

    expect(columnSeparator.getAttribute("aria-valuenow")).toBe("53");
  });

  it("saves the selected theme and owner-editable congratulations content with the rules settings", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<RulesVerificationDashboard onSave={onSave} />);

    fireEvent.click(screen.getByRole("radio", { name: /Emerald Aurora/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Congratulations message/ }), { target: { value: "Welcome to the community!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rules verification" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      experience: expect.objectContaining({
        panel: expect.objectContaining({ theme: "aurora" }),
        completion: expect.objectContaining({ message: "Welcome to the community!" }),
      }),
    })));
  });

  it("saves rules and publishes the panel to its selected channel", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onPublish = jest.fn().mockResolvedValue(undefined);
    render(
      <RulesVerificationDashboard
        value={{ enabled: true, rulesChannelId: "rules-channel" }}
        onSave={onSave}
        onPublish={onPublish}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save and publish rules panel" }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledWith("rules-channel"));
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(onPublish.mock.invocationCallOrder[0]);
  });

  it("publishes an informational rules panel when verification gating is off", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onPublish = jest.fn().mockResolvedValue(undefined);
    render(
      <RulesVerificationDashboard
        value={{ enabled: false, rulesChannelId: "rules-channel" }}
        onSave={onSave}
        onPublish={onPublish}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save and publish rules panel" }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledWith("rules-channel"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
      rulesPanelEnabled: true,
    }));
  });

  it("opens role actions for each community role and routes Manage role to role settings", () => {
    const onManageRole = jest.fn();
    render(
      <RulesVerificationDashboard
        roles={[{ id: "verified", name: "Verified", position: 1, permissions: {} }]}
        canManageRoles
        onManageRole={onManageRole}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions for Verified role" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Manage role" }));

    expect(onManageRole).toHaveBeenCalledWith("verified");
  });
});
