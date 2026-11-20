import { isPayWaveEligible } from "./walletEligibility";

describe("isPayWaveEligible", () => {
  it("allows Nigerian users regardless of selected currency", () => {
    expect(isPayWaveEligible({ region: "NG" }, "USD")).toBe(true);
  });

  it("allows non-Nigerian users who selected naira", () => {
    expect(isPayWaveEligible({ region: "GH" }, "NGN")).toBe(true);
  });

  it("does not grant access based on a non-Nigerian profile and other currency", () => {
    expect(isPayWaveEligible({ region: "GH" }, "USD")).toBe(false);
  });
});
