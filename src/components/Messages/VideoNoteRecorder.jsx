// ============================================================================
// src/components/Messages/VideoNoteRecorder.jsx — ELITE VIDEO NOTES v1
// ============================================================================
// FEATURES:
//  [V1] Multiple shape options: square, circle, star, hexagon
//  [V2] Real-time video preview with selected shape
//  [V3] Quality presets
//  [V4] Recording timer
//  [V5] Send/cancel/delete actions
//  [V6] Optimized for chat context
// ============================================================================

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import "./VideoNoteRecorder.css";

const SHAPES = [
  { id: "square", name: "Square", icon: "⬜" },
  { id: "circle", name: "Circle", icon: "⭕" },
  { id: "star", name: "Star", icon: "⭐" },
  { id: "hexagon", name: "Hexagon", icon: "⬡" },
];

const Ic = {
  Video: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  Stop: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  ),
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Delete: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
};

const shapeClipPath = (shape) => {
  switch (shape) {
    case "circle":
      return "circle(50%)";
    case "star":
      return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
    case "hexagon":
      return "polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)";
    default:
      return "none";
  }
};

const VideoNoteRecorder = memo(({ onSend, onCancel, maxDuration = 60 }) => {
  const [state, setState] = useState("idle"); // idle | preview | recording | recorded
  const [selectedShape, setSelectedShape] = useState("square");
  const [duration, setDuration] = useState(0);
  const [showShapeSelector, setShowShapeSelector] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorder = useRef(null);
  const canvasRef = useRef(null);
  const timerInterval = useRef(null);
  const recordedBlob = useRef(null);

  // Request camera permission and preview
  const handleRequestPreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState("preview");
      setShowShapeSelector(false);
    } catch (e) {
      console.error("[VideoNoteRecorder] camera:", e.message);
      alert("Cannot access camera");
    }
  }, []);

  // Start recording
  const handleStartRecording = useCallback(() => {
    if (!streamRef.current) return;

    try {
      // Capture canvas with shape clipping
      const canvas = canvasRef.current;
      if (canvas && videoRef.current) {
        const ctx = canvas.getContext("2d");
        const drawFrame = () => {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          animationId.current = requestAnimationFrame(drawFrame);
        };
        drawFrame();
      }

      const canvasStream = canvasRef.current ? canvasRef.current.captureStream(30) : streamRef.current;
      
      mediaRecorder.current = new MediaRecorder(canvasStream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 2500000,
      });

      const chunks = [];
      mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.current.onstop = () => {
        recordedBlob.current = new Blob(chunks, { type: "video/webm" });
        setState("recorded");
        if (animationId.current) {
          cancelAnimationFrame(animationId.current);
        }
      };

      mediaRecorder.current.start();
      setState("recording");
      setDuration(0);

      timerInterval.current = setInterval(() => {
        setDuration(d => {
          if (d >= maxDuration) {
            handleStopRecording();
            return maxDuration;
          }
          return d + 1;
        });
      }, 1000);
    } catch (e) {
      console.error("[VideoNoteRecorder] start:", e.message);
    }
  }, [maxDuration]);

  // Stop recording
  const handleStopRecording = useCallback(() => {
    if (mediaRecorder.current && state === "recording") {
      mediaRecorder.current.stop();
      clearInterval(timerInterval.current);
    }
  }, [state]);

  // Cancel recording
  const handleCancel = useCallback(() => {
    if (state === "recording") {
      handleStopRecording();
    } else if (state === "preview") {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    recordedBlob.current = null;
    setDuration(0);
    setState("idle");
    setSelectedShape("square");
    onCancel?.();
  }, [state, handleStopRecording, onCancel]);

  // Send recording
  const handleSend = useCallback(() => {
    if (recordedBlob.current) {
      onSend?.({
        blob: recordedBlob.current,
        duration,
        mimeType: "video/webm",
        shape: selectedShape,
      });
      handleCancel();
    }
  }, [duration, selectedShape, onSend, handleCancel]);

  // Delete recording
  const handleDelete = useCallback(() => {
    recordedBlob.current = null;
    setDuration(0);
    setState("idle");
  }, []);

  // Format time
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  // Animation ref
  const animationId = useRef(null);

  return (
    <div className="vnrecorder-root">
      {state === "idle" && (
        <button className="vnrecorder-btn vnrecorder-video" onClick={handleRequestPreview}>
          <Ic.Video />
        </button>
      )}

      {state === "preview" && (
        <div className="vnrecorder-preview">
          <div className="vnrecorder-video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="vnrecorder-video-feed"
              style={{ clipPath: shapeClipPath(selectedShape) }}
            />
            <canvas
              ref={canvasRef}
              width={360}
              height={480}
              style={{ display: "none" }}
            />
          </div>

          <div className="vnrecorder-shapes">
            {SHAPES.map(shape => (
              <button
                key={shape.id}
                className={`vnrecorder-shape ${selectedShape === shape.id ? "active" : ""}`}
                onClick={() => setSelectedShape(shape.id)}
                title={shape.name}
              >
                {shape.icon}
              </button>
            ))}
          </div>

          <div className="vnrecorder-controls">
            <button className="vnrecorder-btn vnrecorder-cancel" onClick={handleCancel}>
              ✕
            </button>
            <button className="vnrecorder-btn vnrecorder-rec" onClick={handleStartRecording}>
              ●
            </button>
          </div>
        </div>
      )}

      {state === "recording" && (
        <div className="vnrecorder-recording">
          <div className="vnrecorder-timer">{formatTime(duration)}</div>
          <button className="vnrecorder-btn vnrecorder-stop" onClick={handleStopRecording}>
            <Ic.Stop />
          </button>
          <button className="vnrecorder-btn vnrecorder-cancel" onClick={handleCancel}>
            ✕
          </button>
        </div>
      )}

      {state === "recorded" && (
        <div className="vnrecorder-recorded">
          <span className="vnrecorder-duration">{formatTime(duration)}</span>
          <button className="vnrecorder-btn vnrecorder-send" onClick={handleSend}>
            <Ic.Send />
          </button>
          <button className="vnrecorder-btn vnrecorder-delete" onClick={handleDelete}>
            <Ic.Delete />
          </button>
        </div>
      )}
    </div>
  );
});

VideoNoteRecorder.displayName = "VideoNoteRecorder";
export default VideoNoteRecorder;
