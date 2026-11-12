import { getChannelDraft, setChannelDraft } from "./channelDrafts";

describe("channel message drafts", () => {
  it("keeps each draft isolated and restores it when returning to its channel", () => {
    const drafts = setChannelDraft({}, "general-id", "Draft for general");
    const otherChannelDrafts = setChannelDraft(drafts, "help-id", "Draft for help");

    expect(getChannelDraft(otherChannelDrafts, "help-id")).toBe("Draft for help");
    expect(getChannelDraft(otherChannelDrafts, "general-id")).toBe("Draft for general");
    expect(getChannelDraft(otherChannelDrafts, "announcements-id")).toBe("");
  });

  it("removes a channel draft when it is cleared without affecting other drafts", () => {
    const drafts = setChannelDraft(
      setChannelDraft({}, "general-id", "Draft for general"),
      "help-id",
      "Draft for help",
    );

    const nextDrafts = setChannelDraft(drafts, "general-id", "");

    expect(getChannelDraft(nextDrafts, "general-id")).toBe("");
    expect(getChannelDraft(nextDrafts, "help-id")).toBe("Draft for help");
  });
});
