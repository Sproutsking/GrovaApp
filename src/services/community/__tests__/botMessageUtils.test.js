import { buildTelegramMessage, getBotProviderError } from "../../../../supabase/functions/_shared/botMessageUtils";

describe("community bot message formatting", () => {
  it("includes the Xeevia URL and leaves room for it within Telegram's message limit", () => {
    const message = buildTelegramMessage("A community announcement", "https://xeevia.example/post/123");
    expect(message).toBe("A community announcement\n\nhttps://xeevia.example/post/123");
    expect(message.length).toBeLessThanOrEqual(4096);
  });

  it("truncates content before appending the Xeevia URL", () => {
    const url = "https://xeevia.example/post/123";
    const message = buildTelegramMessage("x".repeat(5000), url);
    expect(message).toBe(`${"x".repeat(4096 - url.length - 2)}\n\n${url}`);
    expect(message.length).toBe(4096);
  });

  it("uses Telegram descriptions and Discord messages as delivery errors", () => {
    expect(getBotProviderError({ description: "Chat not found" }, "telegram")).toBe("Chat not found");
    expect(getBotProviderError({ message: "Missing Access" }, "discord")).toBe("Missing Access");
  });
});
