'use client';

import { useState, useRef, useEffect } from 'react';

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
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    // Small delay to prevent flicker on quick mouse movements
    timeoutRef.current = setTimeout(() => {
      setIsHovering(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsHovering(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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

      {/* Preview popup */}
      {isHovering && (
        <div
          className="fixed z-50 pointer-events-none animate-fadeIn"
          style={{
            left: position.x,
            top: position.y,
            maxWidth: previewSize,
          }}
        >
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden">
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
