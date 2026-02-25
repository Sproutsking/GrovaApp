// ============================================================================
// src/components/Admin/AdminUI.jsx — PRODUCTION GRADE v5
// UI primitives — AdminOnlinePanel FIXED: compares user_id (profile UUID)
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Clock,
  Shield,
} from "lucide-react";

// ─── Color System ──────────────────────────────────────────────────────────
export const C = {
  bg: "#000",
  bg1: "#060606",
  bg2: "#0a0a0a",
  bg3: "#111",
  bg4: "#161616",
  border: "#1a1a1a",
  border2: "#222",
  border3: "#2a2a2a",
  text: "#f0f0f0",
  text2: "#c0c0c0",
  muted: "#555",
  muted2: "#3a3a3a",
  accent: "#a3e635",
  accent2: "#84cc16",
  accent3: "#65a30d",
  danger: "#ef4444",
  warn: "#f59e0b",
  success: "#22c55e",
  info: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  cyan: "#06b6d4",
  orange: "#f97316",
};

// ─── formatTimeAgo (exported for reuse) ───────────────────────────────────
export function formatTimeAgo(date) {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Solve Stamp ───────────────────────────────────────────────────────────
export function SolveStamp({ solvedBy, solvedAt, action, compact = false }) {
  if (!solvedBy) return null;
  const timeAgo = solvedAt ? formatTimeAgo(new Date(solvedAt)) : "";

  if (compact) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          background: `${C.accent}10`,
          border: `1px solid ${C.accent}20`,
          borderRadius: 20,
          fontSize: 10,
          color: C.accent,
        }}
      >
        <Shield size={9} />
        <span>{solvedBy}</span>
        {timeAgo && <span style={{ color: C.muted }}>· {timeAgo}</span>}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: `${C.accent}06`,
        border: `1px solid ${C.accent}18`,
        borderRadius: 9,
        fontSize: 11,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: `${C.accent}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Shield size={11} color={C.accent} />
      </div>
      <div>
        <div style={{ color: C.accent, fontWeight: 700 }}>
          {action || "Resolved"} by {solvedBy}
        </div>
        {timeAgo && (
          <div style={{ color: C.muted, marginTop: 1 }}>
            {timeAgo} · {new Date(solvedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Live Pulse ────────────────────────────────────────────────────────────
export function LivePulse({ color = C.success, label = "Live", size = 8 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            position: "absolute",
          }}
        />
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            position: "absolute",
            animation: "livePulse 1.5s ease-out infinite",
            opacity: 0.6,
          }}
        />
      </div>
      {label && (
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{label}</span>
      )}
      <style>{`@keyframes livePulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.5); opacity: 0; } }`}</style>
    </div>
  );
}

// ─── Activity Ring ─────────────────────────────────────────────────────────
export function ActivityRing({
  value,
  max,
  color = C.accent,
  size = 48,
  label,
}) {
  const pct = Math.min(1, value / (max || 1));
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`${color}15`}
          strokeWidth={5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      {label && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 800,
            color,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// ─── Metric Card ───────────────────────────────────────────────────────────
export function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  trendPositive,
  color = C.accent,
  onClick,
  ring,
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: C.bg2,
        border: `1px solid ${hov && onClick ? color : C.border}`,
        borderRadius: 16,
        padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        transition: "all .2s",
        position: "relative",
        overflow: "hidden",
        transform: hov && onClick ? "translateY(-2px)" : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: `${color}06`,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `${color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={color} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ring && (
            <ActivityRing
              value={ring.value}
              max={ring.max}
              color={color}
              size={36}
              label={`${Math.round((ring.value / (ring.max || 1)) * 100)}%`}
            />
          )}
          {trend !== undefined && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: 11,
                fontWeight: 700,
                color: trendPositive ? C.success : C.danger,
                background: trendPositive ? `${C.success}18` : `${C.danger}18`,
                padding: "3px 8px",
                borderRadius: 20,
              }}
            >
              {trendPositive ? (
                <TrendingUp size={11} />
              ) : (
                <TrendingDown size={11} />
              )}
              {trend}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: C.text,
          letterSpacing: "-1px",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{label}</div>
      {subValue && (
        <div style={{ fontSize: 11, color, marginTop: 3 }}>{subValue}</div>
      )}
    </div>
  );
}

// ─── Section Container ─────────────────────────────────────────────────────
export function Section({
  title,
  subtitle,
  actions,
  children,
  noPad,
  accent,
  live,
}) {
  return (
    <div
      style={{
        background: C.bg1,
        border: `1px solid ${accent ? accent + "30" : C.border}`,
        borderRadius: 16,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {accent && (
              <div
                style={{
                  width: 3,
                  height: 18,
                  borderRadius: 2,
                  background: accent,
                }}
              />
            )}
            <div>
              {title && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ fontSize: 14, fontWeight: 700, color: C.text }}
                  >
                    {title}
                  </span>
                  {live && <LivePulse color={C.success} label="" size={6} />}
                </div>
              )}
              {subtitle && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div style={noPad ? {} : { padding: "14px 18px" }}>{children}</div>
    </div>
  );
}

// ─── Data Table ────────────────────────────────────────────────────────────
export function DataTable({
  columns,
  rows,
  loading,
  onRowClick,
  emptyMsg = "No data",
  footer,
  highlightRow,
}) {
  if (loading)
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
        <Loader2
          size={26}
          style={{ animation: "spin .8s linear infinite" }}
          color={C.accent}
        />
        <div style={{ marginTop: 10, fontSize: 12 }}>Loading…</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  if (!rows?.length)
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: C.muted,
          fontSize: 12,
        }}
      >
        <Info
          size={22}
          style={{ display: "block", margin: "0 auto 8px", color: C.muted2 }}
        />
        {emptyMsg}
      </div>
    );
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: C.bg3 }}>
            {columns.map((col) => (
              <th
                key={col.key || col.label}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".07em",
                  textTransform: "uppercase",
                  color: C.muted,
                  borderBottom: `1px solid ${C.border}`,
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={() => onRowClick?.(row)}
              style={{
                cursor: onRowClick ? "pointer" : "default",
                borderBottom: `1px solid ${C.border}`,
                background: highlightRow?.(row)
                  ? `${C.accent}06`
                  : "transparent",
                transition: "background .12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bg3)}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = highlightRow?.(row)
                  ? `${C.accent}06`
                  : "transparent")
              }
            >
              {columns.map((col) => (
                <td
                  key={col.key || col.label}
                  style={{
                    padding: "12px 14px",
                    fontSize: 12,
                    color: C.muted,
                    verticalAlign: "middle",
                  }}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────
export function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderTop: `1px solid ${C.border}`,
        fontSize: 12,
        color: C.muted,
      }}
    >
      <span>
        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)}{" "}
        of {total.toLocaleString()}
      </span>
      <div style={{ display: "flex", gap: 5 }}>
        <Btn
          icon={ChevronLeft}
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          size="sm"
        />
        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
          const pg = Math.max(0, Math.min(page - 3, totalPages - 7)) + i;
          return (
            <button
              key={pg}
              onClick={() => onPageChange(pg)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "none",
                background: pg === page ? C.accent : C.bg3,
                color: pg === page ? "#000" : C.muted,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {pg + 1}
            </button>
          );
        })}
        <Btn
          icon={ChevronRight}
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          size="sm"
        />
      </div>
    </div>
  );
}

// ─── Button ────────────────────────────────────────────────────────────────
export function Btn({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = "secondary",
  size = "md",
  danger,
  loading: btnLoading,
  title,
  fullWidth,
}) {
  const pad =
    size === "sm" ? "5px 10px" : size === "lg" ? "12px 24px" : "8px 14px";
  const fSize = size === "sm" ? 11 : size === "lg" ? 14 : 13;
  const styles = {
    primary: {
      background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
      color: "#000",
      border: "none",
    },
    secondary: {
      background: C.bg3,
      color: C.text2,
      border: `1px solid ${C.border2}`,
    },
    ghost: {
      background: "transparent",
      color: C.muted,
      border: `1px solid ${C.border}`,
    },
    danger: {
      background: `${C.danger}15`,
      color: C.danger,
      border: `1px solid ${C.danger}35`,
    },
  };
  const s = danger ? styles.danger : styles[variant] || styles.secondary;
  return (
    <button
      onClick={onClick}
      disabled={disabled || btnLoading}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: pad,
        borderRadius: 8,
        fontSize: fSize,
        fontWeight: 600,
        cursor: disabled || btnLoading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all .15s",
        width: fullWidth ? "100%" : undefined,
        justifyContent: fullWidth ? "center" : undefined,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        ...s,
      }}
    >
      {btnLoading ? (
        <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} />
      ) : (
        Icon && <Icon size={fSize + 1} />
      )}
      {label}
    </button>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────
export function Badge({ label, color = C.muted, bg, dot }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        background: bg || `${color}15`,
        color,
        border: `1px solid ${color}22`,
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: color,
          }}
        />
      )}
      {label}
    </span>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    active: { color: C.success, label: "Active" },
    inactive: { color: C.muted, label: "Inactive" },
    suspended: { color: C.danger, label: "Suspended" },
    deactivated: { color: C.muted, label: "Deactivated" },
    banned: { color: C.danger, label: "Banned" },
    pending: { color: C.warn, label: "Pending" },
    completed: { color: C.success, label: "Completed" },
    failed: { color: C.danger, label: "Failed" },
    refunded: { color: C.info, label: "Refunded" },
    paid: { color: C.success, label: "Paid" },
    free: { color: C.muted, label: "Free" },
    vip: { color: "#f59e0b", label: "VIP" },
    pro: { color: C.purple, label: "Pro" },
    standard: { color: C.info, label: "Standard" },
    whitelist: { color: C.accent, label: "Whitelist" },
    open: { color: C.warn, label: "Open" },
    in_progress: { color: C.cyan, label: "In Progress" },
    resolved: { color: C.success, label: "Resolved" },
    closed: { color: C.muted, label: "Closed" },
    investigating: { color: C.cyan, label: "Investigating" },
    escalated: { color: C.danger, label: "Escalated" },
  };
  const { color, label } = map[status] || {
    color: C.muted,
    label: status || "—",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        background: `${color}15`,
        color,
        border: `1px solid ${color}25`,
      }}
    >
      <span
        style={{ width: 4, height: 4, borderRadius: "50%", background: color }}
      />
      {label}
    </span>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  danger: isDanger,
  wide,
}) {
  if (!open) return null;
  const mw = wide ? 900 : width;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.88)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: mw,
          background: C.bg1,
          border: `1px solid ${isDanger ? C.danger + "50" : C.border2}`,
          borderRadius: 18,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "modalIn .2s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: isDanger ? C.danger : C.text,
            }}
          >
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: C.bg3,
              border: `1px solid ${C.border2}`,
              borderRadius: 6,
              width: 26,
              height: 26,
              cursor: "pointer",
              color: C.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            {footer}
          </div>
        )}
      </div>
      <style>{`@keyframes modalIn { from { opacity:0; transform: scale(.94) translateY(12px); } to { opacity:1; transform: scale(1) translateY(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Field / Input / Select ────────────────────────────────────────────────
export function Field({ label, hint, error, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 700,
            color: error ? C.danger : C.muted,
            marginBottom: 6,
            letterSpacing: ".03em",
          }}
        >
          {label} {required && <span style={{ color: C.danger }}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <div style={{ fontSize: 10, color: C.muted2, marginTop: 4 }}>
          {hint}
        </div>
      )}
      {error && (
        <div
          style={{
            fontSize: 10,
            color: C.danger,
            marginTop: 4,
            display: "flex",
            gap: 4,
          }}
        >
          <AlertCircle size={11} />
          {error}
        </div>
      )}
    </div>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  min,
  max,
  step,
  rows,
  style: extraStyle,
}) {
  const base = {
    width: "100%",
    padding: "9px 12px",
    background: C.bg3,
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    color: C.text,
    fontSize: 12,
    transition: "border-color .2s",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    ...extraStyle,
  };
  if (rows)
    return (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        style={{ ...base, resize: "vertical", lineHeight: 1.5 }}
        onFocus={(e) => (e.target.style.borderColor = C.accent)}
        onBlur={(e) => (e.target.style.borderColor = C.border2)}
      />
    );
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      style={base}
      onFocus={(e) => (e.target.style.borderColor = C.accent)}
      onBlur={(e) => (e.target.style.borderColor = C.border2)}
    />
  );
}

export function Select({ value, onChange, options, disabled }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "9px 12px",
        background: C.bg3,
        border: `1px solid ${C.border2}`,
        borderRadius: 8,
        color: C.text,
        fontSize: 12,
        fontFamily: "inherit",
        cursor: "pointer",
        outline: "none",
      }}
      onFocus={(e) => (e.target.style.borderColor = C.accent)}
      onBlur={(e) => (e.target.style.borderColor = C.border2)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Alert ─────────────────────────────────────────────────────────────────
export function Alert({ type = "info", message, onClose }) {
  if (!message) return null;
  const map = {
    success: { color: C.success, Icon: CheckCircle2 },
    error: { color: C.danger, Icon: XCircle },
    info: { color: C.info, Icon: Info },
    warn: { color: C.warn, Icon: AlertCircle },
  };
  const { color, Icon } = map[type] || map.info;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "10px 14px",
        background: `${color}10`,
        border: `1px solid ${color}30`,
        borderRadius: 9,
        color,
        fontSize: 12,
        marginBottom: 14,
      }}
    >
      <Icon size={14} />
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Search Bar ────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = "Search…" }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 12px",
        background: C.bg3,
        border: `1px solid ${C.border2}`,
        borderRadius: 8,
        minWidth: 200,
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={C.muted}
        strokeWidth="2.5"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          color: C.text,
          fontSize: 12,
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          style={{
            background: "none",
            border: "none",
            color: C.muted,
            cursor: "pointer",
            padding: 0,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      danger={danger}
      width={400}
      footer={
        <>
          <Btn label="Cancel" onClick={onClose} />
          <Btn
            label={confirmLabel}
            onClick={onConfirm}
            variant="primary"
            danger={danger}
          />
        </>
      }
    >
      <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────
export function Avatar({ name, src, size = 34, color = C.accent, online }) {
  const letter = (name || "?").charAt(0).toUpperCase();
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {src ? (
        <img
          src={src}
          alt={name}
          style={{
            width: size,
            height: size,
            borderRadius: size / 3,
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: size / 3,
            background: `${color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.38,
            fontWeight: 800,
            color,
          }}
        >
          {letter}
        </div>
      )}
      {online !== undefined && (
        <div
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: "50%",
            background: online ? C.success : C.muted2,
            border: `2px solid ${C.bg1}`,
          }}
        />
      )}
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 3,
        padding: 3,
        background: C.bg3,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        marginBottom: 18,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: "7px 14px",
            borderRadius: 7,
            border: "none",
            background: active === tab.id ? C.accent : "transparent",
            color: active === tab.id ? "#000" : C.muted,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all .15s",
            fontFamily: "inherit",
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {tab.icon && <tab.icon size={13} />}
          {tab.label}
          {tab.count !== undefined && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 10,
                background: active === tab.id ? "rgba(0,0,0,.2)" : C.border2,
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div style={{ padding: "48px 20px", textAlign: "center" }}>
      {Icon && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: `${C.accent}10`,
            border: `1px solid ${C.accent}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <Icon size={24} color={C.accent} />
        </div>
      )}
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: C.text,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>
          {description}
        </div>
      )}
      {action}
    </div>
  );
}

// ─── Activity Timeline ─────────────────────────────────────────────────────
export function ActivityTimeline({ events }) {
  if (!events?.length)
    return (
      <div
        style={{
          color: C.muted,
          fontSize: 12,
          textAlign: "center",
          padding: 20,
        }}
      >
        No activity yet
      </div>
    );
  return (
    <div style={{ position: "relative", paddingLeft: 20 }}>
      <div
        style={{
          position: "absolute",
          left: 7,
          top: 0,
          bottom: 0,
          width: 1,
          background: C.border,
        }}
      />
      {events.map((ev, i) => (
        <div key={i} style={{ position: "relative", marginBottom: 16 }}>
          <div
            style={{
              position: "absolute",
              left: -20,
              top: 2,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: ev.color || C.accent,
              border: `2px solid ${C.bg1}`,
            }}
          />
          <div style={{ fontSize: 12, color: C.text2, fontWeight: 600 }}>
            {ev.action}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {ev.by && <span style={{ color: C.accent }}>{ev.by} · </span>}
            {ev.time && formatTimeAgo(new Date(ev.time))}
          </div>
          {ev.detail && (
            <div
              style={{
                fontSize: 11,
                color: C.muted2,
                marginTop: 3,
                fontStyle: "italic",
              }}
            >
              {ev.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Case Card ─────────────────────────────────────────────────────────────
export function CaseCard({ caseData, onClick, adminData }) {
  const priority = caseData.priority || "medium";
  const pColors = {
    critical: C.danger,
    high: C.orange,
    medium: C.warn,
    low: C.info,
  };
  const pColor = pColors[priority] || C.muted;
  const isOwn =
    caseData.assigned_to_id === (adminData?.user_id || adminData?.id);
  return (
    <div
      onClick={() => onClick?.(caseData)}
      style={{
        background: C.bg2,
        border: `1px solid ${isOwn ? C.accent + "30" : C.border}`,
        borderLeft: `3px solid ${pColor}`,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all .15s",
        marginBottom: 10,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.bg3)}
      onMouseLeave={(e) => (e.currentTarget.style.background = C.bg2)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: pColor,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              {priority}
            </span>
            <StatusBadge status={caseData.status || "open"} />
            {isOwn && <Badge label="Assigned to you" color={C.accent} dot />}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              marginBottom: 4,
            }}
          >
            {caseData.title || caseData.subject}
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            {caseData.description?.slice(0, 100)}
            {caseData.description?.length > 100 ? "…" : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {caseData.user_email && (
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>
              {caseData.user_email}
            </div>
          )}
          <div style={{ fontSize: 10, color: C.muted }}>
            {formatTimeAgo(new Date(caseData.created_at))}
          </div>
          {caseData.assigned_to_name && (
            <div style={{ fontSize: 10, color: C.cyan, marginTop: 4 }}>
              → {caseData.assigned_to_name}
            </div>
          )}
        </div>
      </div>
      {caseData.solved_by_name && (
        <div style={{ marginTop: 8 }}>
          <SolveStamp
            solvedBy={caseData.solved_by_name}
            solvedAt={caseData.solved_at}
            action="Resolved"
            compact
          />
        </div>
      )}
    </div>
  );
}

// ─── AdminOnlinePanel ──────────────────────────────────────────────────────
// FIXED: currentAdminUserId must be the profile UUID (user_id from admin_team)
// Each team member is compared by m.user_id (their profile UUID)
// The panel shows role badge instead of duplicated names
export function AdminOnlinePanel({ team, currentAdminUserId }) {
  const online = (team || []).filter((m) => m.is_online);
  const away = (team || []).filter(
    (m) =>
      !m.is_online &&
      m.last_active &&
      Date.now() - new Date(m.last_active).getTime() < 900000, // 15 min
  );

  const displayList = [...online, ...away].slice(0, 8);

  const ROLE_COLORS = {
    ceo_owner: "#f59e0b",
    super_admin: "#8b5cf6",
    a_admin: "#3b82f6",
    admin: "#22c55e",
    b_admin: "#06b6d4",
    support: "#a3e635",
  };

  const ROLE_LABELS = {
    ceo_owner: "CEO",
    super_admin: "Super Admin",
    a_admin: "Admin A",
    admin: "Admin",
    b_admin: "Admin B",
    support: "Support",
  };

  return (
    <div
      style={{
        background: C.bg2,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <LivePulse color={C.success} label={`${online.length} Online`} />
      </div>

      {displayList.length === 0 ? (
        <div
          style={{
            fontSize: 11,
            color: C.muted,
            textAlign: "center",
            padding: "12px 0",
          }}
        >
          No team members online
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayList.map((m) => {
            // CRITICAL: compare m.user_id (profile UUID) against currentAdminUserId
            const isYou = m.user_id === currentAdminUserId;
            const isOnline = online.includes(m);
            const roleColor = ROLE_COLORS[m.role] || C.muted;
            const roleLabel = ROLE_LABELS[m.role] || m.role;

            return (
              <div
                key={m.id}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Avatar
                  name={m.full_name}
                  size={28}
                  online={isOnline}
                  color={isYou ? C.accent : roleColor}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isYou ? C.accent : C.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 110,
                      }}
                    >
                      {m.full_name}
                    </span>
                    {isYou && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: C.accent,
                          background: `${C.accent}15`,
                          border: `1px solid ${C.accent}30`,
                          borderRadius: 4,
                          padding: "1px 5px",
                        }}
                      >
                        you
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: roleColor,
                      fontWeight: 600,
                      marginTop: 1,
                    }}
                  >
                    {roleLabel}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: isOnline ? C.success : C.muted,
                    fontWeight: 600,
                  }}
                >
                  {isOnline ? "now" : "away"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
