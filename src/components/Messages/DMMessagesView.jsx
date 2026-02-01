import React, { useState, useEffect, useRef } from "react";
import { X, Loader } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import dmMessageService from "../../services/messages/dmMessageService";
import onlineStatusService from "../../services/messages/onlineStatusService";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import UserSearchModal from "./UserSearchModal";

const DMMessagesView = ({
  currentUser,
  onClose,
  initialOtherUserId,
  standalone,
}) => {
  const [view, setView] = useState("list");
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserSearch, setShowUserSearch] = useState(false);

  const realtimeUnsubRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (currentUser?.id) {
      onlineStatusService.start(currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadConversations();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsub = dmMessageService.subscribeToConversations(
      currentUser.id,
      (event) => {
        if (event.type === "NEW_MESSAGE") {
          loadConversations();
        }
      },
    );

    realtimeUnsubRef.current = unsub;
    return () => {
      if (realtimeUnsubRef.current) realtimeUnsubRef.current();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!initialOtherUserId || !currentUser?.id || initializedRef.current)
      return;
    initializedRef.current = true;

    const openDirectChat = async () => {
      try {
        const conv = await dmMessageService.createOrGetConversation(
          currentUser.id,
          initialOtherUserId,
        );

        const otherUser =
          conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
        const enriched = {
          ...conv,
          otherUser,
          lastMessage: null,
          unreadCount: 0,
        };

        setSelectedConversation(enriched);
        setView("chat");
        loadConversations();
      } catch (e) {
        console.error("Failed to open direct chat:", e);
      }
    };

    openDirectChat();
  }, [initialOtherUserId, currentUser?.id]);

  const loadConversations = async () => {
    if (!currentUser?.id) return;
    try {
      setLoading(true);
      const convs = await dmMessageService.getConversations(currentUser.id);
      setConversations(convs);
    } catch (e) {
      console.error("Failed to load conversations:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    setView("chat");
  };

  const handleBackToList = () => {
    setView("list");
    setSelectedConversation(null);
    loadConversations();
  };

  const handleNewChat = () => {
    setShowUserSearch(true);
  };

  const handleSelectUser = async (user) => {
    try {
      const conv = await dmMessageService.createOrGetConversation(
        currentUser.id,
        user.id,
      );

      const otherUser =
        conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
      const enriched = {
        ...conv,
        otherUser,
        lastMessage: null,
        unreadCount: 0,
      };

      setSelectedConversation(enriched);
      setView("chat");
      setShowUserSearch(false);
      loadConversations();
    } catch (e) {
      console.error("Failed to start conversation:", e);
    }
  };

  const isMobile = window.innerWidth <= 768;

  return (
    <>
      <div className="dm-overlay" onClick={onClose}>
        <div
          className={`dm-panel ${standalone ? "standalone" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          {view === "list" && (
            <ConversationList
              conversations={conversations}
              currentUserId={currentUser?.id}
              onSelect={handleSelectConversation}
              onNewChat={handleNewChat}
              onClose={onClose}
              loading={loading}
              activeConversationId={selectedConversation?.id}
            />
          )}

          {view === "chat" && selectedConversation && (
            <ChatView
              conversation={selectedConversation}
              currentUser={currentUser}
              onBack={handleBackToList}
            />
          )}
        </div>
      </div>

      {showUserSearch && (
        <UserSearchModal
          currentUser={currentUser}
          onClose={() => setShowUserSearch(false)}
          onSelect={handleSelectUser}
        />
      )}

      <style>{`
        .dm-overlay {
          position: fixed;
          inset: 0;
          z-index: 9000;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: stretch;
          justify-content: flex-end;
          animation: dmFadeIn 0.2s ease;
        }
        @keyframes dmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .dm-panel {
          position: relative;
          width: 400px;
          max-width: 100%;
          height: 100vh;
          background: #000;
          border-left: 1px solid rgba(132, 204, 22, 0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: dmSlideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes dmSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .dm-panel.standalone {
          z-index: 10000;
        }

        @media (max-width: 768px) {
          .dm-overlay {
            align-items: flex-end;
            justify-content: center;
          }
          .dm-panel {
            width: 100%;
            height: 92vh;
            border-left: none;
            border-top: 1px solid rgba(132, 204, 22, 0.2);
            border-radius: 20px 20px 0 0;
            animation: dmSlideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }
          @keyframes dmSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        }
      `}</style>
    </>
  );
};

export default DMMessagesView;
