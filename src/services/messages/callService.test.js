import callService from "./callService";

describe("callService missed-call events", () => {
  let emitSpy;

  beforeEach(() => {
    callService._userId = "callee";
    callService._activeCallId = null;
    emitSpy = jest.spyOn(callService, "emit");
    jest.spyOn(callService, "_clearRingTimeout").mockImplementation(() => {});
    jest.spyOn(callService, "_cleanupPeer").mockImplementation(() => {});
    jest.spyOn(callService, "_resetState").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    callService._userId = null;
    callService._activeCallId = null;
  });

  it("notifies the callee when the caller ends an unanswered call", () => {
    callService._onCallEnd({
      callId: "call-1",
      endedBy: "caller",
      status: "no_answer",
    });

    expect(emitSpy).toHaveBeenCalledWith("missed_call", { callId: "call-1" });
  });

  it("does not count answered, declined, or self-ended calls as missed", () => {
    [
      { callId: "call-answered", endedBy: "caller", status: "ended" },
      { callId: "call-declined", endedBy: "caller", status: "declined" },
      { callId: "call-self", endedBy: "callee", status: "no_answer" },
    ].forEach((event) => callService._onCallEnd(event));

    expect(emitSpy).not.toHaveBeenCalledWith("missed_call", expect.anything());
  });
});
