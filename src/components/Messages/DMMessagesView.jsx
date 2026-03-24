// components/Messages/DMMessagesView.jsx — FULL SCREEN FIX
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

    onlineStatusService.start(currentUser.id);

    dmMessageService.init(currentUser.id).then(() => {
      setLoading(false);
    });

    unsubscribeList.current = dmMessageService.subscribeToConversationList();

    return () => {
      if (unsubscribeList.current) unsubscribeList.current();
      dmMessageService.cleanup();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!initialOtherUserId || !currentUser?.id || initialized.current) return;
    initialized.current = true;

    dmMessageService
      .createConversation(currentUser.id, initialOtherUserId)
      .then((conv) => {
        const otherUser = conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
        setSelectedConv({ ...conv, otherUser, lastMessage: null, unreadCount: 0 });
        setView("chat");
      })
      .catch((e) => console.error("❌ [DM] Init chat error:", e));
  }, [initialOtherUserId, currentUser?.id]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleSelect = (conv) => {
    setSelectedConv(conv);
    setView("chat");
  };

  const handleBack = () => {
    setSelectedConv(null);
    setView("list");
  };

  const handleUserSelect = async (user) => {
    try {
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
      <style>{`
        /* ── Full-screen overlay — covers EVERYTHING including header + bottom nav ── */
        .dm-overlay {
          position: fixed;
          inset: 0;                  /* top:0 right:0 bottom:0 left:0 */
          z-index: 9999;             /* above header (z:100) and bottom nav (z:100) */
          background: #000;
          display: flex;
          flex-direction: column;
          /* No backdrop, no partial — this IS the screen */
        }

        /* ── Panel fills the overlay completely ── */
        .dm-panel {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #000;
        }

        /* ── Desktop: side drawer (keep existing behaviour) ── */
        @media (min-width: 769px) {
          .dm-overlay {
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            flex-direction: row;
            align-items: stretch;
            justify-content: flex-end;
          }
          .dm-panel {
            width: 400px;
            height: 100vh;
            border-left: 1px solid rgba(132, 204, 22, 0.2);
            border-radius: 0;
          }
        }
      `}</style>

      <div className="dm-overlay">
        <div className="dm-panel">
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
    </>
  );
};

export default DMMessagesView;