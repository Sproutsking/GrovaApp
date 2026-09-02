// src/components/Shared/OptimizedImage.jsx
// Optimized image rendering component with loading states, error handling, and lazy loading
// Used throughout the app for cards, DM messages, and other image rendering

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import mediaUrlService from '../../services/shared/mediaUrlService';

/**
 * OptimizedImage — Universal image component with:
 * - INSTANT display on cache hits (SmartImage pattern)
 * - Dark skeleton during loads
 * - Proper error handling with fallbacks
 * - Lazy loading support
 * - Responsive sizing
 * - Mobile-optimized quality
 */
const OptimizedImage = ({
  src,
  alt = '',
  className = '',
  style = {},
  width = 400,
  height = 400,
  objectFit = 'cover',
  fetchPriority = 'auto',
  loading = 'lazy',
  onLoad,
  onError,
  fallbackSrc,
  enableOptimization = true,
  maxWidth = 1200,
  quality = 'auto:best',
}) => {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const imgRef = useRef(null);
  const [candidates, setCandidates] = useState([]);

  // Normalize width for mobile
  const normalizedWidth = Math.min(maxWidth, width);

  // Build candidate URLs
  useEffect(() => {
    if (!src) return;

    const urls = [];

    // Try to optimize the URL if it's a direct HTTP URL
    if (enableOptimization && mediaUrlService.isValidUrl(src)) {
      try {
        const optimized = mediaUrlService.getOptimizedImageUrl(src, {
          width: normalizedWidth,
          height,
          quality,
          format: 'webp',
          crop: 'fill',
          gravity: 'auto',
        });
        if (optimized) urls.push(optimized);
      } catch {}
    }

    // Add original source
    if (src) urls.push(src);

    // Add fallback
    if (fallbackSrc) urls.push(fallbackSrc);

    // Add generic fallback image
    urls.push('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23222"/%3E%3Ccircle cx="200" cy="200" r="60" fill="%23444"/%3E%3C/svg%3E');

    setCandidates([...new Set(urls)]);
    setIdx(0);
    setFailed(false);
    setRevealed(false);
  }, [src, normalizedWidth, height, quality, enableOptimization, fallbackSrc]);

  // CACHE HIT — detect synchronously after mount
  useLayoutEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setRevealed(true);
      setIsLoading(false);
    }
  }, [idx]);

  // Preload image if high priority
  useEffect(() => {
    if (fetchPriority === 'high' && candidates[idx]) {
      mediaUrlService.preloadMediaUrl(candidates[idx], { 
        type: 'image', 
        priority: 'high' 
      });
    }
  }, [idx, candidates, fetchPriority]);

  const handleLoad = () => {
    setRevealed(true);
    onLoad?.();
  };

  const handleError = () => {
    if (idx < candidates.length - 1) {
      setIdx(i => i + 1);
    } else {
      setFailed(true);
    }
    onError?.();
  };

  if (!candidates.length || failed) {
    return (
      <div
        className={`oi-error ${className}`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          ...style,
        }}
        title="Failed to load image"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.35"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }

  return (
    <div className="oi-container" style={{ position: 'relative', ...style }}>
      {/* Skeleton loader during cache miss */}
      {!revealed && (
        <div
          className="oi-skeleton"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#222',
            backgroundImage:
              'linear-gradient(90deg, #222 0%, #333 50%, #222 100%)',
            backgroundSize: '200% 100%',
            animation: 'oi-shimmer 1.5s infinite',
            borderRadius: '8px',
            zIndex: 1,
          }}
          aria-hidden="true"
        />
      )}

      <img
        ref={imgRef}
        src={candidates[idx]}
        alt={alt}
        className={`oi-img ${className}`.trim()}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          display: 'block',
          opacity: revealed ? 1 : 0,
          transition: revealed ? 'none' : 'opacity 0.16s ease',
          borderRadius: style.borderRadius || '8px',
          ...style,
        }}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        crossOrigin="anonymous"
        onLoad={handleLoad}
        onError={handleError}
      />

      <style>{`
        @keyframes oi-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .oi-container {
          position: relative;
          overflow: hidden;
        }
        
        .oi-skeleton {
          animation: oi-shimmer 1.5s infinite;
        }
        
        .oi-error {
          background-color: #1a1a1a;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default OptimizedImage;
