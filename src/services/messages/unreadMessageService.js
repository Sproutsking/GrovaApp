import { supabase } from "../config/supabase";

export async function fetchDirectMessageUnreadSummary() {
  const { data, error } = await supabase.rpc("get_direct_message_unread_summary");
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("Unread message summary returned an invalid response.");
  }

  const count = Number(data.unread_count);
  if (!Number.isSafeInteger(count) || count < 0 || !Array.isArray(data.conversation_ids)) {
    throw new Error("Unread message summary returned invalid fields.");
  }

  return {
    count,
    convSet: new Set(data.conversation_ids.filter((id) => typeof id === "string")),
  };
}
