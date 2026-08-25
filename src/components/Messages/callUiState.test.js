import { shouldRenderIncomingCallPopup } from "./callUiState";

describe("callUiState", () => {
  it("does not render the popup when the full call screen is active", () => {
    expect(
      shouldRenderIncomingCallPopup({
        incomingCall: { callId: "call-1" },
        activeCall: { callId: "call-1" },
        view: "call",
      })
    ).toBe(false);
  });

  it("renders the popup when an incoming call exists and no full-screen call is open", () => {
    expect(
      shouldRenderIncomingCallPopup({
        incomingCall: { callId: "call-2" },
        activeCall: null,
        view: "list",
      })
    ).toBe(true);
  });
});
