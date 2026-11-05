import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/config/supabase";
import verificationService from "../../../services/community/verificationService";
import TicketToolPanel from "./TicketToolPanel";
import VerificationPanel from "../verification/VerificationPanel";

const MAX_CACHED_CHANNELS = 80;
const postCache = new Map();
const postCacheKey = (communityId, channelId, userId) => JSON.stringify([String(communityId), String(channelId), String(userId || "")]);

export default function CommunityToolPanelPosts({
  communityId,
  userId,
  channelId,
  legacyTicketPanel = false,
  legacyVerificationPanel = false,
  canManage = false,
  onVerified,
  onTicketCreated,
  onTicketDeleted,
}) {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const pendingRequestRef = useRef(null);

  const loadPosts = useCallback(async () => {
    if (!communityId || !channelId) {
      setPosts([]);
      return;
    }
    const key = postCacheKey(communityId, channelId, userId);
    const cached = postCache.get(key);
    if (cached) {
      setPosts(cached.posts);
    }
    if (pendingRequestRef.current?.key === key) {
      return pendingRequestRef.current.promise;
    }

    const requestId = ++requestIdRef.current;
    setError("");
    if (!cached) setLoading(true);
    const promise = (async () => {
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
      const loadedPosts = data || [];
      if (!postCache.has(key) && postCache.size >= MAX_CACHED_CHANNELS) {
        postCache.delete(postCache.keys().next().value);
      }
      postCache.set(key, { posts: loadedPosts });
      setPosts(loadedPosts);
      setError("");
    })();
    const pendingRequest = { key, promise };
    pendingRequestRef.current = pendingRequest;
    try {
      await promise;
    } finally {
      if (pendingRequestRef.current === pendingRequest) {
        pendingRequestRef.current = null;
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }
  }, [communityId, channelId, userId]);

  useEffect(() => {
    if (!channelId) return undefined;
    loadPosts();
    const reloadPosts = () => {
      verificationService.invalidatePanel(communityId, userId);
      return loadPosts();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") reloadPosts();
    };
    const handlePanelUpdate = (event) => {
      if (event.detail?.communityId === communityId && event.detail?.channelIds?.map(String).includes(String(channelId))) {
        reloadPosts();
      }
    };
    window.addEventListener("community:tool-panels-updated", handlePanelUpdate);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const subscription = supabase
      .channel(`community-tool-panels:${channelId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "community_tool_panel_posts",
        filter: `channel_id=eq.${channelId}`,
      }, reloadPosts)
      .subscribe();
    return () => {
      requestIdRef.current += 1;
      window.removeEventListener("community:tool-panels-updated", handlePanelUpdate);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      supabase.removeChannel(subscription);
    };
  }, [channelId, communityId, loadPosts, userId]);

  const needsSetup = legacyTicketPanel || legacyVerificationPanel;

  if (!posts.length && !error) {
    if (loading && needsSetup) {
      return <p className="community-tool-panel-status" role="status">Loading community panel…</p>;
    }
    if (!needsSetup) return null;
    if (!canManage) {
      return <p className="community-tool-panel-status" role="status">No published panel is available here yet. If one was sent, ask a community manager to check its channel access and publication.</p>;
    }
    return (
      <section
        className="community-tool-panel-setup"
        role="status"
        style={{
          display: "grid",
          gap: 5,
          width: "min(calc(100% - 32px), 560px)",
          boxSizing: "border-box",
          margin: "24px auto",
          padding: 16,
          border: "1px solid rgba(156,255,0,.18)",
          borderRadius: 12,
          background: "rgba(156,255,0,.04)",
          color: "#e8f4e3",
          textAlign: "center",
        }}
      >
        <strong>Setup in progress</strong>
        <span style={{ color: "#9da99c", fontSize: 11, lineHeight: 1.5 }}>
          This panel is visible to members after you publish it from Community Tools.
        </span>
      </section>
    );
  }

  return (
    <>
      {error && <p className="community-tool-panel-error" role="alert">{canManage ? error : "Could not refresh this community panel. Check your connection and try again."}</p>}
      {posts.map((post) => (
        <section className="community-tool-panel-post" key={`${post.id}:${post.updated_at}`} data-tool-panel-type={post.tool_type}>
          {post.tool_type === "tickets"
            ? <TicketToolPanel communityId={communityId} userId={userId} channelId={channelId} onTicketCreated={onTicketCreated} onTicketDeleted={onTicketDeleted} />
            : <VerificationPanel communityId={communityId} userId={userId} channelId={channelId} panelType={post.tool_type} published onVerified={onVerified} />}
        </section>
      ))}
      <style>{`.community-tool-panel-post{width:100%;margin:12px auto}.community-tool-panel-post .community-ticket-tool{margin:0 auto!important}.community-tool-panel-error,.community-tool-panel-status{margin:12px auto;width:min(calc(100% - 24px),760px);color:#ffaaa3;font-size:calc((12px) + 1px);line-height:1.5;text-align:center}.community-tool-panel-status{color:#9da99c}`}</style>
    </>
  );
}
