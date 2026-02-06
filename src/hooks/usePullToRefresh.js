import { useEffect, useRef, useState } from "react";

export const usePullToRefresh = (onRefresh, enabled = true) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;
    let isTouching = false;

    const handleTouchStart = (e) => {
      // Only enable pull-to-refresh when scrolled to top
      if (container.scrollTop > 0) return;

      touchStartY = e.touches[0].clientY;
      startYRef.current = touchStartY;
      isTouching = true;
    };

    const handleTouchMove = (e) => {
      if (!isTouching || isRefreshingRef.current) return;
      if (container.scrollTop > 0) return;

      currentYRef.current = e.touches[0].clientY;
      const pullDelta = currentYRef.current - startYRef.current;

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
      if (!isTouching) return;
      isTouching = false;

      if (pullDistance >= PULL_THRESHOLD && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        setPullDistance(PULL_THRESHOLD);

        try {
          await onRefresh();
        } catch (error) {
          console.error("Refresh failed:", error);
        } finally {
          // Smooth collapse animation
          setTimeout(() => {
            setPullDistance(0);
            setIsPulling(false);
            isRefreshingRef.current = false;
          }, 300);
        }
      } else {
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

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, onRefresh, pullDistance]);

  return {
    containerRef,
    isPulling,
    pullDistance,
    isRefreshing: isRefreshingRef.current,
  };
};
