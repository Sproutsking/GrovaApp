import { useEffect, useRef, useState } from "react";

export const usePullToRefresh = (onRefresh, enabled = true) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const isTouchingRef = useRef(false);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      // Only enable pull-to-refresh when scrolled to top
      if (container.scrollTop > 5) return;

      startYRef.current = e.touches[0].clientY;
      isTouchingRef.current = true;
    };

    const handleTouchMove = (e) => {
      if (!isTouchingRef.current || isRefreshing) return;
      if (container.scrollTop > 5) return;

      const currentY = e.touches[0].clientY;
      const pullDelta = currentY - startYRef.current;

      if (pullDelta > 0) {
        // Prevent default scroll behavior when pulling down
        e.preventDefault();

        // Apply resistance curve
        const resistance = 0.5;
        const distance = Math.min(pullDelta * resistance, MAX_PULL);

        setPullDistance(distance);
        setIsPulling(true);
      }
    };

    const handleTouchEnd = async () => {
      if (!isTouchingRef.current) return;
      isTouchingRef.current = false;

      if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
        // Start refreshing
        setIsRefreshing(true);
        setPullDistance(PULL_THRESHOLD);

        try {
          // Call refresh function with 1 second max timeout
          await Promise.race([
            onRefresh(),
            new Promise((resolve) => setTimeout(resolve, 1000)),
          ]);
        } catch (error) {
          console.error("Refresh failed:", error);
        }

        // Auto-close after exactly 1 second
        setTimeout(() => {
          setPullDistance(0);
          setIsPulling(false);
          setIsRefreshing(false);
        }, 1000);
      } else {
        // Quick snap back if threshold not met
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, {
      passive: true,
    });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [enabled, onRefresh, pullDistance, isRefreshing]);

  return {
    containerRef,
    isPulling,
    pullDistance,
    isRefreshing,
  };
};
