import { getMethodsForVerificationChannel, isMethodReady, normalizeVerificationConfig, toPublicPanel } from "./verificationConfig";

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
  });

  it("marks an eligible selected role ready for verification", () => {
    const config = normalizeVerificationConfig({
      roleGrant: { enabled: true, roleIds: ["verified"] },
      methods: { quick: { enabled: true } },
    });
    const roles = new Map([defaultRole, verifiedRole].map((role) => [role.id, role]));

    expect(isMethodReady("quick", config.methods.quick, roles, config.methods, config)).toBe(true);
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
});
