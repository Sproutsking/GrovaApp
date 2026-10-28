import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TicketToolDashboard from "./TicketToolDashboard";

describe("TicketToolDashboard", () => {
  it("updates the member preview immediately and saves the ticket configuration", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<TicketToolDashboard onSave={onSave} />);

    fireEvent.change(screen.getAllByLabelText("Title")[0], { target: { value: "Talk to our team" } });
    expect(screen.getByRole("heading", { name: "Talk to our team" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
    expect(screen.getByRole("button", { name: "Desktop" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Save ticket setup" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Talk to our team" }));
  });

  it("allows choosing the channels where tickets are available", () => {
    const onToggleChannel = jest.fn();
    render(
      <TicketToolDashboard
        channels={[{ id: "help", name: "help", type: "text" }, { id: "voice", name: "voice", type: "voice" }]}
        onToggleChannel={onToggleChannel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /#help/ }));
    expect(onToggleChannel).toHaveBeenCalledWith("help");
    expect(screen.queryByRole("button", { name: "#voice" })).toBeNull();
  });

  it("saves the ticket setup before publishing it to selected channels", async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    const onPublish = jest.fn().mockResolvedValue(undefined);
    render(
      <TicketToolDashboard
        channels={[{ id: "help", name: "help", type: "text" }]}
        selectedChannelIds={["help"]}
        onSave={onSave}
        onPublish={onPublish}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save and publish panel" }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledWith(["help"]));
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(onPublish.mock.invocationCallOrder[0]);
  });
});
