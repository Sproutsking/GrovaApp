import communityBotService from "./communityBotService";
import { supabase } from "../config/supabase";

jest.mock("../config/supabase", () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

describe("communityBotService edge function errors", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the server's actionable reason when the bot check returns a non-2xx response", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(JSON.stringify({ error: "discord bot secret is not configured" }), { status: 503 }),
      },
    });

    await expect(communityBotService.checkBot("discord", "community"))
      .rejects.toThrow("discord bot secret is not configured");
  });

  it("falls back to the HTTP status when an edge response has no JSON error", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response("not-json", { status: 502 }),
      },
    });

    await expect(communityBotService.discoverDiscordTargets("community"))
      .rejects.toThrow("Community bot request failed (502).");
  });
});
