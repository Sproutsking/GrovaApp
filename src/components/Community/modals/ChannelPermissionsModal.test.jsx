import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChannelPermissionsModal from "./ChannelPermissionsModal";

jest.mock("../../../services/config/supabase", () => ({
  supabase: { from: jest.fn() },
}));
import { supabase } from "../../../services/config/supabase";

const mockQuery = {};

beforeEach(() => {
  Object.assign(mockQuery, {
    select: jest.fn(() => mockQuery),
    eq: jest.fn(() => mockQuery),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    delete: jest.fn(() => mockQuery),
    in: jest.fn().mockResolvedValue({ error: null }),
    then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
  });
  supabase.from.mockReturnValue(mockQuery);
});

describe("ChannelPermissionsModal", () => {
  it("groups duplicate role names and applies permission overrides to every matching role ID", async () => {
    render(
      <ChannelPermissionsModal
        channel={{ id: "channel-1", name: "general" }}
        communityId="community-1"
        roles={[
          { id: "member-a", name: "Member", position: 1 },
          { id: "member-b", name: "Member", position: 2 },
        ]}
        onClose={jest.fn()}
      />,
    );

    const memberRole = await screen.findByRole("button", { name: "Select role Member (member-a)" });
    expect(screen.queryByRole("button", { name: "Select role Member (member-b)" })).toBeNull();
    expect(memberRole.textContent).toContain("2");
    const allowView = await screen.findByRole("button", { name: "Set View Channel for Member to Allow" });
    const inheritView = screen.getByRole("button", { name: "Set View Channel for Member to Inherit" });

    expect(inheritView.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(allowView);
    expect(allowView.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mockQuery.upsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ role_id: "member-a", permission: "viewChannel", state: "allow" }),
      expect.objectContaining({ role_id: "member-b", permission: "viewChannel", state: "allow" }),
    ]), { onConflict: "channel_id,role_id,permission" }));
    expect(memberRole.getAttribute("aria-pressed")).toBe("true");
  });
});
