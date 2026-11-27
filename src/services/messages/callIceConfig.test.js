import { supabase } from "../config/supabase";
import { DEFAULT_ICE_SERVERS, getCallIceServers } from "./callIceConfig";

jest.mock("../config/supabase", () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

describe("call ICE configuration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("loads TURN-enabled ICE servers from the authenticated Edge Function", async () => {
    const iceServers = [
      { urls: "stun:global.stun.twilio.com:3478" },
      { urls: "turn:global.turn.twilio.com:443?transport=tcp", username: "temporary", credential: "secret" },
    ];
    supabase.functions.invoke.mockResolvedValue({ data: { iceServers }, error: null });

    await expect(getCallIceServers()).resolves.toEqual(iceServers);
    expect(supabase.functions.invoke).toHaveBeenCalledWith("get-call-ice-config");
  });

  it("exposes a direct STUN fallback and rejects missing relay responses", async () => {
    supabase.functions.invoke.mockResolvedValue({ data: {}, error: null });

    expect(DEFAULT_ICE_SERVERS.length).toBeGreaterThan(0);
    await expect(getCallIceServers()).rejects.toThrow("missing or invalid");
  });
});
