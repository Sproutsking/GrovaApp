// components/Messages/UserSearchModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { Search, X, Loader, UserPlus, Sparkles } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

const UserSearchModal = ({ currentUser, onClose, onSelect }) => {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const timeout = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timeout.current) clearTimeout(timeout.current);

    if (query.trim().length < 2) {
      setUsers([]);
      return;
    }

    setLoading(true);

    timeout.current = setTimeout(async () => {
      try {
        const term = query.trim().toLowerCase();

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_id, verified")
          .neq("id", currentUser.id)
          .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
          .limit(20);

        if (error) throw error;

        setUsers(data || []);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Search error:", error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [query, currentUser.id]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % users.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
    } else if (e.key === "Enter" && users[selectedIndex]) {
      e.preventDefault();
      onSelect(users[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const getAvatar = (user) => {
    if (!user.avatar_id) return null;
    return mediaUrlService.getImageUrl(user.avatar_id, { width: 100, height: 100 });
  };

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <Sparkles size={20} />
          <div className="search-title">New Message</div>
          <button className="search-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="search-input-wrap">
          <Search size={16} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by name or username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {loading && (
            <div className="search-loading">
              <Loader size={14} className="spinner" />
            </div>
          )}
        </div>

        <div className="search-results">
          {query.trim().length < 2 && (
            <div className="search-empty">
              <Search size={44} />
              <div className="empty-title">Search for users</div>
              <div className="empty-subtitle">Type at least 2 characters</div>
            </div>
          )}

          {query.trim().length >= 2 && !loading && users.length === 0 && (
            <div className="search-empty">
              <UserPlus size={44} />
              <div className="empty-title">No users found</div>
            </div>
          )}

          {users.map((user, idx) => {
            const avatarUrl = getAvatar(user);
            const isSelected = idx === selectedIndex;

            return (
              <div
                key={user.id}
                className={`search-item ${isSelected ? "selected" : ""}`}
                onClick={() => onSelect(user)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="item-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={user.full_name} />
                  ) : (
                    <span>{user.full_name?.charAt(0)?.toUpperCase() || "U"}</span>
                  )}
                </div>

                <div className="item-info">
                  <div className="item-name">{user.full_name}</div>
                  <div className="item-username">@{user.username}</div>
                </div>

                <div className="item-action">
                  <UserPlus size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .search-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(12px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .search-modal { width: 100%; max-width: 520px; max-height: 80vh; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); border: 1px solid rgba(132, 204, 22, 0.3); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; }
        .search-header { display: flex; align-items: center; gap: 10px; padding: 18px 20px; border-bottom: 1px solid rgba(132, 204, 22, 0.15); background: rgba(0, 0, 0, 0.5); color: #84cc16; }
        .search-title { flex: 1; font-size: 18px; font-weight: 800; color: #84cc16; }
        .search-close { width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; color: #666; cursor: pointer; }
        .search-input-wrap { position: relative; padding: 18px 20px; border-bottom: 1px solid rgba(132, 204, 22, 0.1); }
        .search-input-wrap input { width: 100%; padding: 12px 12px 12px 40px; background: rgba(255, 255, 255, 0.05); border: 2px solid rgba(132, 204, 22, 0.2); border-radius: 10px; color: #fff; font-size: 14px; outline: none; }
        .search-input-wrap svg:first-child { position: absolute; left: 32px; top: 50%; transform: translateY(-50%); color: #84cc16; }
        .search-loading { position: absolute; right: 32px; top: 50%; transform: translateY(-50%); }
        .spinner { color: #84cc16; animation: spin 0.7s linear infinite; }
        .search-results { flex: 1; overflow-y: auto; }
        .search-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 30px; text-align: center; color: #666; }
        .empty-title { font-size: 17px; font-weight: 700; color: #fff; margin: 14px 0 6px; }
        .empty-subtitle { font-size: 13px; color: #666; }
        .search-item { display: flex; align-items: center; gap: 12px; padding: 12px 20px; cursor: pointer; border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
        .search-item:hover, .search-item.selected { background: linear-gradient(90deg, rgba(132, 204, 22, 0.08) 0%, transparent 100%); border-left: 3px solid #84cc16; padding-left: 17px; }
        .item-avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; color: #000; overflow: hidden; border: 2px solid rgba(132, 204, 22, 0.3); }
        .item-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .item-info { flex: 1; }
        .item-name { font-size: 14px; font-weight: 700; color: #fff; }
        .item-username { font-size: 12px; color: #666; }
        .item-action { width: 32px; height: 32px; border-radius: 50%; background: rgba(132, 204, 22, 0.15); border: 1px solid rgba(132, 204, 22, 0.3); display: flex; align-items: center; justify-content: center; color: #84cc16; }
      `}</style>
    </div>
  );
};

export default UserSearchModal;