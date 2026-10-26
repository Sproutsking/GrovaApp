import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ChannelManagementSection from "./ChannelManagementSection";

jest.mock("../../modals/ChannelPermissionsModal", () => function MockChannelPermissionsModal({ channel, onSave }) {
  return <div role="dialog" aria-label={`Permissions for ${channel.name}`}><button type="button" onClick={onSave}>Save permissions</button></div>;
});

describe("ChannelManagementSection", () => {
  it("opens channel permissions from the managed channel row", () => {
    const onPermissionsChanged = jest.fn();
    render(
      <ChannelManagementSection
        communityId="community-1"
        roles={[{ id: "member-role", name: "Member" }]}
        channels={[{ id: "channel-1", name: "general", type: "text" }]}
        onPermissionsChanged={onPermissionsChanged}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Manage permissions for #general" }));
    expect(screen.getByRole("dialog", { name: "Permissions for general" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save permissions" }));
    expect(onPermissionsChanged).toHaveBeenCalledTimes(1);
  });

  it("keeps channel creation hidden when the manager lacks create permission", () => {
    render(<ChannelManagementSection canCreate={false} channels={[]} />);
    expect(screen.queryByRole("button", { name: "Create channel" })).toBeNull();
  });
});