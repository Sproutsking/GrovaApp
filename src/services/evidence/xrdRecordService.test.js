import { compareEvidenceSnapshot, createXrdRecordService } from "./xrdRecordService";

describe("XRD source snapshot comparison", () => {
  const previous = {
    title: "Merged pull request #18",
    summary: "Added pagination support",
    url: "https://github.com/example/project/pull/18",
    external_id: "pr-18",
    evidence_type: "activity",
  };

  it("reports a match when the selected source fields are unchanged", () => {
    expect(compareEvidenceSnapshot(previous, { ...previous })).toEqual({
      resultStatus: "matched",
      changedFields: [],
    });
  });

  it("reports changed fields without upgrading the evidence status", () => {
    expect(compareEvidenceSnapshot(previous, { ...previous, summary: "Updated pagination support" })).toEqual({
      resultStatus: "changed",
      changedFields: ["summary"],
    });
  });

  it("keeps absence separate from mismatch", () => {
    expect(compareEvidenceSnapshot(previous, null)).toEqual({
      resultStatus: "not_found",
      changedFields: [],
    });
  });

  it("persists structured professional fields on the XRD record", async () => {
    const savedRecord = { id: "record-1", profile_id: "profile-1" };
    const recordQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: savedRecord, error: null }),
    };
    const auditQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null }),
    };
    const supabase = {
      from: jest.fn((table) => table === "xrd_records" ? recordQuery : auditQuery),
    };
    const xrc = { writeRecord: jest.fn().mockResolvedValue({ skipped: true }) };
    const service = createXrdRecordService(supabase, xrc);
    const structuredClaim = {
      role: "Product Lead",
      organization: "Northstar Tools",
      startDate: "2023-01-01",
      endDate: "2025-01-01",
    };

    await service.createClaim({
      profileId: "profile-1",
      actorId: "profile-1",
      recordType: "employment",
      title: "Product lead",
      claimText: "Led the product team.",
      structuredClaim,
    });

    expect(recordQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      profile_id: "profile-1",
      structured_claim: structuredClaim,
    }));
    expect(xrc.writeRecord).toHaveBeenCalledTimes(1);
  });
});