export const shouldRenderIncomingCallPopup = ({ incomingCall, activeCall, view }) => {
  if (!incomingCall) return false;
  if (activeCall) return false;
  if (view === "call" || view === "group") return false;
  return true;
};
