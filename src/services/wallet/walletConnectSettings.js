export const walletConnectProjectId = process.env.REACT_APP_REOWN_PROJECT_ID?.trim() || "";
export const walletConnectConfigured = /^[a-f\d]{32}$/i.test(walletConnectProjectId);
