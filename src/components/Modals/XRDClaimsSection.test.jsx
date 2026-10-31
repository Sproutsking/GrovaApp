import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import XRDClaimsSection from "./XRDClaimsSection";

describe("XRD claims and GitHub slice", () => {
  it("describes GitHub OAuth as account control rather than claim verification", () => {
    render(
      <XRDClaimsSection
        own
        connection={{ provider: "github", auth_status: "active", platform_user_id: "ada-builds" }}
        binding={{ status: "bound", assurance_scope: "account_control" }}
      />,
    );

    expect(screen.getByText(/OAuth supports control of this GitHub account/i)).not.toBeNull();
    expect(screen.getByText(/not proof of employment, authorship, or every claim/i)).not.toBeNull();
    expect(screen.getByText(/Binding: bound · account control/i)).not.toBeNull();
  });

  it("submits a self-authored claim with an explicit evidence relation", async () => {
    const onCreateClaim = jest.fn().mockResolvedValue({ id: "record-1" });
    const evidence = { id: "evidence-1", provider: "github", title: "Merged pull request #18", evidence_type: "activity" };
    render(<XRDClaimsSection own evidenceItems={[evidence]} onCreateClaim={onCreateClaim} />);

    fireEvent.click(screen.getByRole("button", { name: /add claim/i }));
    fireEvent.change(screen.getByLabelText("Record type"), { target: { value: "contribution" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Maintains Atlas" } });
    fireEvent.change(screen.getByLabelText("Claim"), { target: { value: "I maintain the Atlas open-source library." } });
    fireEvent.change(screen.getByLabelText("Link GitHub evidence (optional)"), { target: { value: "evidence-1" } });
    fireEvent.click(screen.getByRole("button", { name: /save self-authored claim/i }));

    await waitFor(() => {
      expect(onCreateClaim).toHaveBeenCalledWith(expect.objectContaining({
        recordType: "contribution",
        title: "Maintains Atlas",
        claimText: "I maintain the Atlas open-source library.",
        structuredClaim: {},
        visibility: "private",
        evidenceId: "evidence-1",
        relation: "supports",
      }));
      expect(screen.queryByLabelText("Claim")).toBeNull();
    });
  });

  it("saves structured professional details for portable CV and hiring imports", async () => {
      const onCreateClaim = jest.fn().mockResolvedValue({ id: "record-2" });
      render(<XRDClaimsSection own onCreateClaim={onCreateClaim} />);

      fireEvent.click(screen.getByRole("button", { name: /add claim/i }));
      fireEvent.change(screen.getByLabelText("Record type"), { target: { value: "employment" } });
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Product lead" } });
      fireEvent.change(screen.getByLabelText("Claim"), { target: { value: "Led the product team at Northstar." } });
      fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Product Lead" } });
      fireEvent.change(screen.getByLabelText("Organization or project"), { target: { value: "Northstar Tools" } });
      fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2023-01-01" } });
      fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2025-01-01" } });
      fireEvent.click(screen.getByRole("button", { name: /save self-authored claim/i }));

      await waitFor(() => {
        expect(onCreateClaim).toHaveBeenCalledWith(expect.objectContaining({
          structuredClaim: {
            role: "Product Lead",
            organization: "Northstar Tools",
            startDate: "2023-01-01",
            endDate: "2025-01-01",
          },
        }));
      });
  });

  it("keeps private records unchecked in the hiring pack until explicitly selected", () => {
    render(<XRDClaimsSection
      own
      profile={{ id: "profile-1" }}
      claims={[
        { id: "public", title: "Public project", record_type: "project", lifecycle_status: "published", visibility: "public" },
        { id: "private", title: "Private role", record_type: "employment", lifecycle_status: "published", visibility: "private" },
      ]}
    />);

    fireEvent.click(screen.getByRole("button", { name: /hiring pack/i }));
    expect(screen.getByLabelText("Prepare a portable hiring record")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /public project/i }).checked).toBe(true);
    expect(screen.getByRole("checkbox", { name: /private role/i }).checked).toBe(false);
  });

  it("shows source checks as observations rather than proof of a claim", () => {
    render(<XRDClaimsSection claims={[{
      id: "claim-1",
      profile_id: "profile-1",
      record_type: "contribution",
      title: "Maintains Atlas",
      claim_text: "Maintains the Atlas open-source library.",
      visibility: "private",
      lifecycle_status: "published",
      created_at: "2026-10-28T12:00:00.000Z",
      evidence_links: [],
      latest_source_check: {
        provider: "github",
        result_status: "matched",
        summary: "The selected source fields match the latest GitHub snapshot. This is not a verification of the claim.",
        completed_at: "2026-10-28T12:10:00.000Z",
      },
    }]} />);

    expect(screen.getByText("Self-asserted")).not.toBeNull();
    expect(screen.getByText(/This is not a verification of the claim/i)).not.toBeNull();
  });
});