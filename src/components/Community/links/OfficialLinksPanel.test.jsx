import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OfficialLinksPanel from "./OfficialLinksPanel";

describe("OfficialLinksPanel", () => {
  it("adds a named button-style link and saves it to the channel config", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <OfficialLinksPanel
        channel={{ id: "official-links", name: "official-links", integrations: {} }}
        canManage
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.change(screen.getByLabelText("Button name"), { target: { value: "Our website" } });
    fireEvent.change(screen.getByLabelText("Link address"), { target: { value: "https://example.com/community" } });
    fireEvent.change(screen.getByLabelText(/Short description/), { target: { value: "Meet the community" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        label: "Our website",
        url: "https://example.com/community",
        description: "Meet the community",
      }),
    ]));
    expect(await screen.findByRole("link", { name: /Our website/ })).not.toBeNull();
  });

  it("rejects unsafe link protocols", async () => {
    const onSave = jest.fn();
    render(
      <OfficialLinksPanel
        channel={{ id: "official-links", name: "official-links", integrations: {} }}
        canManage
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.change(screen.getByLabelText("Button name"), { target: { value: "Unsafe link" } });
    fireEvent.change(screen.getByLabelText("Link address"), { target: { value: "ftp://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));

    expect((await screen.findByRole("alert")).textContent).toContain("valid http or https");
    expect(onSave).not.toHaveBeenCalled();
  });
});
