import React, { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { BackNavigationProvider } from "../contexts/BackNavigationContext";
import useDomBackRegistry from "./useDomBackRegistry";

const DomBackHarness = () => {
  const [isOpen, setIsOpen] = useState(true);
  useDomBackRegistry();

  return isOpen
    ? <div data-back-close onClick={() => setIsOpen(false)}>Close overlay</div>
    : null;
};

describe("useDomBackRegistry", () => {
  it("closes marked overlays on Back without adding phantom history entries", async () => {
    const forwardSpy = jest.spyOn(window.history, "forward").mockImplementation(() => {});
    render(
      <BackNavigationProvider>
        <DomBackHarness />
      </BackNavigationProvider>,
    );

    await screen.findByText("Close overlay");
    const stateBeforeBack = window.history.state;

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Close overlay")).toBeNull();
    });
    expect(forwardSpy).toHaveBeenCalledTimes(1);
    expect(window.history.state).toEqual(stateBeforeBack);

    forwardSpy.mockRestore();
  });
});
