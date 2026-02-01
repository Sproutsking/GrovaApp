// ============================================================================
// services/transcription/transcriptionService.js
// AssemblyAI integration for voice/video transcription
// ============================================================================

import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({
  apiKey: process.env.REACT_APP_ASSEMBLYAI_API_KEY || "",
});

/**
 * Transcribe audio/video URL
 */
export const getTranscription = async (audioUrl) => {
  if (!audioUrl) {
    throw new Error("No audio URL provided");
  }

  if (!process.env.REACT_APP_ASSEMBLYAI_API_KEY) {
    console.warn("AssemblyAI API key not configured");
    return "(Transcription unavailable - API key not configured)";
  }

  try {
    const transcript = await client.transcripts.transcribe({
      audio: audioUrl,
    });

    if (transcript.status === "error") {
      throw new Error(transcript.error || "Transcription failed");
    }

    return transcript.text || "(No speech detected)";
  } catch (err) {
    console.error("Transcription error:", err);
    return "(Transcription failed)";
  }
};

export default {
  getTranscription,
};
