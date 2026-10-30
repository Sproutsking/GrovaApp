import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WelcomeToolDashboard from "./WelcomeToolDashboard";

describe("WelcomeToolDashboard", () => {
  it("previews the selected design, layout, theme, highlights, and save result", async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(
      <WelcomeToolDashboard
        communityName="Xeevia Creators"
        channels={[{ id: "introductions", name: "introductions", type: "text" }]}
        value={{ title: "Make something memorable", features: ["Meet creators"] }}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Welcome to Xeevia Creators")).toBeTruthy();
    expect(screen.getByText("Meet creators")).toBeTruthy();

    fireEvent.click(screen.getByText("Poster", { selector: ".welcome-builder-design-name b" }));
    fireEvent.click(screen.getByText("Split", { selector: ".welcome-builder-layout b" }));
    fireEvent.click(screen.getByText("Gold and black", { selector: ".welcome-builder-theme b" }));

    fireEvent.change(screen.getByLabelText("Highlight 1"), { target: { value: "Join a project" } });
    expect(screen.getByText("Join a project")).toBeTruthy();

    fireEvent.click(screen.getByText("Save welcome experience"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      designId: "poster",
      layout: "split",
      themeId: "gold-black",
      features: ["Join a project"],
    })));
    expect(await screen.findByText("Welcome experience saved.")).toBeTruthy();
  });

  it("shows save errors instead of failing silently", async () => {
    render(
      <WelcomeToolDashboard
        communityName="Xeevia"
        onSave={jest.fn().mockRejectedValue(new Error("Database unavailable"))}
      />,
    );

    fireEvent.click(screen.getByText("Save welcome experience"));
    expect(await screen.findByText("Database unavailable")).toBeTruthy();
  });
});
