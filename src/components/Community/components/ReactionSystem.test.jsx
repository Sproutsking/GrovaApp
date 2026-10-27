import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactionBar } from "./ReactionSystem";

describe("ReactionBar", () => {
  it("pops an existing reaction pill when another user adds to its count", async () => {
    const { rerender } = render(
      <ReactionBar reactions={{ "🔥": { count: 1, users: ["user-1"] } }} userId="user-1" />,
    );

    expect(screen.getByText("1")).not.toBeNull();
    rerender(
      <ReactionBar reactions={{ "🔥": { count: 2, users: ["user-1", "user-2"] } }} userId="user-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("2")).not.toBeNull();
    });
  });

  it("disables reaction controls when the member's role is not allowed to react", () => {
    const onToggle = jest.fn();
    const onOpenPicker = jest.fn();
    render(
      <ReactionBar
        reactions={{ "🔥": { count: 1, users: ["user-1"] } }}
        userId="user-1"
        onToggle={onToggle}
        onOpenPicker={onOpenPicker}
        canReact={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /🔥\s*1/ }));
    fireEvent.click(screen.getByLabelText("Add a reaction"));

    expect(onToggle).not.toHaveBeenCalled();
    expect(onOpenPicker).not.toHaveBeenCalled();
    expect(screen.getAllByTitle("Reactions are disabled for your role in this channel.")).toHaveLength(2);
  });

  it("keeps footer metadata as the final item after wrapping reactions", () => {
    const { container } = render(
      <ReactionBar
        reactions={{ "🔥": { count: 1, users: ["user-1"] } }}
        userId="user-1"
        footerMeta={<span>10:23 AM</span>}
      />,
    );

    const bar = container.querySelector(".rb-bar");
    const footerMeta = bar.querySelector(".rb-footer-meta");
    expect(footerMeta.textContent).toBe("10:23 AM");
    expect(footerMeta.previousElementSibling.className).toContain("rb-pill");
  });
});