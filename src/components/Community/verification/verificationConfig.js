export const METHOD_ORDER = ["rules", "quick", "picture", "reaction"];
export const METHOD_META = {
  rules: { label: "Rules gate", blurb: "Members read your rules and accept them to earn the role." },
  quick: { label: "Quick verify", blurb: "One tap, backed by account checks the server enforces." },
  picture: { label: "Picture check", blurb: "Members pick the right image from a shuffled grid." },
  reaction: { label: "Reaction check", blurb: "Members choose the correct labeled answer." },
};
export const DANGEROUS_PERMS = ["administrator", "manageRoles", "assignRoles", "manageCommunity", "manageChannels", "kickMembers", "banMembers", "manageMessages", "timeoutMembers"];
export const SAFE_MEMBER_PERMS = { viewChannels: true, sendMessages: true, attachFiles: true, embedLinks: true, addReactions: true, readMessageHistory: true, viewMembers: true, changeOwnNickname: true, useSlashCommands: true };

export const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));

export const DEFAULT_VERIFICATION_CONFIG = {
  version: 2,
  name: "Community verification",
  accentColor: "#9cff00",
  icon: "shield",
  message: "Complete a check below to unlock the rest of the community.",
  completion: {
    title: "Congratulations, you're verified!",
    message: "Your role is ready. Enjoy your adventure here with us.",
  },
  unverifiedRoleId: "",
  rulesGate: { enabled: false, flow: "rules_only", rulesChannelId: "", verificationChannelId: "", secondMethod: "quick" },
  panel: { layout: "tabs", corners: "soft", cardStyle: "glass", density: "comfy", theme: "midnight", showProgress: true, showReward: true, badgeText: "", footerText: "" },
  panels: {
    rules: { enabled: true, label: "Rules", text: "Real people only. One account per person." },
    info: { enabled: true, label: "How it works", text: "Verification confirms access. It never reads your messages or files." },
    perks: { enabled: true, label: "Perks", text: "Verified members unlock more channels." },
  },
  methods: {
    rules: {
      enabled: false, roleId: "", requires: [],
      title: "Read and accept the community rules",
      description: "Please read every rule before you continue.",
      items: [
        { id: "rule-1", title: "Be respectful", body: "Treat every member with respect. No harassment or hate." },
        { id: "rule-2", title: "Keep it safe", body: "No scams, phishing or malicious links." },
        { id: "rule-3", title: "No spam", body: "No unsolicited promotion or repeated messages." },
      ],
      requireScroll: true, requireEachRule: false,
      acceptLabel: "I have read and agree to follow these rules",
      buttonLabel: "Accept and continue",
      successTitle: "Rules accepted", successDescription: "Thanks for agreeing to the rules. Your access has been updated.",
    },
    quick: {
      enabled: false, roleId: "", requires: [],
      title: "Verify you're a real person",
      description: "Confirm with one tap to unlock the rest of the community.",
      buttonLabel: "Verify me",
      minAccountAgeDays: 0, requireAvatar: false, requireProfileVerified: false,
      successTitle: "You are verified", successDescription: "Your access has been updated.",
    },
    picture: {
      enabled: false, roleId: "", requires: [],
      title: "Picture check",
      instruction: "Select the card showing the {label}, then tap its letter below.",
      cards: [], correctId: "", maxAttempts: 5,
      successTitle: "You are verified", successDescription: "Your access has been updated.",
    },
    reaction: {
      enabled: false, roleId: "", requires: [],
      title: "Choose the correct answer",
      instruction: "Choose the letter that starts the word apple.",
      choices: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
      ],
      correctId: "A",
      successTitle: "You are verified", successDescription: "Your access has been updated.",
    },
  },
};

const obj = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const defined = (o) => Object.fromEntries(Object.entries(obj(o)).filter(([, v]) => v !== undefined && v !== null));
const legacyItems = (text) => String(text || "").split("\n").map((l) => l.trim()).filter(Boolean).map((title, i) => ({ id: `rule-${i + 1}`, title, body: "" }));

function legacyMethods(s) {
  const roleId = s.roleGrant?.roleId || "";
  return {
    rules: { enabled: Boolean(s.rulesEnabled && s.rules?.enabled), roleId, ...defined({ title: s.rules?.title, description: s.rules?.description }), ...(s.rules?.rules ? { items: legacyItems(s.rules.rules) } : {}) },
    quick: { enabled: Boolean(s.quickEnabled || s.quick?.enabled), roleId, ...defined({ title: s.quick?.idleTitle, description: s.quick?.idleDescription, buttonLabel: s.quick?.buttonLabel, successTitle: s.quick?.verifiedTitle, successDescription: s.quick?.verifiedDescription }) },
    picture: { enabled: Boolean(s.pictureEnabled), roleId, ...defined({ title: s.picture?.idleTitle, instruction: s.picture?.descriptionTemplate, successTitle: s.picture?.verifiedTitle, successDescription: s.picture?.verifiedDescription }), cards: s.challenge?.cards || [], correctId: s.challenge?.correctId || "" },
  };
}

export function normalizeVerificationConfig(saved = {}) {
  const s = obj(saved);
  const d = DEFAULT_VERIFICATION_CONFIG;
  const { quickEnabled, pictureEnabled, rulesEnabled, roleGrant, quick, picture, rules: _rules, challenge, mode, avatarIcon, ...rest } = s;
  const savedRulesFlow = s.rulesGate?.flow;
  const sm = s.methods ? obj(s.methods) : legacyMethods(s);
  const methods = {};
  METHOD_ORDER.forEach((id) => {
    const merged = { ...d.methods[id], ...defined(sm[id]) };
    merged.requires = (Array.isArray(merged.requires) ? merged.requires : []).filter((r) => METHOD_ORDER.includes(r) && r !== id);
    if (id === "rules") merged.items = (Array.isArray(merged.items) ? merged.items : []).map((item) => ({ id: item.id || newId(), title: item.title || "", body: item.body || "" }));
    if (id === "picture") merged.cards = Array.isArray(merged.cards) ? merged.cards : [];
    if (id === "reaction") {
      merged.choices = Array.isArray(merged.choices)
        ? merged.choices.slice(0, 5).map((choice, index) => ({
          id: String.fromCharCode(65 + index),
          label: String(choice?.label || String.fromCharCode(65 + index)).slice(0, 60),
        }))
        : d.methods.reaction.choices;
    }
    methods[id] = merged;
  });
  return {
    ...rest,
    version: 2,
    name: s.name || d.name,
    accentColor: s.accentColor || d.accentColor,
    icon: s.icon || avatarIcon || d.icon,
    message: s.message || d.message,
    completion: {
      ...d.completion,
      ...defined(s.completion),
      title: String(s.completion?.title ?? d.completion.title).slice(0, 80),
      message: String(s.completion?.message ?? d.completion.message).slice(0, 280),
    },
    unverifiedRoleId: s.unverifiedRoleId || "",
    rulesGate: {
      ...d.rulesGate,
      ...defined(s.rulesGate),
      enabled: Boolean(s.rulesGate?.enabled || s.rules?.enabled),
      flow: ["rules_only", "rules_then_verify"].includes(savedRulesFlow)
        ? savedRulesFlow
        : (s.rules?.rulesChannelId && s.rules?.verificationChannelId ? "rules_then_verify" : d.rulesGate.flow),
      rulesChannelId: s.rulesGate?.rulesChannelId || s.rules?.rulesChannelId || "",
      verificationChannelId: s.rulesGate?.verificationChannelId || s.rules?.verificationChannelId || "",
      secondMethod: s.rulesGate?.secondMethod || d.rulesGate.secondMethod,
    },
    roleGrant: {
      enabled: typeof s.roleGrant?.enabled === "boolean"
        ? s.roleGrant.enabled
        : Boolean(s.roleGrant?.roleId || s.roleGrant?.roleIds?.length),
      roleIds: Array.isArray(s.roleGrant?.roleIds)
        ? [...new Set(s.roleGrant.roleIds.filter((id) => typeof id === "string" && id))]
        : s.roleGrant?.roleId ? [s.roleGrant.roleId] : [],
    },
    panel: {
      ...d.panel,
      ...defined(s.panel),
      theme: ["midnight", "aurora", "obsidian"].includes(s.panel?.theme)
        ? s.panel.theme
        : d.panel.theme,
    },
    panels: Object.fromEntries(Object.keys(d.panels).map((k) => [k, { ...d.panels[k], ...defined(obj(s.panels)[k]) }])),
    methods,
    pictureEnabled: typeof s.pictureEnabled === "boolean" ? s.pictureEnabled : Boolean(methods.picture.enabled),
    challenge: { cards: Array.isArray(s.challenge?.cards) ? s.challenge.cards : methods.picture.cards, correctId: s.challenge?.correctId || methods.picture.correctId || "" },
    picture: { ...d.methods.picture, ...defined(sm.picture), ...(s.picture || {}) },
    quickEnabled: typeof s.quickEnabled === "boolean" ? s.quickEnabled : Boolean(methods.quick.enabled),
    rulesEnabled: typeof s.rulesEnabled === "boolean" ? s.rulesEnabled : Boolean(methods.rules.enabled),
  };
}

export function challengeIsReady(config = {}) {
  const c = normalizeVerificationConfig(config);
  const cards = (c.challenge?.cards || c.methods?.picture?.cards || []).filter((card) => card && card.image && String(card.label || "").trim());
  const correctId = c.challenge?.correctId || c.methods?.picture?.correctId || "";
  return cards.length >= 2 && cards.some((card) => String(card.id) === String(correctId));
}

export function isVerificationConfigEnabled(config = {}) {
  const normalized = normalizeVerificationConfig(config);
  return METHOD_ORDER.some((method) => normalized.methods[method]?.enabled === true);
}

export function getVerificationRoleCandidates(roles = []) {
  return roles;
}

export function groupVerificationRoles(roles = []) {
  return roles.reduce((groups, role) => {
    const key = role.name?.trim().toLowerCase() || role.id;
    const group = groups.find((candidate) => candidate.key === key);
    if (group) group.roles.push(role);
    else groups.push({ key, role, roles: [role] });
    return groups;
  }, []);
}

export function getVerificationRoleIssue(role, roles = []) {
  if (!role) return "missing";
  if (role.is_default) return "default";
  if (role.name?.trim().toLowerCase() === "owner") return "owner";
  if (DANGEROUS_PERMS.some((permission) => role.permissions?.[permission] === true)) return "permissions";
  const defaultRole = roles.find((candidate) => candidate.is_default);
  if (defaultRole && Number(role.position) >= Number(defaultRole.position)) return "rank";
  return null;
}

export function getSelectableVerificationRoles(roles = []) {
  return getVerificationRoleCandidates(roles).filter((role) => !getVerificationRoleIssue(role, roles));
}

export function moveRoleAboveDefault(roles = [], roleId) {
  const ordered = [...roles].sort((left, right) => Number(left.position) - Number(right.position));
  const defaultIndex = ordered.findIndex((role) => role.is_default);
  const roleIndex = ordered.findIndex((role) => role.id === roleId);
  if (defaultIndex < 0 || roleIndex < 0 || roleIndex < defaultIndex) return null;
  const role = ordered[roleIndex];
  if (getVerificationRoleIssue(role, roles) !== "rank") return null;
  ordered.splice(roleIndex, 1);
  const nextDefaultIndex = ordered.findIndex((item) => item.is_default);
  ordered.splice(nextDefaultIndex, 0, role);
  return ordered;
}

export function getMethodsForVerificationChannel(rulesGate, channelId) {
  if (!rulesGate?.enabled) return null;
  if (channelId && channelId === rulesGate.rulesChannelId) return ["rules"];
  if (
    rulesGate.flow === "rules_then_verify"
    && channelId
    && channelId === rulesGate.verificationChannelId
  ) return [rulesGate.secondMethod];
  return [];
}

export function getVerificationChannelIds(config = {}, legacyChannelId = null) {
  return [...new Set([
    ...(Array.isArray(config.channel_ids) ? config.channel_ids : []),
    legacyChannelId,
  ].filter((channelId) => channelId !== null && channelId !== undefined && channelId !== "").map(String))];
}

export function compactForSave(config) {
  const c = normalizeVerificationConfig(config);
  const cards = c.methods.picture.cards.filter((x) => x.image && String(x.label || "").trim()).map((x) => ({ id: x.id, label: x.label.trim(), image: x.image }));
  const items = c.methods.rules.items.filter((i) => i.title.trim() || i.body.trim());
  return {
    ...c,
    methods: {
      ...c.methods,
      rules: { ...c.methods.rules, items },
      picture: { ...c.methods.picture, cards, correctId: cards.some((x) => x.id === c.methods.picture.correctId) ? c.methods.picture.correctId : "" },
    },
  };
}

export function methodIssues(id, m, roleMap, methods = {}, config = {}) {
  const out = [];
  const configuredRoleIds = config.roleGrant?.roleIds || [];
  const roleIds = config.roleGrant?.enabled
    ? configuredRoleIds
    : m.roleId ? [m.roleId] : [];
  const roles = roleIds.map((roleId) => roleMap?.get?.(roleId)).filter(Boolean);
  const defaultRole = [...(roleMap?.values?.() || [])].find((role) => role.is_default);
  if (!roleIds.length) out.push({ level: "error", text: "Choose at least one role members can unlock." });
  else if (roles.length !== roleIds.length) out.push({ level: "error", text: "A selected role no longer exists." });
  else if (roles.length) {
    const role = roles.find((candidate) => DANGEROUS_PERMS.some((key) => candidate.permissions?.[key] === true));
    if (role) {
      const bad = DANGEROUS_PERMS.filter((key) => role.permissions?.[key] === true);
      out.push({ level: "error", text: `${role.name} has management permissions (${bad.join(", ")}). Verification refuses to grant it.` });
    }
    if (defaultRole && roles.some((role) => Number(role.position) >= Number(defaultRole.position))) {
      out.push({ level: "error", text: "Selectable verification roles must rank above the default member role." });
    }
  }
  if (id === "rules" && !m.items.some((i) => i.title.trim())) out.push({ level: "error", text: "Add at least one rule." });
  if (id === "picture") {
    const ok = m.cards.filter((c) => c.image && String(c.label || "").trim());
    if (ok.length < 2) out.push({ level: "error", text: "Add at least two labelled images." });
    else if (!ok.some((c) => c.id === m.correctId) && !config._pictureChallengeReady) out.push({ level: "error", text: "Mark which card is the correct answer." });
  }
  if (id === "reaction") {
    if (!Array.isArray(m.choices) || m.choices.length < 1 || m.choices.length > 5) {
      out.push({ level: "error", text: "Add between one and five answer choices." });
    } else if (!m.choices.some((choice) => choice.id === m.correctId)) {
      out.push({ level: "error", text: "Choose the correct reaction answer." });
    }
  }
  (m.requires || []).forEach((r) => { if (methods[r] && !methods[r].enabled) out.push({ level: "warn", text: `Requires ${METHOD_META[r].label}, which is switched off (it will be skipped).` }); });
  return out;
}

export const isMethodReady = (id, m, roleMap, methods, config) => m.enabled && !methodIssues(id, m, roleMap, methods, config).some((i) => i.level === "error");

export function toPublicPanel(config, roleMap = new Map(), { preview = false, targetLabel = "" } = {}) {
  const c = normalizeVerificationConfig(config);
  const methods = {};
  METHOD_ORDER.forEach((id) => {
    const m = c.methods[id];
    const role = roleMap.get(m.roleId || c.roleGrant.roleIds[0]);
    const base = { ...m, ready: isMethodReady(id, m, roleMap, c.methods, c), roleName: role?.name || "", roleColor: role?.color || "", roleIcon: role?.icon || "" };
    delete base.roleId;
    if (id === "picture") {
      base.targetLabel = targetLabel || m.cards.find((x) => x.id === m.correctId)?.label || "";
      base.cards = m.cards.filter((x) => x.image).map((x) => ({ id: x.id, image: x.image }));
      if (preview) base.previewCorrectId = m.correctId;
      delete base.correctId;
    }
    if (id === "reaction") delete base.correctId;
    methods[id] = base;
  });
  const selectableRoleIds = new Set(getSelectableVerificationRoles([...roleMap.values()]).map((role) => role.id));
  const roleChoices = (c.roleGrant.enabled ? c.roleGrant.roleIds : []).map((id) => roleMap.get(id)).filter((role) =>
    role && selectableRoleIds.has(role.id),
  ).map((role) => ({
    id: role.id,
    name: role.name,
    color: role.color,
    icon: role.icon,
    position: role.position,
  }));
  return { configured: true, name: c.name, accentColor: c.accentColor, icon: c.icon, message: c.message, completion: c.completion, panel: c.panel, panels: c.panels, rulesGate: c.rulesGate, methods, roleChoices };
}
