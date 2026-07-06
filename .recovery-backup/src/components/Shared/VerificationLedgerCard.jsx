import React, { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Database, Link2, Shield, Sparkles } from "lucide-react";
import evidenceService from "../../services/evidence/evidenceService";

const VerificationLedgerCard = ({ userId, currentUser, onOpenOracle }) => {
  const [loading, setLoading] = useState(true);
  const [graph, setGraph] = useState({ items: [], edges: [] });

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setGraph({ items: [], edges: [] });
      return;
    }

    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const next = await evidenceService.getEvidenceGraph(userId, { limit: 6 });
        if (active) setGraph(next || { items: [], edges: [] });
      } catch (error) {
        console.warn("Verification ledger failed:", error?.message || error);
        if (active) setGraph({ items: [], edges: [] });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [userId]);

  const items = graph?.items || [];
  const edges = graph?.edges || [];
  const verifiedCount = useMemo(() => items.filter((item) => item.verified).length, [items]);
  const providerCount = useMemo(() => new Set(items.map((item) => item.provider).filter(Boolean)).size, [items]);

  const strength = items.length >= 6 ? "Elite" : items.length >= 3 ? "Strong" : items.length > 0 ? "Emerging" : "Dormant";
  const accent = items.length >= 6 ? "#84cc16" : items.length >= 3 ? "#60a5fa" : "#f59e0b";

  return (
    <div style={{
      position: "relative",
      borderRadius: 22,
      padding: 18,
      background: "linear-gradient(135deg, rgba(132,204,22,0.12), rgba(255,255,255,0.03))",
      border: "1px solid rgba(132,204,22,0.28)",
      boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
      overflow: "hidden",
      marginBottom: 18,
    }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(132,204,22,0.16), transparent 44%)" }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}18`, border: `1px solid ${accent}32` }}>
              <Shield size={18} color={accent} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Verification Ledger</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Evidence graph · Oracle-ready proof trail</div>
            </div>
          </div>
          {typeof onOpenOracle === "function" && (
            <button
              type="button"
              onClick={onOpenOracle}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: `1px solid ${accent}35`,
                background: `${accent}12`,
                color: accent,
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Activity size={13} /> Open Oracle
            </button>
          )}
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", marginBottom: 14 }}>
          {[
            { label: "Signal", value: strength, accent },
            { label: "Evidence", value: items.length, accent: "#84cc16" },
            { label: "Relations", value: edges.length, accent: "#60a5fa" },
            { label: "Verified", value: verifiedCount, accent: "#f59e0b" },
          ].map((item) => (
            <div key={item.label} style={{ padding: "12px 10px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{item.value}</div>
              <div style={{ fontSize: 10, color: "#737373", textTransform: "uppercase", letterSpacing: "0.4px", marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: accent, background: `${accent}14`, border: `1px solid ${accent}22` }}>
            <Database size={12} /> {providerCount || 0} connected sources
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)" }}>
            <Link2 size={12} /> Graph linked
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <Sparkles size={12} /> {currentUser?.id === userId ? "Your profile" : "Connected profile"}
          </span>
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: "#8b8b8b" }}>Building the verification trail…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: "12px 0 2px", fontSize: 13, color: "#9ca3af" }}>
            Connect a platform to start populating this ledger.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.slice(0, 3).map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.title || item.external_id || item.evidence_type || "Evidence"}
                  </div>
                  <div style={{ fontSize: 11, color: "#8b8b8b", marginTop: 2 }}>
                    {item.provider || "connector"} · {item.evidence_type || "profile"}
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: item.verified ? "#84cc16" : "#9ca3af", fontSize: 11, fontWeight: 700 }}>
                  {item.verified ? <Shield size={12} /> : <Database size={12} />}
                  {item.verified ? "Verified" : "Tracked"}
                </div>
              </div>
            ))}
            <button type="button" onClick={onOpenOracle} style={{ alignSelf: "flex-start", marginTop: 2, background: "none", border: "none", color: "#84cc16", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: 0 }}>
              View the full chain <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationLedgerCard;
