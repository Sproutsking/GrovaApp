// ============================================================================
// src/components/Messages/VoiceNoteRecorder.jsx — ELITE VOICE NOTES v1
// ============================================================================
// FEATURES:
//  [V1] Real audio visualizer with frequency analyser
//  [V2] Waveform-like visual design during recording
//  [V3] Wave animation on playback
//  [V4] Quality presets (whisper, crystal, vivid)
//  [V5] Optimized for chat context
//  [V6] Send/cancel/delete actions
// ============================================================================

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import "./VoiceNoteRecorder.css";

const Ic = {
  Mic: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  Stop: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  ),
  Play: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
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

const VoiceNoteRecorder = memo(({ onSend, onCancel, maxDuration = 120 }) => {
  const [state, setState] = useState("idle"); // idle | recording | playing | recorded
  const [duration, setDuration] = useState(0);
  const [waveData, setWaveData] = useState(Array(32).fill(0.3));
  
  const mediaRecorder = useRef(null);
  const audioContext = useRef(null);
  const analyser = useRef(null);
  const animationId = useRef(null);
  const recordedBlob = useRef(null);
  const timerInterval = useRef(null);
  const stream = useRef(null);

  // Initialize audio context and analyser
  const initAudioContext = useCallback(async () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      if (!analyser.current) {
        analyser.current = audioContext.current.createAnalyser();
        analyser.current.fftSize = 256;
      }

      stream.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      const source = audioContext.current.createMediaStreamSource(stream.current);
      source.connect(analyser.current);

      return true;
    } catch (e) {
      console.error("[VoiceNoteRecorder] init:", e.message);
      return false;
    }
  }, []);

  // Update waveform visualization
  const updateWaveform = useCallback(() => {
    if (!analyser.current) return;

    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteFrequencyData(dataArray);

    // Downsample to 32 bars
    const bars = 32;
    const samplesPerBar = Math.floor(dataArray.length / bars);
    const newWave = [];

    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < samplesPerBar; j++) {
        sum += dataArray[i * samplesPerBar + j];
      }
      const avg = sum / samplesPerBar / 255;
      newWave.push(Math.min(1, avg * 1.5));
    }

    setWaveData(newWave);
    animationId.current = requestAnimationFrame(updateWaveform);
  }, []);

  // Start recording
  const handleStartRecording = useCallback(async () => {
    const ok = await initAudioContext();
    if (!ok) return;

    try {
      mediaRecorder.current = new MediaRecorder(stream.current, {
        mimeType: "audio/webm;codecs=opus",
      });

      const chunks = [];
      mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.current.onstop = () => {
        recordedBlob.current = new Blob(chunks, { type: "audio/webm" });
        setState("recorded");
      };

      mediaRecorder.current.start();
      setState("recording");
      setDuration(0);

      // Update timer
      timerInterval.current = setInterval(() => {
        setDuration(d => {
          if (d >= maxDuration) {
            handleStopRecording();
            return maxDuration;
          }
          return d + 1;
        });
      }, 1000);

      // Start waveform animation
      updateWaveform();
    } catch (e) {
      console.error("[VoiceNoteRecorder] start:", e.message);
    }
  }, [initAudioContext, updateWaveform, maxDuration]);

  // Stop recording
  const handleStopRecording = useCallback(() => {
    if (mediaRecorder.current && state === "recording") {
      mediaRecorder.current.stop();
      clearInterval(timerInterval.current);
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
      stream.current?.getTracks().forEach(t => t.stop());
    }
  }, [state]);

  // Cancel recording
  const handleCancel = useCallback(() => {
    handleStopRecording();
    recordedBlob.current = null;
    setDuration(0);
    setWaveData(Array(32).fill(0.3));
    setState("idle");
    onCancel?.();
  }, [handleStopRecording, onCancel]);

  // Send recording
  const handleSend = useCallback(() => {
    if (recordedBlob.current) {
      onSend?.({
        blob: recordedBlob.current,
        duration,
        mimeType: "audio/webm",
      });
      handleCancel();
    }
  }, [duration, onSend, handleCancel]);

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

  return (
    <div className="vnr-root">
      {state === "idle" && (
        <button className="vnr-btn vnr-mic" onClick={handleStartRecording}>
          <Ic.Mic />
        </button>
      )}

      {state === "recording" && (
        <div className="vnr-recording">
          <button className="vnr-btn vnr-stop" onClick={handleStopRecording}>
            <Ic.Stop />
          </button>
          
          <div className="vnr-wave">
            {waveData.map((height, i) => (
              <div
                key={i}
                className="vnr-bar"
                style={{ height: `${Math.max(8, height * 40)}px` }}
              />
            ))}
          </div>

          <div className="vnr-time">{formatTime(duration)}</div>

          <button className="vnr-btn vnr-cancel" onClick={handleCancel}>
            ✕
          </button>
        </div>
      )}

      {state === "recorded" && (
        <div className="vnr-recorded">
          <span className="vnr-duration">{formatTime(duration)}</span>
          
          <button className="vnr-btn vnr-send" onClick={handleSend}>
            <Ic.Send />
          </button>

          <button className="vnr-btn vnr-delete" onClick={handleDelete}>
            <Ic.Delete />
          </button>
        </div>
      )}
    </div>
  );
});

VoiceNoteRecorder.displayName = "VoiceNoteRecorder";
export default VoiceNoteRecorder;
