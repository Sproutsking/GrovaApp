// ============================================================================
// src/components/Admin/sections/SystemSection.jsx
// System settings, platform freeze, platform config
// ============================================================================
import React, { useState } from "react";
import {
  Settings,
  Lock,
  Unlock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Save,
  RefreshCw,
  Server,
  Database,
  Wifi,
  Shield,
} from "lucide-react";
import {
  Section,
  Btn,
  Alert,
  Field,
  Input,
  Select,
  C,
  Badge,
  Tabs,
} from "../AdminUI.jsx";
import { can, PERMISSIONS } from "../permissions.js";

const REGIONS = [
  {
    id: "all",
    label: "🌍 Global (All Regions)",
    description: "Complete platform freeze worldwide",
  },
  {
    id: "africa",
    label: "🌍 Africa",
    countries: ["NG", "GH", "KE", "ZA", "EG", "TZ", "ET", "RW", "SN", "CI"],
  },
  {
    id: "north_america",
    label: "🌎 North America",
    countries: ["US", "CA", "MX"],
  },
  {
    id: "south_america",
    label: "🌎 South America",
    countries: ["BR", "AR", "CO", "PE", "CL"],
  },
  {
    id: "europe",
    label: "🌍 Europe",
    countries: ["GB", "DE", "FR", "IT", "ES", "NL", "SE", "NO"],
  },
  {
    id: "asia",
    label: "🌏 Asia",
    countries: ["IN", "CN", "JP", "KR", "SG", "MY", "ID", "PH", "TH"],
  },
  { id: "oceania", label: "🌏 Oceania", countries: ["AU", "NZ"] },
  {
    id: "middle_east",
    label: "🌍 Middle East",
    countries: ["AE", "SA", "QA", "KW", "TR"],
  },
];

export function FreezeSection({ adminData, freezeHook }) {
  const { freezeStatus, loading, toggle } = freezeHook;
  const [alert, setAlert] = useState(null);
  const canFreeze = can(adminData, PERMISSIONS.PLATFORM_FREEZE);

  if (!canFreeze) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <Shield
          size={48}
          color={C.muted}
          style={{ display: "block", margin: "0 auto 16px" }}
        />
        <div style={{ fontSize: 16, color: C.muted }}>
          Insufficient permissions
        </div>
      </div>
    );
  }

  const handleToggle = async (regionId, freeze) => {
    await toggle(regionId, freeze);
    setAlert({
      type: freeze ? "warn" : "success",
      msg: freeze
        ? `🔒 ${regionId} has been frozen.`
        : `✅ ${regionId} has been unfrozen.`,
    });
  };

  const frozenCount = Object.values(freezeStatus).filter(Boolean).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}
          >
            Platform Freeze Control
          </h1>
          <p style={{ color: C.muted, marginTop: 4, fontSize: 14 }}>
            Block platform access by region during security incidents
          </p>
        </div>
        {frozenCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: `${C.danger}15`,
              border: `1px solid ${C.danger}35`,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: C.danger,
                animation: "pulse 1.5s infinite",
              }}
            />
            <span style={{ color: C.danger, fontWeight: 700, fontSize: 13 }}>
              {frozenCount} region{frozenCount > 1 ? "s" : ""} frozen
            </span>
          </div>
        )}
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.msg}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Warning banner */}
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "14px 18px",
          background: `${C.warn}10`,
          border: `1px solid ${C.warn}30`,
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <AlertTriangle
          size={20}
          color={C.warn}
          style={{ flexShrink: 0, marginTop: 1 }}
        />
        <div style={{ fontSize: 13, color: C.warn, lineHeight: 1.6 }}>
          <strong>Caution:</strong> Freezing a region immediately blocks all
          users in that area from accessing Xeevia. This is intended for
          emergency security responses only. Verify with CEO before freezing
          major regions.
        </div>
      </div>

      {/* Global freeze prominent card */}
      <div
        style={{
          marginBottom: 20,
          padding: "20px 22px",
          background: freezeStatus["all"] ? `${C.danger}12` : C.bg2,
          border: `2px solid ${freezeStatus["all"] ? C.danger : C.border}`,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: freezeStatus["all"]
              ? `${C.danger}20`
              : `${C.success}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {freezeStatus["all"] ? (
            <Lock size={26} color={C.danger} />
          ) : (
            <Globe size={26} color={C.success} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: freezeStatus["all"] ? C.danger : C.text,
            }}
          >
            Global Platform {freezeStatus["all"] ? "— FROZEN" : "— Active"}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {freezeStatus["all"]
              ? "⚠️ All users are currently blocked from accessing Xeevia."
              : "Platform is operating normally worldwide."}
          </div>
        </div>
        <button
          onClick={() => handleToggle("all", !freezeStatus["all"])}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            border: `1px solid ${freezeStatus["all"] ? C.success + "50" : C.danger + "50"}`,
            background: freezeStatus["all"]
              ? `${C.success}20`
              : `${C.danger}20`,
            color: freezeStatus["all"] ? C.success : C.danger,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
          disabled={loading}
        >
          {freezeStatus["all"] ? "🟢 Unfreeze Global" : "🔴 Freeze Global"}
        </button>
      </div>

      {/* Regional cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 14,
        }}
      >
        {REGIONS.slice(1).map((region) => {
          const frozen = freezeStatus[region.id] === true;
          return (
            <div
              key={region.id}
              style={{
                background: frozen ? `${C.danger}08` : C.bg2,
                border: `1px solid ${frozen ? C.danger + "40" : C.border}`,
                borderRadius: 14,
                padding: "16px 18px",
                transition: "all .2s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: frozen ? C.danger : C.text,
                  }}
                >
                  {region.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: frozen ? `${C.danger}18` : `${C.success}12`,
                    color: frozen ? C.danger : C.success,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "currentColor",
                    }}
                  />
                  {frozen ? "Frozen" : "Active"}
                </div>
              </div>
              {region.countries && (
                <div
                  style={{
                    fontSize: 11,
                    color: C.muted,
                    marginBottom: 12,
                    lineHeight: 1.6,
                  }}
                >
                  {region.countries.join(", ")}
                </div>
              )}
              <button
                onClick={() => handleToggle(region.id, !frozen)}
                style={{
                  width: "100%",
                  padding: "8px 0",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  border: `1px solid ${frozen ? C.success + "40" : C.danger + "40"}`,
                  background: frozen ? `${C.success}15` : `${C.danger}12`,
                  color: frozen ? C.success : C.danger,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
                disabled={loading}
              >
                {frozen ? (
                  <>
                    <Unlock size={13} /> Unfreeze
                  </>
                ) : (
                  <>
                    <Lock size={13} /> Freeze
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }`}</style>
    </div>
  );
}

// ============================================================================
// SystemSection — platform settings, env config
// ============================================================================
export function SystemSection({ adminData, platformSettings }) {
  const { settings, update, refresh, loading } = platformSettings;
  const [tab, setTab] = useState("general");
  const [alert, setAlert] = useState(null);
  const canEdit = can(adminData, PERMISSIONS.EDIT_SETTINGS);

  const handleUpdate = async (key, val) => {
    try {
      await update(key, val);
      setAlert({ type: "success", msg: "Setting saved." });
      setTimeout(() => setAlert(null), 2000);
    } catch (e) {
      setAlert({ type: "error", msg: e.message });
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}
          >
            System Settings
          </h1>
          <p style={{ color: C.muted, marginTop: 4, fontSize: 14 }}>
            Platform configuration and environment
          </p>
        </div>
        <Btn icon={RefreshCw} onClick={refresh} size="sm" />
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.msg}
          onClose={() => setAlert(null)}
        />
      )}

      <Tabs
        tabs={[
          { id: "general", label: "General" },
          { id: "payments", label: "Payments" },
          { id: "security", label: "Security" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "general" && (
        <Section title="General Configuration">
          {[
            {
              key: "app_name",
              label: "App Name",
              type: "text",
              default: "Xeevia",
            },
            {
              key: "app_tagline",
              label: "App Tagline",
              type: "text",
              default: "Own Your Social",
            },
            {
              key: "max_post_images",
              label: "Max Images per Post",
              type: "number",
              default: 10,
            },
            {
              key: "max_story_length",
              label: "Max Story Length",
              type: "number",
              default: 50000,
            },
            {
              key: "free_ep_daily_cap",
              label: "Free EP Daily Cap",
              type: "number",
              default: 100,
            },
          ].map((s) => (
            <SettingRow
              key={s.key}
              setting={s}
              value={settings[s.key]}
              onSave={handleUpdate}
              canEdit={canEdit}
            />
          ))}
        </Section>
      )}

      {tab === "payments" && (
        <Section title="Payment Configuration">
          {[
            {
              key: "platform_entry_price",
              label: "Platform Entry Price (USD)",
              type: "number",
              default: 1.0,
            },
            {
              key: "vip_price",
              label: "VIP Price (USD)",
              type: "number",
              default: 5.0,
            },
            {
              key: "pro_price_monthly",
              label: "Pro Monthly (USD)",
              type: "number",
              default: 9.99,
            },
            {
              key: "whitelist_price",
              label: "Whitelist Price (USD)",
              type: "number",
              default: 0.5,
            },
          ].map((s) => (
            <SettingRow
              key={s.key}
              setting={s}
              value={settings[s.key]}
              onSave={handleUpdate}
              canEdit={canEdit}
            />
          ))}
        </Section>
      )}

      {tab === "security" && (
        <Section title="Security Configuration">
          {[
            {
              key: "max_login_attempts",
              label: "Max Login Attempts",
              type: "number",
              default: 5,
            },
            {
              key: "lock_duration_hours",
              label: "Account Lock Duration (h)",
              type: "number",
              default: 24,
            },
            {
              key: "session_duration_h",
              label: "Session Duration (hours)",
              type: "number",
              default: 720,
            },
            {
              key: "rate_limit_window",
              label: "Rate Limit Window (s)",
              type: "number",
              default: 60,
            },
          ].map((s) => (
            <SettingRow
              key={s.key}
              setting={s}
              value={settings[s.key]}
              onSave={handleUpdate}
              canEdit={canEdit}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function SettingRow({ setting, value, onSave, canEdit }) {
  const [localVal, setLocalVal] = useState(value ?? setting.default);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handle = async () => {
    setSaving(true);
    await onSave(setting.key, localVal);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          {setting.label}
        </div>
        <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
          {setting.key}
        </div>
      </div>
      <input
        type={setting.type || "text"}
        value={localVal ?? ""}
        onChange={(e) =>
          setLocalVal(
            setting.type === "number" ? Number(e.target.value) : e.target.value,
          )
        }
        disabled={!canEdit}
        style={{
          width: 160,
          padding: "7px 10px",
          background: C.bg3,
          border: `1px solid ${C.border2}`,
          borderRadius: 7,
          color: C.text,
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
      {canEdit && (
        <Btn
          icon={saved ? CheckCircle2 : Save}
          size="sm"
          loading={saving}
          onClick={handle}
          label={saved ? "Saved!" : "Save"}
          variant={saved ? "ghost" : "secondary"}
        />
      )}
    </div>
  );
}
