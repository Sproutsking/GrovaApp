import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactionBar } from "./ReactionSystem";

describe("ReactionBar", () => {
  it("pops an existing reaction pill when another user adds to its count", async () => {
    const { container, rerender } = render(
      <ReactionBar reactions={{ "🔥": { count: 1, users: ["user-1"] } }} userId="user-1" />,
    );

    expect(screen.getByText("1")).not.toBeNull();
    rerender(
      <ReactionBar reactions={{ "🔥": { count: 2, users: ["user-1", "user-2"] } }} userId="user-1" />,
    );

    await waitFor(() => {
      expect(screen.getByText("2")).not.toBeNull();
      expect(container.querySelector(".rb-pill.reaction-added")).not.toBeNull();
    });
  });
});