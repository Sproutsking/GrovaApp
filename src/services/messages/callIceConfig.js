import { supabase } from "../config/supabase";

export const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const getCallIceServers = async () => {
  const { data, error } = await supabase.functions.invoke("get-call-ice-config");
  if (error) {
    throw new Error(`Could not load call relay configuration: ${error.message}`);
  }

  const iceServers = data?.iceServers;
  if (
    !Array.isArray(iceServers)
    || !iceServers.some((server) => server && (typeof server.urls === "string" || Array.isArray(server.urls)))
  ) {
    throw new Error("Call relay configuration is missing or invalid.");
  }

  return iceServers;
};
