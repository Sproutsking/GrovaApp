const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;

const toBits = (value) => {
  try { return BigInt(String(value || "0")); } catch { return 0n; }
};

export function decodeStoredToken(value) {
  if (typeof value !== "string" || !value) return "";
  const bytea = value.match(/^\\x([0-9a-f]+)$/i);
  if (!bytea) return value;
  const bytes = new Uint8Array(bytea[1].match(/.{2}/g)?.map((part) => parseInt(part, 16)) || []);
  return String.fromCharCode(...bytes);
}

export function hasDiscordGuildManagementPermission(value) {
  try {
    const permissions = BigInt(String(value || "0"));
    return (permissions & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
  } catch {
    return false;
  }
}

export function hasDiscordChannelSendPermissions({ guildId, botId, roles = [], memberRoleIds = [], overwrites = [] }) {
  const memberRoles = new Set([guildId, ...memberRoleIds]);
  let permissions = roles
    .filter((role) => memberRoles.has(role.id))
    .reduce((bits, role) => bits | toBits(role.permissions), 0n);
  if ((permissions & ADMINISTRATOR) !== 0n) return true;

  const everyoneOverwrite = overwrites.find((overwrite) => String(overwrite.type) === "0" && overwrite.id === guildId);
  if (everyoneOverwrite) {
    permissions = (permissions & ~toBits(everyoneOverwrite.deny)) | toBits(everyoneOverwrite.allow);
  }

  let roleDeny = 0n;
  let roleAllow = 0n;
  overwrites.filter((overwrite) => String(overwrite.type) === "0" && memberRoles.has(overwrite.id) && overwrite.id !== guildId)
    .forEach((overwrite) => {
      roleDeny |= toBits(overwrite.deny);
      roleAllow |= toBits(overwrite.allow);
    });
  permissions = (permissions & ~roleDeny) | roleAllow;

  const memberOverwrite = overwrites.find((overwrite) => String(overwrite.type) === "1" && overwrite.id === botId);
  if (memberOverwrite) {
    permissions = (permissions & ~toBits(memberOverwrite.deny)) | toBits(memberOverwrite.allow);
  }
  return (permissions & (VIEW_CHANNEL | SEND_MESSAGES)) === (VIEW_CHANNEL | SEND_MESSAGES);
}
