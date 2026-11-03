import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import VerificationDashboardPage from "./VerificationDashboardPage";

describe("VerificationDashboardPage", () => {
  const dashboard = {
    profileSummary: { displayName: "Sprouts King" },
    sections: [{
      id: "bio",
      title: "Bio",
      subtitle: "Profile details",
      summary: "Profile details",
      items: [],
    }],
  };

  it("keeps XRC navigation out of the XRD overview and evidence pages", () => {
    const openXrc = jest.fn();
    render(
      <VerificationDashboardPage
        profile={{ fullName: "Sprouts King" }}
        dashboard={dashboard}
        onOpenXRC={openXrc}
        onBack={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Xeevia Record Dashboard (XRD)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /open xrc/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /bio/i }));
    expect(screen.queryByRole("button", { name: /open xrc/i })).toBeNull();
    expect(openXrc).not.toHaveBeenCalled();
  });
});
