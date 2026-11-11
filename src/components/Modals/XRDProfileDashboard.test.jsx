import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import XRDProfileDashboard from "./XRDProfileDashboard";

describe("XRDProfileDashboard", () => {
  it("renders the live XRD evidence dashboard and its public links", () => {
    render(
      <XRDProfileDashboard
        profile={{ id: "owner-1", fullName: "Ada Lovelace", username: "ada" }}
        verificationItems={[
          { id: "public-proof", title: "Profile proof", provider: "GitHub", evidence_type: "profile", verified: true },
        ]}
        publicLinks={[
          { id: "public-social", category: "social", label: "GitHub profile", url: "https://github.com/ada", visibility: "public" },
          { id: "private-social", category: "social", label: "Private profile", url: "https://example.com/private", visibility: "private" },
        ]}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Xeevia Record Dashboard (XRD)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evidence map" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "XRC sections" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /socials/i }));
    expect(screen.getByRole("link", { name: "Open GitHub profile" })).toHaveAttribute(
      "href",
      "https://github.com/ada",
    );
    expect(screen.queryByText("Private profile")).not.toBeInTheDocument();
  });
});
