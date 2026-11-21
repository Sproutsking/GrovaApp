import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BackNavigationProvider } from "../contexts/BackNavigationContext";
import { useNavigation } from "./useNavigation";
import { ensureHistoryIndex, getHistoryIndex } from "../utils/navigationHistory";

const NavigationHarness = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [homeSection, setHomeSection] = useState("newsfeed");
  const [accountSection, setAccountSection] = useState("profile");
  const { navigationDirection } = useNavigation(
    activeTab,
    homeSection,
    accountSection,
    setActiveTab,
    setHomeSection,
    setAccountSection,
  );

  return (
    <>
      <button type="button" onClick={() => setActiveTab("wallet")}>Open Wallet</button>
      <button type="button" onClick={() => setActiveTab("explore")}>Open Explore</button>
      <output data-testid="active-route">{`${activeTab}|${navigationDirection}`}</output>
    </>
  );
};

describe("useNavigation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", window.location.href);
    ensureHistoryIndex();
  });

  it("restores main sections across browser Back and Forward navigation", async () => {
    render(
      <BackNavigationProvider>
        <NavigationHarness />
      </BackNavigationProvider>,
    );
    await waitFor(() => expect(getHistoryIndex(window.history.state)).toBe(0));

    fireEvent.click(screen.getByRole("button", { name: "Open Wallet" }));
    await waitFor(() => {
      expect(screen.getByTestId("active-route")).toHaveTextContent("wallet|forward");
    });

    fireEvent.click(screen.getByRole("button", { name: "Open Explore" }));
    await waitFor(() => {
      expect(screen.getByTestId("active-route")).toHaveTextContent("explore|forward");
    });

    act(() => window.history.back());
    await waitFor(() => {
      expect(screen.getByTestId("active-route")).toHaveTextContent("wallet|back");
    });

    act(() => window.history.forward());
    await waitFor(() => {
      expect(screen.getByTestId("active-route")).toHaveTextContent("explore|forward");
    });
  });
});
