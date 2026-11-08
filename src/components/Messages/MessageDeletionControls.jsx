import React from "react";
import { Check, Clock3, Trash2, X } from "lucide-react";
import messageDeletionService from "../../services/messages/messageDeletionService";

const authorIdOf = (message) => message?.user_id || message?.sender_id;

const MessageDeletionControls = ({
  kind,
  conversationId,
  userId,
  selectionMode,
  selectedMessages,
  onCancelSelection,
  onMessagesRemoved,
}) => {
  const [requests, setRequests] = React.useState([]);
  const [showChoices, setShowChoices] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loadError, setLoadError] = React.useState("");
  const active = React.useRef(true);

  React.useEffect(() => {
    active.current = true;
    const loadRequests = async () => {
      try {
        const pending = await messageDeletionService.getPendingRequests(kind, conversationId);
        if (active.current) {
          setRequests(pending);
          setLoadError("");
        }
      } catch (loadFailure) {
        if (active.current) setLoadError(loadFailure.message || "Could not load delete requests.");
      }
    };

    const channel = messageDeletionService.subscribeToRequests(userId, loadRequests);
    loadRequests();
    return () => {
      active.current = false;
      messageDeletionService.removeSubscription(channel);
    };
  }, [kind, conversationId, userId]);

  const allMessagesAreMine = selectedMessages.length > 0
    && selectedMessages.every((message) => String(authorIdOf(message)) === String(userId));

  const submitDeletion = async (action) => {
    if (!selectedMessages.length || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await messageDeletionService.submit(
        kind,
        conversationId,
        selectedMessages.map((message) => message.id),
        action,
      );
      const removedIds = action === "for_me"
        ? selectedMessages.map((message) => String(message.id))
        : result.deletedIds;
      onMessagesRemoved?.(removedIds);
      setShowChoices(false);
      onCancelSelection?.();
    } catch (failure) {
      setError(failure.message || "Could not complete the message deletion.");
    } finally {
      setSubmitting(false);
    }
  };

  const respondToRequest = async (batchId, accept) => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const removedIds = await messageDeletionService.respond(batchId, accept);
      setRequests((current) => current.filter((request) => request.batch_id !== batchId));
      onMessagesRemoved?.(removedIds);
    } catch (failure) {
      setError(failure.message || "Could not respond to the delete request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="message-deletion-controls">
      {loadError && <div className="message-delete-error" role="alert">{loadError}</div>}
      {error && <div className="message-delete-error" role="alert">{error}</div>}

      {requests.map((request) => (
        <section className="message-delete-request" key={request.batch_id} aria-label="Message deletion request">
          <div className="message-delete-request-copy">
            <Clock3 size={16} aria-hidden="true" />
            <span><strong>{request.requester_name}</strong> requests deletion of {request.message_count} {Number(request.message_count) === 1 ? "message" : "messages"}.</span>
          </div>
          <div className="message-delete-request-actions">
            <button type="button" className="decline" disabled={submitting} onClick={() => respondToRequest(request.batch_id, false)}>Decline</button>
            <button type="button" className="accept" disabled={submitting} onClick={() => respondToRequest(request.batch_id, true)}><Check size={14} /> Accept</button>
          </div>
        </section>
      ))}

      {selectionMode && (
        <div className="message-selection-bar">
          <button type="button" className="message-selection-close" onClick={onCancelSelection} aria-label="Cancel message selection"><X size={19} /></button>
          <strong>{selectedMessages.length} selected</strong>
          <button
            type="button"
            className="message-selection-delete"
            onClick={() => setShowChoices(true)}
            disabled={!selectedMessages.length}
            aria-label="Delete selected messages"
          >
            <Trash2 size={19} />
          </button>
        </div>
      )}

      {showChoices && (
        <div className="message-delete-choice-backdrop" onClick={() => !submitting && setShowChoices(false)}>
          <section
            className="message-delete-choice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-delete-choice-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="message-delete-choice-icon"><Trash2 size={18} /></div>
            <h2 id="message-delete-choice-title">Delete {selectedMessages.length} {selectedMessages.length === 1 ? "message" : "messages"}?</h2>
            <p>{allMessagesAreMine
              ? "Choose whether to remove these messages from everyone or only from your chat."
              : "Messages written by other members need their author’s approval before they can be removed for everyone."}</p>
            <div className="message-delete-choice-actions">
              {allMessagesAreMine && (
                <button type="button" className="everyone" disabled={submitting} onClick={() => submitDeletion("everyone")}>Delete for everyone</button>
              )}
              <button type="button" className="for-me" disabled={submitting} onClick={() => submitDeletion("for_me")}>Delete for me</button>
              {!allMessagesAreMine && (
                <button type="button" className="request" disabled={submitting} onClick={() => submitDeletion("request")}>Request to delete</button>
              )}
              <button type="button" className="cancel" disabled={submitting} onClick={() => setShowChoices(false)}>Cancel</button>
            </div>
          </section>
        </div>
      )}

      <style>{`
        .message-deletion-controls { position:relative; z-index:12; width:100%; }
        .message-delete-error { margin:6px 12px; padding:8px 10px; border:1px solid rgba(248,113,113,.3); border-radius:9px; background:rgba(127,29,29,.18); color:#fecaca; font-size:12px; }
        .message-delete-request { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:6px 10px; padding:10px 12px; border:1px solid rgba(156,255,0,.2); border-radius:14px; background:linear-gradient(120deg,rgba(17,29,19,.98),rgba(12,17,14,.98)); box-shadow:0 6px 18px rgba(0,0,0,.22); }
        .message-delete-request-copy { display:flex; align-items:center; gap:8px; min-width:0; color:#d5e0d4; font-size:12px; line-height:1.35; }
        .message-delete-request-copy svg { flex:0 0 auto; color:#a3d977; }
        .message-delete-request-copy strong { color:#f1f8ed; }
        .message-delete-request-actions { display:flex; flex:0 0 auto; gap:6px; }
        .message-delete-request-actions button,.message-selection-bar button { display:inline-flex; align-items:center; justify-content:center; gap:5px; border:1px solid transparent; border-radius:9px; cursor:pointer; font:600 12px inherit; }
        .message-delete-request-actions button { min-height:32px; padding:0 10px; }
        .message-delete-request-actions .decline { border-color:rgba(248,113,113,.22); background:rgba(127,29,29,.2); color:#fca5a5; }
        .message-delete-request-actions .accept { background:rgba(132,204,22,.15); color:#c8f49f; }
        .message-delete-request-actions button:disabled,.message-selection-bar button:disabled { cursor:wait; opacity:.55; }
        .message-selection-bar { display:flex; align-items:center; gap:13px; min-height:52px; padding:0 16px; border-top:1px solid rgba(255,255,255,.07); background:rgba(17,20,18,.98); color:#e7eee6; }
        .message-selection-bar strong { flex:1; font-size:13px; }
        .message-selection-close,.message-selection-delete { width:34px; height:34px; background:transparent; color:#c6d0c7; }
        .message-selection-delete { color:#fca5a5; }
        .message-selection-delete:hover:not(:disabled) { background:rgba(248,113,113,.12); }
        .message-delete-choice-backdrop { position:fixed; inset:0; z-index:100300; display:grid; place-items:center; padding:18px; background:rgba(0,0,0,.66); }
        .message-delete-choice { width:min(360px,100%); padding:20px; border:1px solid rgba(156,255,0,.2); border-radius:18px; background:linear-gradient(145deg,#171b18,#0c0f0d); box-shadow:0 22px 70px rgba(0,0,0,.65); color:#eef3ed; text-align:center; }
        .message-delete-choice-icon { display:grid; place-items:center; width:38px; height:38px; margin:0 auto 10px; border:1px solid rgba(248,113,113,.2); border-radius:12px; background:rgba(127,29,29,.2); color:#f87171; }
        .message-delete-choice h2 { margin:0; font-size:16px; }
        .message-delete-choice p { margin:8px 0 16px; color:#aab5aa; font-size:12px; line-height:1.5; }
        .message-delete-choice-actions { display:grid; gap:7px; }
        .message-delete-choice-actions button { min-height:38px; border:1px solid rgba(255,255,255,.1); border-radius:10px; background:rgba(255,255,255,.04); color:#e4e9e3; font:700 12px inherit; cursor:pointer; }
        .message-delete-choice-actions .everyone,.message-delete-choice-actions .request { border-color:rgba(248,113,113,.25); background:rgba(127,29,29,.2); color:#fca5a5; }
        .message-delete-choice-actions .for-me { border-color:rgba(132,204,22,.2); background:rgba(132,204,22,.11); color:#bef264; }
        .message-delete-choice-actions button:hover:not(:disabled) { filter:brightness(1.12); }
        .message-delete-choice-actions button:disabled { cursor:wait; opacity:.6; }
        @media(max-width:520px) { .message-delete-request { align-items:flex-start; flex-direction:column; } .message-delete-request-actions { align-self:flex-end; } }
      `}</style>
    </div>
  );
};

export default MessageDeletionControls;
