// components/Messages/DMMessagesView.jsx - REALTIME-FIRST PERFECTION
import React, { useState, useEffect, useRef } from "react";
import dmMessageService from "../../services/messages/dmMessageService";
import onlineStatusService from "../../services/messages/onlineStatusService";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import UserSearchModal from "./UserSearchModal";

const DMMessagesView = ({ currentUser, onClose, initialOtherUserId }) => {
  const [view, setView] = useState("list");
  const [selectedConv, setSelectedConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);

  const initialized = useRef(false);
  const unsubscribeList = useRef(null);

  useEffect(() => {
    if (!currentUser?.id) return;

    console.log("🚀 [DM] Initializing messaging system");

    onlineStatusService.start(currentUser.id);
    
    dmMessageService.init(currentUser.id).then(() => {
      setLoading(false);
      console.log("✅ [DM] Messaging system initialized");
    });

    // Subscribe to conversation list changes
    unsubscribeList.current = dmMessageService.subscribeToConversationList();

    return () => {
      console.log("🧹 [DM] Cleaning up messaging system");
      if (unsubscribeList.current) {
        unsubscribeList.current();
      }
      dmMessageService.cleanup();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!initialOtherUserId || !currentUser?.id || initialized.current) return;
    initialized.current = true;

    console.log("📨 [DM] Opening initial conversation with:", initialOtherUserId);

    dmMessageService
      .createConversation(currentUser.id, initialOtherUserId)
      .then((conv) => {
        const otherUser = conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
        setSelectedConv({ ...conv, otherUser, lastMessage: null, unreadCount: 0 });
        setView("chat");
      })
      .catch((e) => console.error("❌ [DM] Init chat error:", e));
  }, [initialOtherUserId, currentUser?.id]);

  const handleSelect = (conv) => {
    console.log("📨 [DM] Opening conversation:", conv.id);
    setSelectedConv(conv);
    setView("chat");
  };

  const handleBack = () => {
    console.log("🔙 [DM] Returning to conversation list");
    setSelectedConv(null);
    setView("list");
  };

  const handleUserSelect = async (user) => {
    try {
      console.log("📨 [DM] Creating conversation with:", user.id);
      const conv = await dmMessageService.createConversation(currentUser.id, user.id);
      const otherUser = conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
      setSelectedConv({ ...conv, otherUser, lastMessage: null, unreadCount: 0 });
      setView("chat");
      setShowSearch(false);
    } catch (e) {
      console.error("❌ [DM] User select error:", e);
    }
  };

  return (
    <>
      <div className="dm-overlay" onClick={onClose}>
        <div className="dm-panel" onClick={(e) => e.stopPropagation()}>
          {view === "list" && (
            <ConversationList
              currentUserId={currentUser?.id}
              onSelect={handleSelect}
              onNewChat={() => setShowSearch(true)}
              onClose={onClose}
              loading={loading}
              activeConversationId={selectedConv?.id}
            />
          )}

          {view === "chat" && selectedConv && (
            <ChatView
              conversation={selectedConv}
              currentUser={currentUser}
              onBack={handleBack}
            />
          )}
        </div>
      </div>

      {showSearch && (
        <UserSearchModal
          currentUser={currentUser}
          onClose={() => setShowSearch(false)}
          onSelect={handleUserSelect}
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
        }
        .dm-panel {
          width: 400px;
          max-width: 100%;
          height: 100vh;
          background: #000;
          border-left: 1px solid rgba(132, 204, 22, 0.2);
          display: flex;
          flex-direction: column;
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
          }
        }
      `}</style>
    </>
  );
};

export default DMMessagesView;