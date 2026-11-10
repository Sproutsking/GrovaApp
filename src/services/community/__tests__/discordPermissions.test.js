import {
  decodeStoredToken,
  hasDiscordChannelSendPermissions,
  hasDiscordGuildManagementPermission,
} from "../../../../supabase/functions/_shared/discordPermissions";

describe("stored Discord token decoding", () => {
  it("decodes Postgres bytea hex strings into the original bearer token", () => {
    expect(decodeStoredToken("\\x746573742d746f6b656e")).toBe("test-token");
  });

  it("preserves plain tokens and rejects missing values", () => {
    expect(decodeStoredToken("plain-token")).toBe("plain-token");
    expect(decodeStoredToken(null)).toBe("");
  });
});

describe("Discord server management permissions", () => {
  it.each(["8", "32", "40"])("accepts Administrator or Manage Server permission bits (%s)", (permissions) => {
    expect(hasDiscordGuildManagementPermission(permissions)).toBe(true);
  });

  it.each(["0", "1024", "2048", "invalid", null])("rejects guild access without management permission (%s)", (permissions) => {
    expect(hasDiscordGuildManagementPermission(permissions)).toBe(false);
  });

  it("requires both View Channel and Send Messages for a destination", () => {
    expect(hasDiscordChannelSendPermissions({
      guildId: "guild",
      botId: "bot",
      roles: [{ id: "guild", permissions: "3072" }],
    })).toBe(true);
    expect(hasDiscordChannelSendPermissions({
      guildId: "guild",
      botId: "bot",
      roles: [{ id: "guild", permissions: "1024" }],
    })).toBe(false);
  });

  it("applies Discord role and member channel overwrites", () => {
    const base = {
      guildId: "guild",
      botId: "bot",
      memberRoleIds: ["poster"],
      roles: [
        { id: "guild", permissions: "1024" },
        { id: "poster", permissions: "2048" },
      ],
    };
    expect(hasDiscordChannelSendPermissions({
      ...base,
      overwrites: [
        { id: "guild", type: 0, allow: "0", deny: "2048" },
        { id: "poster", type: 0, allow: "2048", deny: "0" },
      ],
    })).toBe(true);
    expect(hasDiscordChannelSendPermissions({
      ...base,
      overwrites: [{ id: "bot", type: 1, allow: "0", deny: "2048" }],
    })).toBe(false);
  });

  it("honors Discord Administrator regardless of channel overwrites", () => {
    expect(hasDiscordChannelSendPermissions({
      guildId: "guild",
      botId: "bot",
      roles: [{ id: "guild", permissions: "8" }],
      overwrites: [{ id: "guild", type: 0, allow: "0", deny: "3072" }],
    })).toBe(true);
  });
});
