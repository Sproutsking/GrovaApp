import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CommunityMessageInput from "./CommunityMessageInput";

describe("CommunityMessageInput keyboard submission", () => {
  it("sends on Enter and preserves Shift+Enter for a newline", async () => {
    const onSend = jest.fn().mockResolvedValue(true);
    render(<CommunityMessageInput value="Hello" onChange={jest.fn()} onSend={onSend} />);

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});