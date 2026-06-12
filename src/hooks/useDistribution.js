// ============================================================================
// src/hooks/useDistribution.js
// Hook to integrate cross-platform distribution into post creation flow
// ============================================================================

import { useState, useCallback } from "react";
import distributionService from "../services/distribution/distributionService";

/**
 * Hook for managing post distribution across platforms
 * @param {string} userId - Current user's ID
 * @returns {Object} Distribution state and methods
 */
const useDistribution = (userId) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionError, setDistributionError] = useState(null);
  const [distributionStatus, setDistributionStatus] = useState(null);

  /**
   * Start the distribution process for a newly created post
   * @param {string} postId - ID of post to distribute
   * @param {Array<string>} platforms - Platforms to publish to (optional)
   * @returns {Object} Distribution result
   */
  const distributePost = useCallback(
    async (postId, platforms = null) => {
      if (!userId || !postId) {
        throw new Error("User ID and Post ID are required");
      }

      setIsDistributing(true);
      setDistributionError(null);

      try {
        console.log(`📢 Starting distribution for post ${postId}`);

        // Execute distribution
        const result = await distributionService.distributePost(
          postId,
          userId,
          platforms || selectedPlatforms
        );

        // Fetch status
        const status = await distributionService.getDistributionStatus(postId);
        setDistributionStatus(status);

        console.log("✅ Distribution complete:", result);
        return result;
      } catch (error) {
        console.error("❌ Distribution failed:", error);
        setDistributionError(error.message || "Distribution failed");
        throw error;
      } finally {
        setIsDistributing(false);
      }
    },
    [userId, selectedPlatforms]
  );

  /**
   * Retry distribution on a specific platform
   * @param {string} postId - ID of the post
   * @param {string} platform - Platform to retry
   */
  const retryDistribution = useCallback(
    async (postId, platform) => {
      setIsDistributing(true);
      setDistributionError(null);

      try {
        await distributionService.retryFailedDistribution(postId, platform);

        // Refresh status
        const status = await distributionService.getDistributionStatus(postId);
        setDistributionStatus(status);
      } catch (error) {
        console.error("Retry failed:", error);
        setDistributionError(error.message);
        throw error;
      } finally {
        setIsDistributing(false);
      }
    },
    []
  );

  /**
   * Get distribution status for a post
   * @param {string} postId - ID of the post
   */
  const getStatus = useCallback(async (postId) => {
    try {
      const status = await distributionService.getDistributionStatus(postId);
      setDistributionStatus(status);
      return status;
    } catch (error) {
      console.error("Error fetching distribution status:", error);
      throw error;
    }
  }, []);

  /**
   * Update selected platforms
   * @param {Array<string>} platforms - Platforms to publish to
   */
  const setPlatforms = useCallback((platforms) => {
    setSelectedPlatforms(platforms);
  }, []);

  /**
   * Clear distribution state
   */
  const clearState = useCallback(() => {
    setSelectedPlatforms([]);
    setDistributionError(null);
    setDistributionStatus(null);
  }, []);

  return {
    // State
    selectedPlatforms,
    isDistributing,
    distributionError,
    distributionStatus,
    
    // Methods
    distributePost,
    retryDistribution,
    getStatus,
    setPlatforms,
    clearState,
  };
};

export default useDistribution;
