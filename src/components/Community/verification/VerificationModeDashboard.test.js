import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VerificationModeDashboard from "./VerificationModeDashboard";

describe("VerificationModeDashboard", () => {
  it("saves Quick Verify using the canonical method configuration", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <VerificationModeDashboard
        mode="quick"
        value={{ version: 2, methods: { quick: { enabled: false } } }}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByLabelText("Activate Quick Verify"));
    fireEvent.click(screen.getByRole("button", { name: "Save Quick Verify" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        methods: expect.objectContaining({
          quick: expect.objectContaining({ enabled: true }),
        }),
      }));
    });
  });
});
