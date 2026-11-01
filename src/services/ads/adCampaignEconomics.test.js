import { calculateCampaignEconomics } from "./adCampaignEconomics";

describe("calculateCampaignEconomics", () => {
  test("includes the 10% commission inside the entered budget", () => {
    expect(calculateCampaignEconomics(1000, "included")).toEqual({
      budget: 1000,
      commission: 100,
      creatorPool: 900,
      totalEscrow: 1000,
    });
  });

  test("charges the commission on top of the creator budget", () => {
    expect(calculateCampaignEconomics(1000, "on_top")).toEqual({
      budget: 1000,
      commission: 100,
      creatorPool: 1000,
      totalEscrow: 1100,
    });
  });

  test("rounds the 10% commission up to whole EP", () => {
    expect(calculateCampaignEconomics(101, "included")).toEqual({
      budget: 101,
      commission: 11,
      creatorPool: 90,
      totalEscrow: 101,
    });
  });

  test("does not produce a reserve for invalid budgets", () => {
    expect(calculateCampaignEconomics("not a number", "included")).toEqual({
      budget: 0,
      commission: 0,
      creatorPool: 0,
      totalEscrow: 0,
    });
  });
});
