import React, { useState, useRef, useEffect } from "react";
import { Search, X, Loader } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

const UserSearchModal = ({ currentUser, onClose, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(searchTerm);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const searchUsers = async (query) => {
    if (!query?.trim() || !currentUser?.id) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_id, verified")
        .neq("id", currentUser.id)
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (e) {
      console.error("User search failed:", e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const getAvatarUrl = (user) => {
    if (!user) return null;

    if (
      user.avatar &&
      typeof user.avatar === "string" &&
      user.avatar.startsWith("http")
    ) {
      return user.avatar;
    }

    if (user.avatar_id) {
      return mediaUrlService.getAvatarUrl(user.avatar_id, 200);
    }

    return null;
  };

  const getAvatarContent = (user) => {
    if (!user) return "U";

    const avatarUrl = getAvatarUrl(user);

    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={user.full_name || "User"}
          loading="lazy"
          onError={(e) => {
            const parent = e.target.parentElement;
            if (parent) {
              e.target.style.display = "none";
              const span = document.createElement("span");
              span.textContent = (user.full_name || "U")
                .charAt(0)
                .toUpperCase();
              span.className = "avatar-fallback";
              parent.appendChild(span);
            }
          }}
        />
      );
    }

    return (user.full_name || "U").charAt(0).toUpperCase();
  };

  return (
    <div className="user-search-overlay" onClick={onClose}>
      <div className="user-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="user-search-header">
          <h3>New Message</h3>
          <button className="user-search-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="user-search-body">
          <div className="user-search-input-wrapper">
            <Search size={16} color="#666" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by username or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="user-search-input"
            />
            {searching && <Loader size={16} className="user-search-loader" />}
          </div>

          <div className="user-search-results">
            {searchResults.length > 0 ? (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  className="user-result"
                  onClick={() => onSelect(user)}
                >
                  <div className="user-avatar">{getAvatarContent(user)}</div>
                  <div className="user-info">
                    <div className="user-name">
                      {user.full_name || "User"}
                      {user.verified && (
                        <span className="user-verified">✓</span>
                      )}
                    </div>
                    <div className="user-username">
                      @{user.username || "user"}
                    </div>
                  </div>
                </div>
              ))
            ) : searchTerm.trim() && !searching ? (
              <div className="user-no-results">
                <p>No users found</p>
                <span>Try searching with a different name or username</span>
              </div>
            ) : !searchTerm.trim() ? (
              <div className="user-search-hint">
                <p>Search for users to start a conversation</p>
                <span>Type a username or name above</span>
              </div>
            ) : null}
          </div>
        </div>

        <style>{`
          .user-search-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .user-search-modal {
            background: #0a0a0a;
            border: 1px solid rgba(132, 204, 22, 0.3);
            border-radius: 16px;
            width: 90%;
            max-width: 360px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
            animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          @keyframes modalPop {
            from { opacity: 0; transform: scale(0.9) translateY(20px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }

          .user-search-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 20px;
            border-bottom: 1px solid rgba(132, 204, 22, 0.15);
          }

          .user-search-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #fff;
          }

          .user-search-close {
            background: none;
            border: none;
            color: #555;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.15s;
          }
          .user-search-close:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #84cc16;
          }

          .user-search-body {
            padding: 16px 20px 20px;
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .user-search-input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(132, 204, 22, 0.2);
            border-radius: 10px;
            margin-bottom: 16px;
          }

          .user-search-input {
            flex: 1;
            background: transparent;
            border: none;
            color: #fff;
            font-size: 14px;
            outline: none;
          }
          .user-search-input::placeholder { color: #444; }

          .user-search-loader {
            animation: spin 0.6s linear infinite;
            color: #84cc16;
          }
          @keyframes spin { to { transform: rotate(360deg); } }

          .user-search-results {
            flex: 1;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(132, 204, 22, 0.3) transparent;
          }
          .user-search-results::-webkit-scrollbar { width: 4px; }
          .user-search-results::-webkit-scrollbar-thumb {
            background: rgba(132, 204, 22, 0.3);
            border-radius: 2px;
          }

          .user-result {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 10px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .user-result:hover {
            background: rgba(132, 204, 22, 0.08);
            border-color: rgba(132, 204, 22, 0.3);
            transform: translateX(4px);
          }

          .user-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: linear-gradient(135deg, #84cc16, #65a30d);
            border: 2px solid rgba(132, 204, 22, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 800;
            color: #000;
            flex-shrink: 0;
            overflow: hidden;
            position: relative;
          }
          
          .user-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            position: absolute;
            top: 0;
            left: 0;
          }
          
          .avatar-fallback {
            font-size: 18px;
            font-weight: 800;
            color: #000;
          }

          .user-info {
            flex: 1;
            min-width: 0;
          }

          .user-name {
            font-size: 15px;
            font-weight: 700;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .user-verified {
            color: #84cc16;
            font-size: 14px;
          }

          .user-username {
            font-size: 13px;
            color: #666;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .user-no-results,
          .user-search-hint {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            text-align: center;
            gap: 8px;
          }

          .user-no-results p,
          .user-search-hint p {
            font-size: 14px;
            color: #888;
            margin: 0;
          }

          .user-no-results span,
          .user-search-hint span {
            font-size: 12px;
            color: #555;
          }
        `}</style>
      </div>
    </div>
  );
};

export default UserSearchModal;
