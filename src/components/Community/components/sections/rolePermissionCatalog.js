export const ROLE_PERMISSION_GROUPS = [
  {
    label: "General",
    perms: [
      { key: "viewChannels", label: "View Channels", desc: "See channels & read messages" },
      { key: "manageChannels", label: "Manage Channels", desc: "Create, edit, delete channels" },
      { key: "manageRoles", label: "Manage Roles", desc: "Create & edit roles below this" },
      { key: "viewAuditLog", label: "View Audit Log", desc: "See community action history" },
      { key: "manageCommunity", label: "Manage Community", desc: "Change community settings" },
      { key: "manageInvites", label: "Manage Invites", desc: "Create, revoke and view invites" },
      { key: "administrator", label: "Administrator", desc: "All permissions — use carefully", danger: true },
    ],
  },
  {
    label: "Members",
    perms: [
      { key: "viewMembers", label: "View Members", desc: "See the member list" },
      { key: "inviteMembers", label: "Invite Members", desc: "Create invite links" },
      { key: "kickMembers", label: "Kick Members", desc: "Remove members" },
      { key: "banMembers", label: "Ban Members", desc: "Permanently ban members" },
      { key: "manageNicknames", label: "Manage Nicknames", desc: "Change any member's nickname" },
      { key: "changeOwnNickname", label: "Change Own Nickname", desc: "Change your display name" },
      { key: "timeoutMembers", label: "Timeout Members", desc: "Temporarily mute members" },
      { key: "assignRoles", label: "Assign Roles", desc: "Give members roles below yours" },
    ],
  },
  {
    label: "Messages",
    perms: [
      { key: "sendMessages", label: "Send Messages", desc: "Post in text channels" },
      { key: "attachFiles", label: "Attach Files", desc: "Upload images & files" },
      { key: "embedLinks", label: "Embed Links", desc: "Show link previews" },
      { key: "addReactions", label: "Add Reactions", desc: "React to messages" },
      { key: "useExternalEmojis", label: "External Emojis", desc: "Use emojis from other communities" },
      { key: "mentionEveryone", label: "@everyone / @here", desc: "Ping all / online members" },
      { key: "useSlashCommands", label: "Slash Commands", desc: "Use / commands" },
      { key: "manageMessages", label: "Manage Messages", desc: "Delete / pin others' messages" },
      { key: "pinMessages", label: "Pin Messages", desc: "Pin messages in channels" },
      { key: "readMessageHistory", label: "Message History", desc: "View past messages" },
      { key: "bypassSlowMode", label: "Bypass Slow Mode", desc: "Send without slow mode limit" },
    ],
  },
];
