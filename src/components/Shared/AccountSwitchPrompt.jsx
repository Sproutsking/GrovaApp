import React, { memo, useEffect, useState } from "react";

const STORAGE_KEY = "xv_last_active_account";

function readStoredAccount() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredAccount(accountId) {
  try {
    window.localStorage.setItem(STORAGE_KEY, accountId || "");
  } catch {}
}

const AccountSwitchPrompt = memo(({ userId, userName, onSwitchAccount }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const previousAccount = readStoredAccount();
    if (previousAccount && previousAccount !== userId) {
      setVisible(true);
    } else {
      writeStoredAccount(userId);
    }
  }, [userId]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.72)",
        zIndex: 2147483646,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "min(92vw, 420px)",
          background: "rgba(8, 10, 8, 0.97)",
          border: "1px solid rgba(168, 230, 61, 0.3)",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 16px 60px rgba(0, 0, 0, 0.6)",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: 800, color: "#a8e63d", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
          Account switch
        </div>
        <div style={{ fontSize: "18px", fontWeight: 800, color: "#f7f7f7", marginBottom: "8px" }}>
          You already have another account active on this device
        </div>
        <div style={{ fontSize: "13px", color: "#95a38d", lineHeight: 1.5, marginBottom: "16px" }}>
          {userName ? `${userName} is now active.` : "Switch safely to the account you want to use."}
          <br />
          Sign out and sign back in to move between accounts without confusion.
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              writeStoredAccount(userId);
              setVisible(false);
            }}
            style={{
              flex: 1,
              border: "none",
              background: "rgba(255,255,255,0.08)",
              color: "#dce9d0",
              padding: "10px 12px",
              borderRadius: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Continue
          </button>
          <button
            onClick={async () => {
              writeStoredAccount(userId);
              setVisible(false);
              if (typeof onSwitchAccount === "function") {
                await onSwitchAccount();
              }
            }}
            style={{
              flex: 1,
              border: "none",
              background: "linear-gradient(135deg, #a8e63d, #60a513)",
              color: "#051100",
              padding: "10px 12px",
              borderRadius: "12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Switch account
          </button>
        </div>
      </div>
    </div>
  );
});

AccountSwitchPrompt.displayName = "AccountSwitchPrompt";
export default AccountSwitchPrompt;
