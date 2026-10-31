import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import XRDPrototypePreview from "./XRDPrototypePreview";

describe("XRD prototype state preview", () => {
  it("labels the sample records as example data and shows the verified provenance path", () => {
    render(<XRDPrototypePreview />);

    expect(screen.getByText("EXAMPLE DATA")).not.toBeNull();
    expect(screen.getByText("GitHub OAuth binding")).not.toBeNull();
    expect(screen.getByText(/does not verify the account owner's legal identity/i)).not.toBeNull();
  });

  it.each([
    ["disputed", "Correction remark"],
    ["expired", "Status: expired"],
    ["revoked", "Status: revoked"],
    ["unavailable", "Retry when source returns"],
    ["restricted", "Claim content hidden"],
    ["empty", "No XRD records yet"],
    ["loading", "Checking the registered source"],
    ["error", "Records could not be loaded"],
  ])("previews the %s state with its appropriate explanation", (state, expectedText) => {
    render(<XRDPrototypePreview />);
    fireEvent.click(screen.getByRole("tab", { name: XRD_STATE_LABELS[state] }));

    expect(screen.getByRole("tabpanel").getAttribute("data-fixture-state")).toBe(state);
    expect(screen.getAllByText(new RegExp(expectedText, "i")).length).toBeGreaterThan(0);
  });
});

const XRD_STATE_LABELS = {
  disputed: "Disputed",
  expired: "Expired",
  revoked: "Revoked",
  unavailable: "Source unavailable",
  restricted: "Restricted",
  empty: "Empty",
  loading: "Loading",
  error: "Error",
};