import React from "react";
import { render, waitFor } from "@testing-library/react";
import PublicXrdSharePage from "./PublicXrdSharePage";
import XrcProfileRoute from "./XrcProfileRoute";
import XRDProfileDashboard from "../components/Modals/XRDProfileDashboard";
import { buildXrcDeepLink, getPublicXrdShare } from "../services/evidence/xrdPublicShareService";
import { supabase } from "../services/config/supabase";

jest.mock("../components/Modals/XRDProfileDashboard", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="xrd-dashboard" />),
  resolveXrcInitialSection: (section) => (
    ["Overview", "Identity", "Records", "Evidence", "Graph", "Chains", "Activity", "Verification", "Sources"].includes(section)
      ? section
      : "Overview"
  ),
}));

jest.mock("../services/evidence/xrdPublicShareService", () => ({
  buildXrcDeepLink: jest.fn(() => "/xrc/ada?profileId=profile-1&section=Records"),
  getPublicXrdShare: jest.fn(),
}));

jest.mock("../services/config/supabase", () => ({
  supabase: { from: jest.fn() },
}));

const publicShare = {
  profile: { id: "profile-1", username: "ada", fullName: "Ada Lovelace" },
  claims: [{ id: "claim-1", title: "Public contribution" }],
  evidenceItems: [{ id: "evidence-1", provider: "GitHub" }],
  bindings: [],
  identityDetails: { headline: "Builder" },
};

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

it("renders an anonymous XRD share from the public projection", async () => {
  getPublicXrdShare.mockResolvedValue(publicShare);

  render(<PublicXrdSharePage username="ada" />);

  await waitFor(() => {
    expect(XRDProfileDashboard.mock.calls[0][0]).toEqual(expect.objectContaining({
      targetId: "profile-1",
      publicSnapshot: publicShare,
      verificationItems: publicShare.evidenceItems,
      onOpenXRC: expect.any(Function),
    }));
  });
  expect(getPublicXrdShare).toHaveBeenCalledWith("ada");
});

it("opens authenticated XRC at the requested public claim", async () => {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { id: "profile-1", username: "ada", full_name: "Ada Lovelace", bio: "", avatar_id: null },
      error: null,
    }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  supabase.from.mockReturnValue(query);
  getPublicXrdShare.mockResolvedValue(publicShare);
  window.history.replaceState({}, "", "/xrc/ada?profileId=profile-1&section=Records&xrdRecordId=claim-1");

  render(<XrcProfileRoute username="ada" currentUser={{ id: "viewer-1" }} />);

  await waitFor(() => {
    expect(XRDProfileDashboard.mock.calls[0][0]).toEqual(expect.objectContaining({
      mode: "xrc",
      initialSection: "Records",
      xrdRecordId: "claim-1",
      publicSnapshot: publicShare,
      currentUser: { id: "viewer-1" },
    }));
  });
  expect(supabase.from).toHaveBeenCalledWith("profiles");
  expect(query.eq).toHaveBeenCalledWith("username", "ada");
  expect(getPublicXrdShare).toHaveBeenCalledWith("ada");
  expect(buildXrcDeepLink).not.toHaveBeenCalled();
});
