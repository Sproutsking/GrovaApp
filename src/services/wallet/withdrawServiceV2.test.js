import { getWithdrawalHistory, initiateWithdrawal } from "./withdrawServiceV2";
import { supabase } from "../config/supabase";

jest.mock("../config/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

jest.mock("./depositFundService", () => ({
  getCachedUSDNGN: () => 1500,
}));

describe("withdrawServiceV2", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not retry payout initiation for an idempotent request already refunded", async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabase.rpc.mockResolvedValue({
      data: {
        success: true,
        id: "withdrawal-1",
        status: "failed",
        ep_amount: 500,
        fee_ep: 10,
        fee_pct: 2,
        net_ep: 490,
        net_ngn: 7350,
        ngn_rate: 1500,
        refunded: true,
        already_created: true,
      },
      error: null,
    });

    const result = await initiateWithdrawal({
      userId: "user-1",
      usdAmount: 5,
      method: "bank",
      fields: {
        bank: "Example Bank",
        accountNumber: "1234567890",
        accountName: "Example User",
      },
      idempotencyKey: "request-key",
    });

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "failed",
      refunded: true,
      alreadyCreated: true,
      message: "Payout failed; your EP has been returned.",
    });
  });

  it("does not retry or report an already completed withdrawal as pending", async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabase.rpc.mockResolvedValue({
      data: {
        success: true,
        id: "withdrawal-2",
        status: "completed",
        payout_state: "settled",
        ep_amount: 500,
        fee_ep: 10,
        fee_pct: 2,
        net_ep: 490,
        net_ngn: 7350,
        ngn_rate: 1500,
        already_created: true,
      },
      error: null,
    });

    const result = await initiateWithdrawal({
      userId: "user-1",
      usdAmount: 5,
      method: "bank",
      fields: {
        bank: "Example Bank",
        accountNumber: "1234567890",
        accountName: "Example User",
      },
      idempotencyKey: "request-key",
    });

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "completed",
      payoutWarning: null,
      message: "Your bank payout is complete.",
    });
  });

  it("uses the exchange rate stored with each historical withdrawal", async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [{ id: "withdrawal-3", net_ep: 490, ngn_rate: 1400 }],
        error: null,
      }),
    };
    supabase.from.mockReturnValue(query);

    const history = await getWithdrawalHistory("user-1");

    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("ngn_rate"));
    expect(history[0].netNGN).toBe(6860);
  });
});
