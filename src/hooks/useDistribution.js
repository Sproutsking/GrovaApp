// src/hooks/useDistribution.js
// ============================================================================
// useDistribution — v2 PRECISE FIX
//
// WHAT WAS BROKEN:
//   The hook called distribution.distributePost(postId) with only one argument.
//   distributionService.distributePost(postId, userId, selectedPlatforms) needs
//   userId as param 2 to know which platforms to target and which tokens to use.
//   Without userId, getPublishTargets() was called with undefined → queries
//   returned nothing → distribution silently did nothing.
//
// FIX:
//   Hook stores userId at construction time. distributePost(postId) now
//   automatically forwards the stored userId to the service. The service
//   also resolves userId from the post row as a secondary fallback.
//
// ALSO ADDED:
//   - clearState() exposed so CreateView.clearForm() can reset between publishes
//   - distributionError exposed so CreateView can surface errors to users
//   - isDistributing flag gates the Publish button during async distribution
// ============================================================================

import { useState, useRef, useCallback } from "react";
import distributionService from "../services/distribution/distributionService";

/**
 * @param {string} userId — the authenticated user's ID
 * @returns distribution helpers for CreateView
 */
const useDistribution = (userId) => {
  const [selectedPlatforms,  setSelectedPlatforms]  = useState([]);
  const [isDistributing,     setIsDistributing]     = useState(false);
  const [distributionStatus, setDistributionStatus] = useState(null);
  const [distributionError,  setDistributionError]  = useState(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId; // keep ref current across renders

  /**
   * Called by PlatformSelector when the user toggles platforms.
   * @param {string[]} platforms
   */
  const setPlatforms = useCallback((platforms) => {
    setSelectedPlatforms(platforms || []);
  }, []);

  /**
   * Distribute a published post to all selected (and connected) platforms.
   * @param {string} postId — the newly-created post ID
   * @returns {Promise<object>} distribution result
   */
  const distributePost = useCallback(async (postId) => {
    if (!postId) return;
    // If no platforms selected yet, skip silently (user didn't opt in)
    if (selectedPlatforms.length === 0) return;

    setIsDistributing(true);
    setDistributionError(null);
    setDistributionStatus(null);

    try {
      // [FIX] Pass userId explicitly — service also resolves from post as fallback
      const result = await distributionService.distributePost(
        postId,
        userIdRef.current || null,
        selectedPlatforms
      );
      setDistributionStatus(result);
      return result;
    } catch (err) {
      const msg = err?.message || "Distribution failed";
      setDistributionError(msg);
      console.error("[useDistribution] distributePost error:", msg);
      // Re-throw so CreateView can catch and alert the user
      throw err;
    } finally {
      setIsDistributing(false);
    }
  }, [selectedPlatforms]);

  /**
   * Reset all distribution state.
   * Called by CreateView.clearForm() between publishes so platforms
   * don't bleed from one content type to the next.
   */
  const clearState = useCallback(() => {
    setSelectedPlatforms([]);
    setIsDistributing(false);
    setDistributionStatus(null);
    setDistributionError(null);
  }, []);

  return {
    selectedPlatforms,
    setPlatforms,
    isDistributing,
    distributionStatus,
    distributionError,
    distributePost,
    clearState,
    // Alias for backwards compat with any code calling distribution.reset()
    reset: clearState,
  };
};

export default useDistribution;