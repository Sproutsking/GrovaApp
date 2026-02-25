// src/components/SmartTextarea/SmartTextarea.jsx
import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { supabase } from "../../services/config/supabase";
import { useAdaptiveEngine } from "./useAdaptiveEngine";
import { useUndoStack } from "./useUndoStack";
import { diffWords } from "./diffWords";
import "./SmartTextarea.css";

const ACTIONS = [
  {
    id: "grammar",
    label: "Fix Grammar",
    icon: "✦",
    description: "Fix errors",
    color: "#84cc16",
  },
  {
    id: "shorten",
    label: "Shorten",
    icon: "◈",
    description: "Cut the fat",
    color: "#38bdf8",
  },
  {
    id: "enhance",
    label: "Enhance",
    icon: "◆",
    description: "Stronger voice",
    color: "#f59e0b",
  },
];

/**
 * SmartTextarea
 * Drop-in replacement for any textarea in CreateView.
 * Props:
 *   value        — controlled string value
 *   onChange     — standard e.target.value handler (for typing)
 *   onInsert     — called with (newString) when AI replaces content
 *   placeholder  — textarea placeholder
 *   rows         — textarea rows (default 5)
 *   disabled     — disables textarea and buttons
 *   maxWords     — optional word limit with counter
 *   className    — extra class on wrapper
 *   textareaRef  — optional forwarded ref
 */
export default function SmartTextarea({
  value,
  onChange,
  onInsert,
  placeholder,
  rows = 5,
  disabled = false,
  maxWords,
  className = "",
  textareaRef: externalRef,
}) {
  const internalRef = useRef(null);
  const textareaRef = externalRef || internalRef;

  const [status, setStatus] = useState("idle"); // idle | processing | success | error
  const [activeAction, setActiveAction] = useState(null);
  const [diff, setDiff] = useState(null);
  const [showDiff, setShowDiff] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastChanges, setLastChanges] = useState([]);
  const [flashMsg, setFlashMsg] = useState("");

  const { acceptImprovement, rejectImprovement, getHistoryPayload, userStyle } =
    useAdaptiveEngine();

  const { push: pushUndo, pop: popUndo, canUndo } = useUndoStack();

  // ── Derived counts ──────────────────────────────────────────────────────────
  const wordCount = useMemo(() => {
    if (!value?.trim()) return 0;
    return value.trim().split(/\s+/).filter(Boolean).length;
  }, [value]);

  const charCount = value?.length || 0;
  const hasContent = charCount > 3;
  const isOverLimit = maxWords && wordCount > maxWords;

  // ── Cursor helpers ──────────────────────────────────────────────────────────
  const saveCursorPos = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return { start: 0, end: 0 };
    return { start: el.selectionStart, end: el.selectionEnd };
  }, [textareaRef]);

  const restoreCursorPos = useCallback(
    (pos, newValue) => {
      const el = textareaRef.current;
      if (!el) return;
      const newPos = Math.min(pos.start, newValue.length);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(newPos, newPos);
      });
    },
    [textareaRef]
  );

  // ── Flash feedback ──────────────────────────────────────────────────────────
  const flashFeedback = useCallback((msg) => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(""), 2200);
  }, []);

  // ── Main enhance handler ────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (actionId) => {
      if (!hasContent || status === "processing" || disabled) return;

      const cursorPos = saveCursorPos();
      const originalText = value;

      pushUndo(originalText);
      setStatus("processing");
      setActiveAction(actionId);
      setDiff(null);
      setShowDiff(false);
      setErrorMsg("");

      try {
        const { data, error } = await supabase.functions.invoke(
          "enhance-post",
          {
            body: {
              text: originalText,
              action: actionId,
              userStyle,
              acceptedHistory: getHistoryPayload(),
            },
          }
        );

        if (error) throw new Error(error.message);
        if (!data?.result) throw new Error("No result returned");

        const newText = data.result;
        const changes = data.changes || [];

        if (newText === originalText) {
          setStatus("idle");
          setActiveAction(null);
          flashFeedback("✦ Already looking great");
          return;
        }

        // Compute word-level diff for animation overlay
        const wordDiff = diffWords(originalText, newText);
        setDiff(wordDiff);
        setLastChanges(changes);
        setShowDiff(true);
        setStatus("success");

        // After animation, commit new text
        setTimeout(() => {
          if (onInsert) {
            onInsert(newText);
          } else if (onChange) {
            onChange({ target: { value: newText } });
          }
          setShowDiff(false);
          setStatus("idle");
          setActiveAction(null);
          restoreCursorPos(cursorPos, newText);
          acceptImprovement(actionId, changes);
        }, 600);
      } catch (err) {
        console.error("SmartTextarea enhance error:", err);
        setStatus("error");
        setErrorMsg("Couldn't process — try again");
        setActiveAction(null);
        setTimeout(() => {
          setStatus("idle");
          setErrorMsg("");
        }, 2500);
      }
    },
    [
      value,
      hasContent,
      status,
      disabled,
      saveCursorPos,
      pushUndo,
      onInsert,
      onChange,
      restoreCursorPos,
      acceptImprovement,
      getHistoryPayload,
      userStyle,
      flashFeedback,
    ]
  );

  // ── Undo handler ────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const prev = popUndo();
    if (!prev) return;

    if (onInsert) {
      onInsert(prev);
    } else if (onChange) {
      onChange({ target: { value: prev } });
    }

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(prev.length, prev.length);
      }
    });

    // Record rejection so engine learns
    if (lastChanges.length > 0 && activeAction) {
      rejectImprovement(activeAction, lastChanges);
    }
  }, [
    popUndo,
    onInsert,
    onChange,
    textareaRef,
    lastChanges,
    activeAction,
    rejectImprovement,
  ]);

  // ── Keyboard shortcut Cmd/Ctrl+Z ────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && canUndo) {
        e.preventDefault();
        handleUndo();
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [textareaRef, canUndo, handleUndo]);

  const isProcessing = status === "processing";
  const isSuccess = status === "success";

  return (
    <div
      className={[
        "smart-textarea-wrapper",
        isProcessing ? "is-processing" : "",
        isSuccess ? "is-success" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-status={status}
    >
      {/* ── Textarea field ── */}
      <div className="smart-textarea-field-wrap">
        <textarea
          ref={textareaRef}
          className={`smart-textarea-field${isProcessing ? " shimmer-active" : ""}`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled || isProcessing}
          spellCheck={true}
        />

        {/* Word-level diff animation overlay */}
        {showDiff && diff && (
          <div className="smart-diff-overlay" aria-hidden="true">
            {diff.map((part, i) => (
              <span
                key={i}
                className={
                  part.type === "added"
                    ? "diff-added"
                    : part.type === "removed"
                    ? "diff-removed"
                    : "diff-equal"
                }
                style={{ animationDelay: `${i * 18}ms` }}
              >
                {part.value}
              </span>
            ))}
          </div>
        )}

        {/* Shimmer progress bar during processing */}
        {isProcessing && (
          <div className="smart-shimmer-bar" aria-hidden="true">
            <div className="smart-shimmer-fill" />
          </div>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div className={`smart-bottom-bar${hasContent ? " has-content" : ""}`}>
        {/* Left: action buttons */}
        <div className="smart-actions">
          {ACTIONS.map((action) => (
            <SmartActionButton
              key={action.id}
              action={action}
              isActive={activeAction === action.id}
              isProcessing={isProcessing && activeAction === action.id}
              disabled={!hasContent || isProcessing || disabled}
              onClick={() => handleAction(action.id)}
            />
          ))}
        </div>

        {/* Right: meta info */}
        <div className="smart-meta">
          {flashMsg && (
            <span className="smart-flash-msg" key={flashMsg}>
              {flashMsg}
            </span>
          )}

          {status === "error" && (
            <span className="smart-error-msg">{errorMsg}</span>
          )}

          {canUndo && status === "idle" && (
            <button
              className="smart-undo-btn"
              onClick={handleUndo}
              title="Undo last improvement (⌘Z)"
              aria-label="Undo last improvement"
            >
              ↩ Undo
            </button>
          )}

          <span className={`smart-count${isOverLimit ? " over-limit" : ""}`}>
            {maxWords ? (
              <>
                <span className={wordCount > maxWords * 0.9 ? "count-warn" : ""}>
                  {wordCount}
                </span>
                /{maxWords}w
              </>
            ) : (
              <>{charCount}c</>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SmartActionButton({ action, isActive, isProcessing, disabled, onClick }) {
  return (
    <button
      className={[
        "smart-action-btn",
        isActive ? "is-active" : "",
        isProcessing ? "is-loading" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
      title={action.description}
      aria-label={action.label}
      style={{ "--btn-color": action.color }}
    >
      <span className="action-icon" aria-hidden="true">
        {isProcessing ? <SpinnerDots /> : action.icon}
      </span>
      <span className="action-label">{action.label}</span>
    </button>
  );
}

function SpinnerDots() {
  return (
    <span className="spinner-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}