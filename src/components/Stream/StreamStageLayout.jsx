// ============================================================================
// src/components/Stream/StreamStageLayout.jsx — ELITE STAGE LAYOUTS v1
// ============================================================================
// FEATURES:
//  [S1] Intelligent grid layouts based on participant count
//  [S2] Optimal spacing for 2, 3, 4, 5, 6, 7, 8+ participants
//  [S3] Host always prominent
//  [S4] Beautiful animations and transitions
//  [S5] Responsive design
//  [S6] Speaker indicator
// ============================================================================

import React, { useState, useEffect, useMemo, memo } from "react";
import "./StreamStageLayout.css";

/**
 * Calculate optimal grid layout based on participant count
 * Examples:
 *  1: 1x1
 *  2: 1x2
 *  3: 1x3
 *  4: 2x2
 *  5: 2L-3R (2 left, 3 right)
 *  6: 2x3 or 3x2
 *  7: 2x3 + 1
 *  8+: 2x4 or 3x3
 */
const calculateLayout = (count) => {
  if (count <= 1) return { cols: 1, rows: 1, layout: "grid-1" };
  if (count === 2) return { cols: 2, rows: 1, layout: "grid-2h" };
  if (count === 3) return { cols: 3, rows: 1, layout: "grid-3h" };
  if (count === 4) return { cols: 2, rows: 2, layout: "grid-4" };
  if (count === 5) return { cols: 3, rows: 2, layout: "grid-5-asym" };
  if (count === 6) return { cols: 3, rows: 2, layout: "grid-6" };
  if (count === 7) return { cols: 3, rows: 3, layout: "grid-7" };
  if (count <= 9) return { cols: 3, rows: 3, layout: "grid-9" };
  return { cols: 4, rows: 3, layout: "grid-12" };
};

/**
 * Participant Video Tile
 */
const VideoTile = memo(({
  participant,
  isHost,
  isSpeaking,
  index,
  onLongPress,
}) => {
  const handleContextMenu = (e) => {
    e.preventDefault();
    onLongPress?.(participant);
  };

  return (
    <div
      className={`ssl-tile${isHost ? " ssl-host" : ""}${isSpeaking ? " ssl-speaking" : ""}`}
      onContextMenu={handleContextMenu}
      onLongPress={handleContextMenu}
    >
      {/* Video or Avatar */}
      {participant.videoEnabled ? (
        <video
          autoPlay
          playsInline
          muted={participant.isSelf}
          className="ssl-video"
          style={{ transform: participant.isSelf ? "scaleX(-1)" : "none" }}
        />
      ) : (
        <div className="ssl-avatar-bg">
          <img
            src={participant.avatarUrl}
            alt={participant.name}
            className="ssl-avatar"
          />
        </div>
      )}

      {/* Overlay */}
      <div className="ssl-overlay">
        {/* Status badges */}
        <div className="ssl-badges">
          {isHost && <span className="ssl-badge ssl-host-badge">Host</span>}
          {!participant.audioEnabled && <span className="ssl-badge ssl-muted-badge">🔇</span>}
          {!participant.videoEnabled && <span className="ssl-badge ssl-nocam-badge">📵</span>}
        </div>

        {/* Name and speaking indicator */}
        <div className="ssl-info">
          <span className="ssl-name">{participant.name}</span>
          {isSpeaking && <div className="ssl-speaking-indicator"/>}
        </div>
      </div>

      {/* Speaking ring */}
      {isSpeaking && <div className="ssl-ring"/>}
    </div>
  );
});

VideoTile.displayName = "VideoTile";

/**
 * Main Stage Layout Component
 */
const StreamStageLayout = memo(({
  participants = [],
  hostId = null,
  speakingIds = new Set(),
  onParticipantAction = null,
  maxVisible = 12,
}) => {
  const [scrolled, setScrolled] = useState(false);

  // Arrange participants: host first, then others
  const arrangedParticipants = useMemo(() => {
    const host = participants.find(p => p.id === hostId);
    const others = participants.filter(p => p.id !== hostId);

    const arranged = [];
    if (host) arranged.push(host);
    arranged.push(...others);

    return arranged.slice(0, maxVisible);
  }, [participants, hostId, maxVisible]);

  const { cols, rows, layout } = calculateLayout(arrangedParticipants.length);

  return (
    <div className={`ssl-root ssl-${layout}`}>
      <div className="ssl-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {arrangedParticipants.map((participant, index) => (
          <VideoTile
            key={participant.id}
            participant={participant}
            isHost={participant.id === hostId}
            isSpeaking={speakingIds.has(participant.id)}
            index={index}
            onLongPress={onParticipantAction}
          />
        ))}
      </div>

      {/* Overflow indicator */}
      {participants.length > maxVisible && (
        <div className="ssl-overflow">
          +{participants.length - maxVisible} more
        </div>
      )}
    </div>
  );
});

StreamStageLayout.displayName = "StreamStageLayout";
export default StreamStageLayout;
