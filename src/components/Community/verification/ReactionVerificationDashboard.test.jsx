import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReactionVerificationDashboard from "./ReactionVerificationDashboard";

describe("ReactionVerificationDashboard", () => {
  it("supports one to five letter answers and saves the selected correct answer", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <ReactionVerificationDashboard
        value={{
          methods: {
            reaction: {
              enabled: true,
              choices: [{ id: "A", label: "A" }, { id: "B", label: "B" }],
              correctId: "A",
            },
          },
        }}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(screen.getByRole("button", { name: /E/ })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "B Mark as correct" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Reaction Check" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      methods: expect.objectContaining({
        reaction: expect.objectContaining({ choices: expect.arrayContaining([{ id: "A", label: "A" }, { id: "E", label: "E" }]), correctId: "B" }),
      }),
    }));
  });

  it("saves the role selected for Reaction Check", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <ReactionVerificationDashboard
        roles={[{ id: "verified", name: "Verified", position: 1, permissions: {} }]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Verified role" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Reaction Check" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      methods: expect.objectContaining({ reaction: expect.objectContaining({ roleId: "verified" }) }),
    })));
  });
});
