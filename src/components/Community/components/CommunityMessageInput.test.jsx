import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CommunityMessageInput from "./CommunityMessageInput";

describe("CommunityMessageInput keyboard submission", () => {
  it("sends on Enter and preserves Shift+Enter for a newline", async () => {
    const onSend = jest.fn().mockResolvedValue(true);
    const { container } = render(<CommunityMessageInput value="Hello" onChange={jest.fn()} onSend={onSend} />);

    const input = screen.getByPlaceholderText("Type a message...");
    expect(container.querySelector(".comm-msg-input-bar")).toBeTruthy();
    expect(container.querySelector("style").textContent).toContain("linear-gradient(115deg, rgba(132,204,22,.58)");
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("shows announcement styling and preview controls for announcement channels", () => {
    render(
      <CommunityMessageInput
        value="Community details"
        onChange={jest.fn()}
        onSend={jest.fn()}
        channelType="announcement"
        canManageAnnouncement
      />,
    );

    expect(screen.getByText("Border")).not.toBeNull();
    expect(screen.getByPlaceholderText("Announcement title (optional)")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Preview/ }));
    expect(screen.getByText("How your post will appear")).not.toBeNull();
  });
});