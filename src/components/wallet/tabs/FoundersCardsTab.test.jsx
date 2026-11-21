import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FoundersCardsTab from "./FoundersCardsTab";
import { foundersCardService } from "../../../services/foundersCardService";

jest.mock("../../../services/foundersCardService", () => ({
  foundersCardService: {
    getCatalog: jest.fn(),
    getMyCards: jest.fn(),
    subscribeToCatalogUpdates: jest.fn(),
    reservePurchase: jest.fn(),
    getOrder: jest.fn(),
    transferCard: jest.fn(),
  },
}));

jest.mock("../../../services/auth/paymentService", () => ({
  createPaystackTransaction: jest.fn(),
  requestWalletPayment: jest.fn(),
  verifyWeb3Payment: jest.fn(),
}));

let catalogUpdateCallback;

function createCatalog({ registryReady = true, supply = 30, saleEnabled = true, listPrice = 12 } = {}) {
  const cards = registryReady
    ? Array.from({ length: supply }, (_, index) => ({
        tier: "Silver",
        serial: supply - index,
        supply,
        serial_display: `#${String(supply - index).padStart(6, "0")}/${String(supply).padStart(4, "0")}`,
        status: "available",
      }))
    : [];
  return {
    tiers: [{
      tier: "Silver",
      supply,
      list_price: listPrice,
      price_currency: "USD",
      max_per_user: 5,
      sale_enabled: saleEnabled,
      available: registryReady ? supply : 0,
      reserved: 0,
      owned: 0,
    }],
    cards,
  };
}

describe("FoundersCardsTab supply gallery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    foundersCardService.getCatalog.mockResolvedValue(createCatalog());
    foundersCardService.getMyCards.mockResolvedValue([]);
    foundersCardService.subscribeToCatalogUpdates.mockImplementation((onUpdate) => {
      catalogUpdateCallback = onUpdate;
      return jest.fn();
    });
  });

  it("sorts registered serials and paginates instead of rendering the whole supply", async () => {
    render(<FoundersCardsTab setActiveTab={jest.fn()} initialScreen="marketplace" />);
    fireEvent.click(await screen.findByRole("button", { name: /Silver/ }));

    await waitFor(() => {
      expect(screen.getAllByRole("img", { name: /Silver card/ })).toHaveLength(24);
    });
    expect(screen.getByRole("img", { name: /Silver card #000001\/0030/ })).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next supply page" }));
    expect(screen.getAllByRole("img", { name: /Silver card/ })).toHaveLength(6);
    expect(screen.getByRole("img", { name: /Silver card #000025\/0030/ })).toBeInTheDocument();
  });

  it("keeps purchase controls closed until opened and dismisses the dialog with Escape", async () => {
    render(<FoundersCardsTab setActiveTab={jest.fn()} initialScreen="marketplace" />);
    fireEvent.click(await screen.findByRole("button", { name: /Silver/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const openButton = screen.getByRole("button", { name: "Open purchase options for Silver card" });
    fireEvent.click(openButton);
    expect(screen.getByRole("dialog", { name: "Silver Founders Card" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps unregistered serials as labeled previews and disables purchase", async () => {
    foundersCardService.getCatalog.mockResolvedValue(createCatalog({ registryReady: false, supply: 30 }));
    render(<FoundersCardsTab setActiveTab={jest.fn()} initialScreen="marketplace" />);
    fireEvent.click(await screen.findByRole("button", { name: /Silver/ }));

    expect(await screen.findByText("Serial preview")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /Silver card/ })).toHaveLength(24);
    fireEvent.click(screen.getByRole("button", { name: "Open purchase options for Silver card" }));
    expect(screen.getByRole("button", { name: "Inventory pending" })).toBeDisabled();
  });

  it("offers a clear fiat or crypto choice and reveals the EVM network selector", async () => {
    render(<FoundersCardsTab setActiveTab={jest.fn()} initialScreen="marketplace" />);
    fireEvent.click(await screen.findByRole("button", { name: /Silver/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open purchase options for Silver card" }));

    expect(screen.getByRole("radio", { name: /Fiat/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Crypto/ }));

    expect(screen.getByRole("radio", { name: /Crypto/ })).toBeChecked();
    expect(screen.getByLabelText("Network")).toBeInTheDocument();
  });

  it("refreshes the open marketplace when a CEO changes tier sales or pricing", async () => {
    render(<FoundersCardsTab setActiveTab={jest.fn()} initialScreen="marketplace" />);
    fireEvent.click(await screen.findByRole("button", { name: /Silver/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open purchase options for Silver card" }));
    expect(await screen.findByRole("button", { name: "Reserve & pay" })).toBeEnabled();

    foundersCardService.getCatalog.mockResolvedValue(
      createCatalog({ saleEnabled: false, listPrice: 18.5 }),
    );
    await act(async () => {
      await catalogUpdateCallback({ tier: "Silver" });
    });

    expect(await screen.findByRole("button", { name: "Sales paused" })).toBeDisabled();
    expect(screen.getAllByText("$18.50").length).toBeGreaterThan(0);
  });
});
