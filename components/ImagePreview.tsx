'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
  previewSize?: number; // Width in pixels for the preview
  children?: React.ReactNode; // For overlay content like delete buttons
}

export default function ImagePreview({
  src,
  alt,
  className = '',
  previewSize = 500,
  children,
}: ImagePreviewProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate preview dimensions (assuming roughly square aspect ratio, adjust as needed)
    const previewWidth = previewSize;
    const previewHeight = previewSize * 1.2; // Slightly taller for posters

    // Default: position to the right of the thumbnail
    let x = rect.right + 20;
    let y = rect.top;

    // If it would overflow the right edge, position to the left
    if (x + previewWidth > viewportWidth - 20) {
      x = rect.left - previewWidth - 20;
    }

    // If it would overflow the left edge too, center it
    if (x < 20) {
      x = (viewportWidth - previewWidth) / 2;
    }

    // Vertical positioning: try to align with thumbnail, but keep in viewport
    if (y + previewHeight > viewportHeight - 20) {
      y = viewportHeight - previewHeight - 20;
    }
    if (y < 20) {
      y = 20;
    }

    setPosition({ x, y });
  }, [previewSize]);

  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Calculate position immediately
    calculatePosition();

    // Delay showing to prevent flicker on quick mouse movements
    showTimeoutRef.current = setTimeout(() => {
      setIsHovering(true);
      // Small delay before making visible for smooth entry
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }, 150);
  };

  const handleMouseLeave = () => {
    // Clear any pending show timeout
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    // Start fade out immediately
    setIsVisible(false);

    // Delay removing from DOM to allow fade-out animation
    hideTimeoutRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 150); // Match the transition duration
  };

  const handleMouseMove = () => {
    // Only recalculate if already hovering (prevents jank during show delay)
    if (isHovering) {
      calculatePosition();
    }
  };

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <img
        src={src}
        alt={alt}
        className={className}
      />
      {children}

      {/* Preview popup - always rendered when hovering for smooth transitions */}
      {isHovering && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
            opacity: isVisible ? 1 : 0,
            willChange: 'transform, opacity',
            transition: 'opacity 0.15s ease-out, transform 0.1s ease-out',
            maxWidth: previewSize,
            left: 0,
            top: 0,
          }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden"
            style={{
              transform: isVisible ? 'scale(1)' : 'scale(0.97)',
              transition: 'transform 0.15s ease-out',
            }}
          >
            <img
              src={src}
              alt={alt}
              className="w-full h-auto max-h-[80vh] object-contain"
              style={{ maxWidth: previewSize }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
