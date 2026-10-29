import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/config/supabase";
import TicketToolPanel from "./TicketToolPanel";
import VerificationPanel from "../verification/VerificationPanel";

export default function CommunityToolPanelPosts({
  communityId,
  userId,
  channelId,
  legacyTicketPanel = false,
  legacyVerificationPanel = false,
  onVerified,
  onTicketCreated,
  onTicketDeleted,
}) {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadPosts = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!communityId || !channelId) {
      setPosts([]);
      return;
    }
    setError("");
    const { data, error: loadError } = await supabase
      .from("community_tool_panel_posts")
      .select("id,tool_type,channel_id,created_at,updated_at")
      .eq("community_id", communityId)
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });
    if (requestId !== requestIdRef.current) return;
    if (loadError) {
      setError(loadError.message || "Could not load published tool panels.");
      return;
    }
    setPosts(data || []);
    setError("");
  }, [communityId, channelId]);

  useEffect(() => {
    if (!channelId) return undefined;
    loadPosts();
    const handlePanelUpdate = (event) => {
      if (event.detail?.communityId === communityId && event.detail?.channelIds?.map(String).includes(String(channelId))) {
        loadPosts();
      }
    };
    window.addEventListener("community:tool-panels-updated", handlePanelUpdate);
    const subscription = supabase
      .channel(`community-tool-panels:${channelId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "community_tool_panel_posts",
        filter: `channel_id=eq.${channelId}`,
      }, loadPosts)
      .subscribe();
    return () => {
      requestIdRef.current += 1;
      window.removeEventListener("community:tool-panels-updated", handlePanelUpdate);
      supabase.removeChannel(subscription);
    };
  }, [channelId, communityId, loadPosts]);

  if (!posts.length && !error) {
    return (
      <>
        {legacyTicketPanel && <TicketToolPanel communityId={communityId} userId={userId} channelId={channelId} onTicketCreated={onTicketCreated} />}
        {legacyVerificationPanel && <VerificationPanel communityId={communityId} userId={userId} channelId={channelId} onVerified={onVerified} />}
      </>
    );
  }

  return (
    <>
      {error && <p className="community-tool-panel-error" role="alert">{error}</p>}
      {posts.map((post) => (
        <section className="community-tool-panel-post" key={`${post.id}:${post.updated_at}`} data-tool-panel-type={post.tool_type}>
          {post.tool_type === "tickets"
            ? <TicketToolPanel communityId={communityId} userId={userId} channelId={channelId} onTicketCreated={onTicketCreated} onTicketDeleted={onTicketDeleted} />
            : <VerificationPanel communityId={communityId} userId={userId} channelId={channelId} panelType={post.tool_type} onVerified={onVerified} />}
        </section>
      ))}
      <style>{`.community-tool-panel-post{width:100%;margin:12px auto}.community-tool-panel-post .community-ticket-tool{margin:0 auto!important}.community-tool-panel-error{margin:12px;color:#ffaaa3;font-size:calc((12px) + 1px);text-align:center}`}</style>
    </>
  );
}
