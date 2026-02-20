// src/components/Admin/AdminDiagnostic.jsx
// DROP THIS ANYWHERE IN YOUR APP TEMPORARILY — removes itself once you find the issue
// Usage: <AdminDiagnostic userId={user.id} supabase={supabase} />

import React, { useState, useEffect } from "react";

const AdminDiagnostic = ({ userId, supabase }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const log = (msg, data = null, isError = false) => {
    setResults((prev) => [
      ...prev,
      { msg, data, isError, time: new Date().toISOString() },
    ]);
  };

  useEffect(() => {
    if (!userId || !supabase) {
      log("❌ No userId or supabase passed as props", null, true);
      setLoading(false);
      return;
    }
    runDiagnostics();
  }, [userId]);

  const runDiagnostics = async () => {
    log(`🔍 Starting admin diagnostics for userId: ${userId}`);

    // Step 1: Check auth user
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) log("❌ Auth getUser error", error.message, true);
      else log("✅ Auth user found", { id: user?.id, email: user?.email });
    } catch (e) {
      log("❌ Auth getUser threw", e.message, true);
    }

    // Step 2: Check profile exists
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, username, account_activated")
        .eq("id", userId)
        .maybeSingle();
      if (error) log("❌ Profile query error", error.message, true);
      else if (!data) log("❌ No profile found for this userId", null, true);
      else log("✅ Profile found", data);
    } catch (e) {
      log("❌ Profile query threw", e.message, true);
    }

    // Step 3: Check admin_team table — no filters yet
    try {
      const { data, error } = await supabase
        .from("admin_team")
        .select("*")
        .eq("user_id", userId);
      if (error)
        log("❌ admin_team query error (may be RLS)", error.message, true);
      else if (!data || data.length === 0)
        log("❌ No rows in admin_team for this user_id", { userId }, true);
      else log("✅ admin_team rows found", data);
    } catch (e) {
      log("❌ admin_team query threw", e.message, true);
    }

    // Step 4: Check admin_team with status filter
    try {
      const { data, error } = await supabase
        .from("admin_team")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active");
      if (error) log("❌ admin_team active filter error", error.message, true);
      else if (!data || data.length === 0) {
        log(
          "⚠️ admin_team row exists but status is NOT 'active'",
          "Check the status column value in your admin_team table",
          true,
        );
      } else {
        log("✅ admin_team active row found — admin check SHOULD work", data);
      }
    } catch (e) {
      log("❌ admin_team active query threw", e.message, true);
    }

    // Step 5: Check by email instead of user_id
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        const { data, error } = await supabase
          .from("admin_team")
          .select("*")
          .eq("email", user.email);
        if (error) log("❌ admin_team email search error", error.message, true);
        else if (!data || data.length === 0) {
          log("⚠️ No admin_team row with this email", user.email, true);
        } else {
          const hasUserId = data.some((r) => r.user_id === userId);
          if (!hasUserId) {
            log(
              "🔴 FOUND IT: admin_team row has this email BUT user_id is different!",
              {
                rowUserId: data[0].user_id,
                authUserId: userId,
                email: user.email,
              },
              true,
            );
          } else {
            log("✅ Email match and user_id match confirmed", data[0]);
          }
        }
      }
    } catch (e) {
      log("❌ Email search threw", e.message, true);
    }

    // Step 6: Check RLS policies
    try {
      const { data, error } = await supabase
        .from("admin_team")
        .select("count", { count: "exact", head: true });
      if (error) {
        log(
          "🔴 RLS is BLOCKING admin_team reads entirely",
          error.message,
          true,
        );
      } else {
        log("✅ Can count admin_team rows — RLS allows reads", { count: data });
      }
    } catch (e) {
      log("❌ RLS check threw", e.message, true);
    }

    setLoading(false);
    log("🏁 Diagnostics complete");
  };

  const style = {
    container: {
      position: "fixed",
      bottom: 20,
      right: 20,
      width: 480,
      maxHeight: 500,
      background: "#0a0a0a",
      border: "2px solid #a3e635",
      borderRadius: 12,
      padding: 16,
      zIndex: 999999,
      overflowY: "auto",
      fontFamily: "monospace",
      fontSize: 11,
    },
    header: {
      color: "#a3e635",
      fontWeight: 700,
      fontSize: 13,
      marginBottom: 12,
      display: "flex",
      justifyContent: "space-between",
    },
    row: { padding: "5px 0", borderBottom: "1px solid #1a1a1e" },
    ok: { color: "#22c55e" },
    err: { color: "#ef4444" },
    data: {
      color: "#9ca3af",
      marginLeft: 16,
      marginTop: 3,
      wordBreak: "break-all",
    },
  };

  return (
    <div style={style.container}>
      <div style={style.header}>
        <span>🔧 Admin Diagnostic</span>
        {loading && <span style={{ color: "#f59e0b" }}>Running...</span>}
      </div>
      {results.map((r, i) => (
        <div key={i} style={style.row}>
          <div style={r.isError ? style.err : style.ok}>{r.msg}</div>
          {r.data && (
            <div style={style.data}>
              {typeof r.data === "object"
                ? JSON.stringify(r.data, null, 2)
                : r.data}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminDiagnostic;
