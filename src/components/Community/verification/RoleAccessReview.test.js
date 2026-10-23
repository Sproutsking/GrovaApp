import React from "react";
import { render, screen } from "@testing-library/react";
import RoleAccessReview from "./RoleAccessReview";

describe("RoleAccessReview", () => {
  it("previews inherited category access and channel-specific overrides", () => {
    render(
      <RoleAccessReview
        role={{
          id: "verified",
          name: "Verified",
          permissions: { viewChannels: true, sendMessages: true },
        }}
        categories={[{ id: "general-category", name: "General" }]}
        channels={[
          { id: "rules", name: "rules", type: "text", category_id: "general-category" },
          { id: "private", name: "private", type: "text", category_id: "general-category" },
        ]}
        accessRules={[
          { target_type: "category", target_id: "general-category", role_id: "verified", can_view: true, can_send: false },
          { target_type: "channel", target_id: "private", role_id: "verified", can_view: false, can_send: false },
        ]}
      />,
    );

    expect(screen.getByText("1 of 2 text channels")).not.toBeNull();
    expect(screen.getByText("#rules")).not.toBeNull();
    expect(screen.getByText("Read only")).not.toBeNull();
    expect(screen.getByText("#private")).not.toBeNull();
    expect(screen.getByText("Hidden")).not.toBeNull();
  });
});
