import React from "react";
import { render, screen } from "@testing-library/react";
import CommentsViewer from "./CommentsViewer";

describe("CommentsViewer", () => {
  it("renders above the profile layout through a document-level portal", () => {
    const { unmount } = render(<CommentsViewer comments={[]} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");

    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByText("No comments yet")).toBeTruthy();

    unmount();
  });
});
