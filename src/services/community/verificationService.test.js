import { supabase } from "../config/supabase";
import verificationService from "./verificationService";

jest.mock("../config/supabase", () => {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return {
    supabase: {
      rpc: jest.fn(),
      from: jest.fn(() => query),
    },
  };
});

describe("verificationService panel cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.rpc.mockResolvedValue({ data: { configured: false }, error: null });
    supabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));
  });

  it("reuses a panel load for the same member and reloads after invalidation", async () => {
    const options = { userId: "member-1" };

    await Promise.all([
      verificationService.getPanel("cache-community", options),
      verificationService.getPanel("cache-community", options),
    ]);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    await verificationService.getPanel("cache-community", options);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    verificationService.invalidatePanel("cache-community", options.userId);
    await verificationService.getPanel("cache-community", options);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("does not share per-member completion state between users", async () => {
    await verificationService.getPanel("member-state-community", { userId: "member-1" });
    await verificationService.getPanel("member-state-community", { userId: "member-2" });

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});
