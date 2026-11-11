import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import Web3DepositView from "./Web3DepositView";
import { getWeb3DepositQuote } from "../../../services/wallet/web3WalletDepositService";

jest.mock("../../../services/wallet/web3WalletDepositService", () => ({
  createWeb3DepositChallenge: jest.fn(),
  getWeb3DepositQuote: jest.fn(),
  verifyWeb3WalletDeposit: jest.fn(),
}));

describe("Web3DepositView amount entry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getWeb3DepositQuote.mockResolvedValue({
      unitPriceUsd: 1,
      unitPriceNgn: 1348,
      priceChange24hPercent: -0.25,
      quotedAt: new Date().toISOString(),
    });
  });

  it("uses a live quote for the minimum and quick NGN deposit estimates", async () => {
    render(<Web3DepositView rate={1500} />);

    expect(screen.queryByText("Back to deposit methods")).not.toBeInTheDocument();
    expect(screen.queryByText("Deposit with crypto")).not.toBeInTheDocument();
    expect(await screen.findByText(/USDC down 0\.25% vs USD in 24h/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "₦2k" }));

    expect(screen.getByLabelText("Amount to pay in Nigerian naira")).toHaveValue(2000);
    expect(screen.getByLabelText("Estimated Engagement Points")).toHaveTextContent("149");
    expect(screen.getByLabelText("Minimum deposit in Nigerian naira")).toHaveTextContent("₦1,400");
    expect(screen.getByText("≈ $1.04 USD · rounded up to ₦100")).toBeInTheDocument();
    expect(screen.getByText("Minimum amount")).toBeInTheDocument();
    expect(screen.getByText("1.038576 USDC")).toBeInTheDocument();
  });

  it("uses a live ADA quote to show the rounded minimum and estimated crypto amounts", async () => {
    getWeb3DepositQuote
      .mockResolvedValueOnce({
        unitPriceUsd: 1,
        unitPriceNgn: 1348,
        priceChange24hPercent: 0,
        quotedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
      unitPriceUsd: 0.5,
      unitPriceNgn: 674,
      priceChange24hPercent: 1.5,
      quotedAt: new Date().toISOString(),
    });
    render(<Web3DepositView rate={1500} />);

    fireEvent.change(screen.getByLabelText("Network family"), {
      target: { value: "CARDANO" },
    });
    fireEvent.change(screen.getByLabelText("Amount to pay in Nigerian naira"), {
      target: { value: "3000" },
    });

    expect(await screen.findByText(/Estimated for your amount:/)).toHaveTextContent("≈ 4.46 ADA");
    expect(screen.getByText("2.077152 ADA")).toBeInTheDocument();
    expect(screen.getByLabelText("Minimum deposit in Nigerian naira")).toHaveTextContent("₦1,400");
    expect(screen.getByText(/ADA up 1\.50% vs USD in 24h/)).toBeInTheDocument();
    expect(getWeb3DepositQuote).toHaveBeenCalledWith({
      chainType: "CARDANO",
      chain: "cardano",
      asset: "ADA",
    });
  });

  it("does not fall back to a cached NGN rate when the live quote fails", async () => {
    getWeb3DepositQuote.mockRejectedValue(new Error("Market provider unavailable."));
    render(<Web3DepositView rate={1500} />);

    expect(await screen.findByText("Market provider unavailable.")).toBeInTheDocument();
    expect(screen.getByLabelText("Minimum deposit in Nigerian naira")).toHaveTextContent("Unavailable");
    expect(screen.getByRole("button", { name: "Live quote unavailable" })).toBeDisabled();
    expect(screen.getByLabelText("Amount to pay in Nigerian naira")).toBeDisabled();
  });
});
