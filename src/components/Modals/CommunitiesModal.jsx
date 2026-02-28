// ============================================================================
// src/components/Modals/CommunitiesModal.jsx
// Shows communities the user has joined or created with ownership indicator
// ============================================================================

import React, { useState, useEffect } from "react";
import { X, Users, Crown, Hash, Globe, Lock, ChevronRight, Search, Plus } from "lucide-react";
import { supabase } from "../../services/config/supabase";

const CommunitiesModal = ({ currentUser, onClose, isMobile }) => {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | owned | joined
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (currentUser?.id) loadCommunities();
  }, [currentUser?.id]);

  const loadCommunities = async () => {
    try {
      setLoading(true);

      // Fetch communities owned by user
      const { data: ownedData } = await supabase
        .from("communities")
        .select("id, name, description, member_count, post_count, avatar_id, banner_id, is_private, created_at, slug")
        .eq("owner_id", currentUser.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Fetch communities user has joined (not owned)
      const { data: memberData } = await supabase
        .from("community_members")
        .select("community_id, joined_at, communities:community_id(id, name, description, member_count, post_count, avatar_id, is_private, created_at, slug, owner_id)")
        .eq("user_id", currentUser.id)
        .neq("communities.owner_id", currentUser.id)
        .order("joined_at", { ascending: false });

      const owned = (ownedData || []).map(c => ({ ...c, role: "owner" }));
      const joined = (memberData || [])
        .map(m => m.communities ? { ...m.communities, role: "member", joined_at: m.joined_at } : null)
        .filter(Boolean);

      setCommunities([...owned, ...joined]);
    } catch (err) {
      console.warn("CommunitiesModal load error:", err?.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = communities.filter(c => {
    const matchesFilter = filter === "all" || c.role === filter || (filter === "owned" && c.role === "owner") || (filter === "joined" && c.role === "member");
    const matchesSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const ownedCount = communities.filter(c => c.role === "owner").length;
  const joinedCount = communities.filter(c => c.role === "member").length;

  return (
    <>
      <style>{`
        .cm-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px); z-index: 9000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: cmFadeIn 0.2s ease;
        }
        @keyframes cmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cmSlideUp { from { opacity: 0; transform: translateY(30px) } to { opacity: 1; transform: translateY(0) } }
        .cm-modal {
          background: #0a0a0a;
          border: 1px solid rgba(132,204,22,0.2);
          border-radius: 24px;
          width: min(560px, 100%);
          max-height: 85vh;
          display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(132,204,22,0.05);
          animation: cmSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .cm-header {
          padding: 24px 24px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .cm-header-top {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .cm-title { font-size: 20px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 10px; }
        .cm-title-icon { width: 36px; height: 36px; background: rgba(132,204,22,0.12); border: 1px solid rgba(132,204,22,0.25); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .cm-close { width: 36px; height: 36px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #a3a3a3; transition: all 0.2s; }
        .cm-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .cm-stats { display: flex; gap: 16px; margin-bottom: 16px; }
        .cm-stat { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #a3a3a3; font-weight: 600; }
        .cm-stat-dot { width: 8px; height: 8px; border-radius: 50%; }
        .cm-filters { display: flex; gap: 6px; padding-bottom: 16px; }
        .cm-filter-btn { padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid; transition: all 0.2s; }
        .cm-filter-btn.active { background: rgba(132,204,22,0.15); border-color: rgba(132,204,22,0.5); color: #84cc16; }
        .cm-filter-btn:not(.active) { background: transparent; border-color: rgba(255,255,255,0.1); color: #737373; }
        .cm-filter-btn:not(.active):hover { border-color: rgba(255,255,255,0.2); color: #a3a3a3; }
        .cm-search { padding: 14px 20px; position: relative; flex-shrink: 0; }
        .cm-search-input { width: 100%; padding: 10px 16px 10px 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-size: 14px; outline: none; box-sizing: border-box; transition: border-color 0.2s; }
        .cm-search-input:focus { border-color: rgba(132,204,22,0.4); }
        .cm-search-input::placeholder { color: #525252; }
        .cm-search-icon { position: absolute; left: 32px; top: 50%; transform: translateY(-50%); color: #525252; pointer-events: none; }
        .cm-list { flex: 1; overflow-y: auto; padding: 0 12px 12px; }
        .cm-list::-webkit-scrollbar { width: 4px; }
        .cm-list::-webkit-scrollbar-track { background: transparent; }
        .cm-list::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.3); border-radius: 2px; }
        .cm-item {
          display: flex; align-items: center; gap: 14px;
          padding: 14px; border-radius: 16px; cursor: pointer;
          transition: all 0.2s; margin-bottom: 6px;
          border: 1px solid transparent;
        }
        .cm-item:hover { background: rgba(255,255,255,0.04); border-color: rgba(132,204,22,0.15); }
        .cm-avatar {
          width: 52px; height: 52px; border-radius: 14px;
          background: linear-gradient(135deg, #1a2e05 0%, #0d1a02 100%);
          border: 1.5px solid rgba(132,204,22,0.2);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-size: 22px; color: #84cc16; font-weight: 800;
          position: relative; overflow: hidden;
        }
        .cm-avatar-badge {
          position: absolute; bottom: -1px; right: -1px;
          width: 18px; height: 18px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid #0a0a0a;
        }
        .cm-info { flex: 1; min-width: 0; }
        .cm-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .cm-name { font-size: 15px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cm-role-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0;
        }
        .cm-role-owner { background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3); color: #fbbf24; }
        .cm-role-member { background: rgba(132,204,22,0.08); border: 1px solid rgba(132,204,22,0.2); color: #84cc16; }
        .cm-meta { display: flex; align-items: center; gap: 12px; }
        .cm-meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #737373; font-weight: 600; }
        .cm-private-badge { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 5px; font-size: 10px; color: #ef4444; font-weight: 700; }
        .cm-chevron { color: #404040; transition: color 0.2s; }
        .cm-item:hover .cm-chevron { color: #84cc16; }
        .cm-empty { padding: 60px 20px; text-align: center; }
        .cm-empty-icon { width: 64px; height: 64px; background: rgba(132,204,22,0.06); border: 1px solid rgba(132,204,22,0.15); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .cm-empty-title { font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 8px 0; }
        .cm-empty-sub { font-size: 13px; color: #525252; margin: 0 0 20px; }
        .cm-empty-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.3); border-radius: 12px; color: #84cc16; font-size: 13px; font-weight: 700; cursor: pointer; }
        .cm-loading { padding: 60px 20px; text-align: center; }
        .cm-spinner { width: 40px; height: 40px; border: 3px solid rgba(132,204,22,0.15); border-top-color: #84cc16; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 16px; }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      <div className="cm-overlay" onClick={onClose}>
        <div className="cm-modal" onClick={e => e.stopPropagation()}>
          <div className="cm-header">
            <div className="cm-header-top">
              <h3 className="cm-title">
                <div className="cm-title-icon"><Users size={18} color="#84cc16" /></div>
                My Communities
              </h3>
              <button className="cm-close" onClick={onClose}><X size={16} /></button>
            </div>
            <div className="cm-stats">
              <div className="cm-stat">
                <div className="cm-stat-dot" style={{ background: "#fbbf24" }} />
                {ownedCount} Owned
              </div>
              <div className="cm-stat">
                <div className="cm-stat-dot" style={{ background: "#84cc16" }} />
                {joinedCount} Joined
              </div>
              <div className="cm-stat">
                <div className="cm-stat-dot" style={{ background: "#525252" }} />
                {communities.length} Total
              </div>
            </div>
            <div className="cm-filters">
              {[["all","All"],["owner","Owned"],["member","Joined"]].map(([val, label]) => (
                <button key={val} className={`cm-filter-btn ${filter === val ? "active" : ""}`} onClick={() => setFilter(val)}>{label}</button>
              ))}
            </div>
          </div>

          <div className="cm-search">
            <Search size={15} className="cm-search-icon" />
            <input className="cm-search-input" placeholder="Search communities..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="cm-list">
            {loading ? (
              <div className="cm-loading">
                <div className="cm-spinner" />
                <p style={{ color: "#737373", fontSize: "14px", margin: 0 }}>Loading communities...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="cm-empty">
                <div className="cm-empty-icon"><Users size={28} color="#84cc16" opacity={0.5} /></div>
                <p className="cm-empty-title">{search ? "No results found" : "No communities yet"}</p>
                <p className="cm-empty-sub">{search ? "Try a different search term" : "Join or create communities to see them here"}</p>
                {!search && (
                  <button className="cm-empty-btn"><Plus size={14} /> Explore Communities</button>
                )}
              </div>
            ) : filtered.map(community => (
              <div key={community.id} className="cm-item">
                <div className="cm-avatar">
                  {community.name?.charAt(0)?.toUpperCase() || "#"}
                  <div className="cm-avatar-badge" style={{ background: community.role === "owner" ? "#fbbf24" : "#84cc16" }}>
                    {community.role === "owner" ? <Crown size={9} color="#000" /> : <Users size={9} color="#000" />}
                  </div>
                </div>
                <div className="cm-info">
                  <div className="cm-name-row">
                    <span className="cm-name">{community.name}</span>
                    <span className={`cm-role-badge ${community.role === "owner" ? "cm-role-owner" : "cm-role-member"}`}>
                      {community.role === "owner" ? <><Crown size={8} /> Owner</> : <><Users size={8} /> Member</>}
                    </span>
                    {community.is_private && (
                      <span className="cm-private-badge"><Lock size={8} /> Private</span>
                    )}
                  </div>
                  <div className="cm-meta">
                    <span className="cm-meta-item"><Users size={11} />{(community.member_count || 0).toLocaleString()} members</span>
                    <span className="cm-meta-item"><Hash size={11} />{(community.post_count || 0).toLocaleString()} posts</span>
                    {!community.is_private && <span className="cm-meta-item"><Globe size={11} />Public</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="cm-chevron" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default CommunitiesModal;