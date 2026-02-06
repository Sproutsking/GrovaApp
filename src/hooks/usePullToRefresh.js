import { useEffect, useRef, useState } from "react";

export const usePullToRefresh = (onRefresh, enabled = true) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isTouchingRef = useRef(false);
  const canPullRef = useRef(false);

  const PULL_THRESHOLD = 100;
  const MAX_PULL = 140;

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      const scrollTop = container.scrollTop;

      // Only allow pull if at absolute top
      if (scrollTop === 0) {
        canPullRef.current = true;
        startYRef.current = e.touches[0].clientY;
        currentYRef.current = e.touches[0].clientY;
        isTouchingRef.current = true;
      } else {
        canPullRef.current = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!isTouchingRef.current || !canPullRef.current || isRefreshing) return;

      currentYRef.current = e.touches[0].clientY;
      const pullDelta = currentYRef.current - startYRef.current;

      // Only show indicator if pulling down AND still at top
      if (pullDelta > 0 && container.scrollTop === 0) {
        // DO NOT prevent default - let scroll happen naturally
        const resistance = 0.4;
        const distance = Math.min(pullDelta * resistance, MAX_PULL);
        setPullDistance(distance);
        setIsPulling(distance > 10);
      } else {
        // Reset if user scrolls down or pulls up
        setPullDistance(0);
        setIsPulling(false);
        canPullRef.current = false;
      }
    };

    const handleTouchEnd = async () => {
      if (!isTouchingRef.current) return;

      isTouchingRef.current = false;
      const finalDistance = pullDistance;

      if (
        finalDistance >= PULL_THRESHOLD &&
        !isRefreshing &&
        canPullRef.current
      ) {
        setIsRefreshing(true);

        try {
          await Promise.race([
            onRefresh(),
            new Promise((resolve) => setTimeout(resolve, 800)),
          ]);
        } catch (error) {
          console.error("Refresh failed:", error);
        }

        setTimeout(() => {
          setPullDistance(0);
          setIsPulling(false);
          setIsRefreshing(false);
        }, 600);
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }

      canPullRef.current = false;
    };

    // Use passive listeners - never block scroll
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
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
