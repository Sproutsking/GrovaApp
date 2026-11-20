import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FoundersCardsSection from "./FoundersCardsSection";
import { foundersCardService } from "../../../services/foundersCardService";

jest.mock("../../../services/foundersCardService", () => ({
  foundersCardService: {
    getAdminConfig: jest.fn(),
    updateTier: jest.fn(),
    updatePolicy: jest.fn(),
    importRegistry: jest.fn(),
  },
  parseFoundersCardsCsv: jest.fn(),
}));

function createConfig({ currency = "USD" } = {}) {
  return {
    registry_count: 1400,
    policy: { reservation_hours: 24, late_paystack_action: "auto_refund" },
    late_payments: [],
    tiers: ["Silver", "Gold", "Diamond", "VIP"].map((tier, index) => ({
      tier,
      supply: [900, 300, 150, 50][index],
      list_price: [12, 25, 50, 100][index],
      price_currency: currency,
      max_per_user: 1,
      sale_enabled: false,
      transfers_enabled: false,
      available: [900, 300, 150, 50][index],
      reserved: 0,
      owned: 0,
    })),
  };
}

describe("FoundersCardsSection tier controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    foundersCardService.getAdminConfig.mockResolvedValue(createConfig());
    foundersCardService.updateTier.mockResolvedValue();
  });

  it("saves a sales toggle immediately and rolls the optimistic state back on failure", async () => {
    let rejectUpdate;
    foundersCardService.updateTier.mockImplementation(() => new Promise((resolve, reject) => {
      rejectUpdate = reject;
    }));

    render(<FoundersCardsSection />);
    const salesSwitch = await screen.findByRole("switch", { name: "Enable Silver sales" });
    fireEvent.click(salesSwitch);

    expect(salesSwitch).toBeChecked();
    await waitFor(() => {
      expect(foundersCardService.updateTier).toHaveBeenCalledWith(
        "Silver",
        expect.objectContaining({ sale_enabled: true, price_currency: "USD" }),
      );
    });

    await act(async () => rejectUpdate(new Error("Sales update denied.")));
    expect(salesSwitch).not.toBeChecked();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sales update denied.");
  });

  it("saves edited tier pricing through the CEO control", async () => {
    render(<FoundersCardsSection />);
    const priceInput = (await screen.findAllByLabelText("Price (USD)", { selector: "input" }))[0];
    fireEvent.change(priceInput, { target: { value: "18.5" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save tier settings" })[0]);

    await waitFor(() => {
      expect(foundersCardService.updateTier).toHaveBeenCalledWith(
        "Silver",
        expect.objectContaining({ list_price: "18.5", price_currency: "USD" }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Silver settings saved.");
  });

  it("does not allow sales before saved currency confirmation", async () => {
    foundersCardService.getAdminConfig.mockResolvedValue(createConfig({ currency: null }));
    render(<FoundersCardsSection />);

    expect(await screen.findByRole("switch", { name: "Enable Silver sales" })).toBeDisabled();
  });
});
