import { getMethodsForVerificationChannel, getSelectableVerificationRoles, isMethodReady, isVerificationConfigEnabled, normalizeVerificationConfig, toPublicPanel } from "./verificationConfig";

describe("verification role choices", () => {
  const defaultRole = { id: "default", name: "Novice", position: 2, is_default: true, permissions: {} };
  const verifiedRole = { id: "verified", name: "Verified", position: 1, permissions: { viewChannels: true } };
  const lowerRole = { id: "lower", name: "Lower rank", position: 3, permissions: {} };
  const dangerousRole = { id: "dangerous", name: "Admin", position: 0, permissions: { administrator: true } };

  it("offers only safe roles ranked above the default member role", () => {
    const config = normalizeVerificationConfig({
      roleGrant: { enabled: true, roleIds: ["verified", "lower", "dangerous"] },
      methods: { quick: { enabled: true } },
    });
    const roles = new Map([defaultRole, verifiedRole, lowerRole, dangerousRole].map((role) => [role.id, role]));
    const panel = toPublicPanel(config, roles);

    expect(panel.roleChoices.map((role) => role.id)).toEqual(["verified"]);
    expect(isMethodReady("quick", config.methods.quick, roles, config.methods, config)).toBe(false);
    expect(toPublicPanel(config, roles).methods.quick.ready).toBe(false);
  });

  it("uses the same safe-role rules in setup and member-facing role choices", () => {
    const roles = [defaultRole, verifiedRole, lowerRole, dangerousRole];
    expect(getSelectableVerificationRoles(roles).map((role) => role.id)).toEqual(["verified"]);

    const disabledConfig = normalizeVerificationConfig({
      roleGrant: { enabled: false, roleIds: ["verified"] },
    });
    expect(toPublicPanel(disabledConfig, new Map(roles.map((role) => [role.id, role]))).roleChoices).toEqual([]);
  });

  it("marks an eligible selected role ready for verification", () => {
    const config = normalizeVerificationConfig({
      roleGrant: { enabled: true, roleIds: ["verified"] },
      methods: { quick: { enabled: true } },
    });
    const roles = new Map([defaultRole, verifiedRole].map((role) => [role.id, role]));

    expect(isMethodReady("quick", config.methods.quick, roles, config.methods, config)).toBe(true);
  });

  it("does not mark a method ready when role selection is enabled without selectable roles", () => {
    const config = normalizeVerificationConfig({
      roleGrant: { enabled: true, roleIds: [] },
      methods: { quick: { enabled: true, roleId: "verified" } },
    });
    const roles = new Map([defaultRole, verifiedRole].map((role) => [role.id, role]));

    expect(isMethodReady("quick", config.methods.quick, roles, config.methods, config)).toBe(false);
  });

  it("keeps both configured checks available for channel-specific routing", () => {
    const config = normalizeVerificationConfig({
      version: 2,
      roleGrant: { enabled: true, roleIds: ["verified"] },
      rulesGate: {
        enabled: true,
        flow: "rules_then_verify",
        rulesChannelId: "rules-channel",
        verificationChannelId: "verify-channel",
        secondMethod: "picture",
      },
      methods: {
        rules: { enabled: true },
        quick: { enabled: true },
        picture: {
          enabled: true,
          cards: [
            { id: "cat", label: "cat", image: "cat.jpg" },
            { id: "dog", label: "dog", image: "dog.jpg" },
          ],
          correctId: "cat",
        },
      },
    });
    const roles = new Map([defaultRole, verifiedRole].map((role) => [role.id, role]));
    const panel = toPublicPanel(config, roles);

    expect(Object.keys(panel.methods)).toEqual(["rules", "quick", "picture"]);
    expect(panel.methods.rules.ready).toBe(true);
    expect(panel.methods.picture.ready).toBe(true);
    expect(panel.rulesGate.flow).toBe("rules_then_verify");
  });

  it("keeps verification methods available for route-specific filtering", () => {
    const config = normalizeVerificationConfig({
      version: 2,
      roleGrant: { enabled: true, roleIds: ["verified"] },
      rulesGate: { enabled: true, flow: "rules_only", rulesChannelId: "rules-channel" },
      methods: {
        rules: { enabled: true },
        quick: { enabled: true },
      },
    });
    const roles = new Map([defaultRole, verifiedRole].map((role) => [role.id, role]));

    expect(Object.keys(toPublicPanel(config, roles).methods)).toEqual(["rules", "quick", "picture"]);
  });

  it("routes each step to its configured channel only", () => {
    const gate = {
      enabled: true,
      flow: "rules_then_verify",
      rulesChannelId: "rules-channel",
      verificationChannelId: "verify-channel",
      secondMethod: "picture",
    };

    expect(getMethodsForVerificationChannel(gate, "rules-channel")).toEqual(["rules"]);
    expect(getMethodsForVerificationChannel(gate, "verify-channel")).toEqual(["picture"]);
    expect(getMethodsForVerificationChannel(gate, "other-channel")).toEqual([]);
    expect(getMethodsForVerificationChannel({ enabled: false }, "other-channel")).toBeNull();
  });

  it("respects an explicit role-grant disable even when role IDs are saved", () => {
    const config = normalizeVerificationConfig({
      version: 2,
      roleGrant: { enabled: false, roleIds: ["verified"] },
    });

    expect(config.roleGrant.enabled).toBe(false);
  });

  it("enables the community verification tool only when a real check is active", () => {
    expect(isVerificationConfigEnabled({})).toBe(false);
    expect(isVerificationConfigEnabled({ roleGrant: { enabled: true, roleIds: ["verified"] } })).toBe(false);
    expect(isVerificationConfigEnabled({
      version: 2,
      methods: { quick: { enabled: true } },
    })).toBe(true);
    expect(isVerificationConfigEnabled({
      version: 2,
      methods: { picture: { enabled: true } },
    })).toBe(true);
  });

  it("normalizes enabled quick checks into the canonical configuration consumed by verification", () => {
    const config = normalizeVerificationConfig({
      version: 2,
      methods: { quick: { enabled: true, minAccountAgeDays: 7, requireAvatar: true } },
    });

    expect(config.methods.quick).toMatchObject({
      enabled: true,
      minAccountAgeDays: 7,
      requireAvatar: true,
    });
    expect(isVerificationConfigEnabled(config)).toBe(true);
  });
});
