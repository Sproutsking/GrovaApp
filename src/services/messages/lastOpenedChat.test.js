import { getLastOpenedChat, saveLastOpenedChat } from "./lastOpenedChat";

describe("last opened chat storage", () => {
  beforeEach(() => localStorage.clear());

  it("saves and restores the last selected direct or group chat per user", () => {
    expect(saveLastOpenedChat("user-1", { type: "direct", id: "conversation-1" })).toBe(true);
    expect(saveLastOpenedChat("user-2", { type: "group", id: "group-1" })).toBe(true);

    expect(getLastOpenedChat("user-1")).toEqual({ type: "direct", id: "conversation-1" });
    expect(getLastOpenedChat("user-2")).toEqual({ type: "group", id: "group-1" });
  });

  it("ignores malformed or unsupported stored locations", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("xeevia:last-opened-dm:user-1", "{invalid");
    expect(getLastOpenedChat("user-1")).toBeNull();
    expect(saveLastOpenedChat("user-1", { type: "call", id: "call-1" })).toBe(false);
    warn.mockRestore();
  });
});
