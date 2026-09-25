// ============================================================================
// services/transcription/transcriptionService.js
// AssemblyAI integration for voice/video transcription
// ============================================================================

/**
 * Provider credentials must never be shipped in the browser bundle.
 * Transcription remains unavailable until a server-side function is configured.
 */
export const getTranscription = async (audioUrl) => {
  if (!audioUrl) {
    throw new Error("No audio URL provided");
  }
  return "(Transcription unavailable)";
};

export default {
  getTranscription,
};
