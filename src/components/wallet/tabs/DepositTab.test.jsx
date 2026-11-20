import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DepositTab from "./DepositTab";

jest.mock("../../Auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, profile: { email: "user@example.com" } }),
}));

jest.mock("./Web3DepositView", () => () => <div data-testid="web3-deposit-view" />);

jest.mock("../../../services/wallet/depositFundService", () => ({
  depositDetectBrowserWallets: jest.fn(),
  depositSmartImport: jest.fn(),
  depositCryptoVerify: jest.fn(),
  depositPaystackOpen: jest.fn(),
  getLiveUSDNGN: async () => 1348,
  getCachedUSDNGN: () => 1348,
  MIN_DEPOSIT: 500,
}));

describe("DepositTab payment methods", () => {
  it("keeps the fiat and crypto choices concise and opens the selected deposit flow", async () => {
    await act(async () => {
      render(<DepositTab setActiveTab={jest.fn()} />);
    });

    expect(screen.getByText("LOCAL CURRENCY")).toBeInTheDocument();
    expect(screen.getByText("Nigerian naira")).toBeInTheDocument();
    expect(screen.getByText("Card · bank transfer")).toBeInTheDocument();

    expect(screen.getByText("ON-CHAIN")).toBeInTheDocument();
    expect(screen.getByText("EVM · Solana · Cardano")).toBeInTheDocument();
    expect(screen.getByText("USDC · USDT · ADA")).toBeInTheDocument();
    expect(screen.getByText("EVM · Solana · Cardano")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Deposit with crypto or Web3" }));
    expect(screen.getByTestId("web3-deposit-view")).toBeInTheDocument();
  });
});
