'use client';

import { useEffect, useRef } from 'react';
import twemoji from '@twemoji/api';

interface TwemojiProps {
  emoji: string;
  className?: string;
}

export default function Twemoji({ emoji, className = '' }: TwemojiProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current) {
      twemoji.parse(spanRef.current, {
        folder: 'svg',
        ext: '.svg',
        base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/',
      });
    }
  }, [emoji]);

  return (
    <span
      ref={spanRef}
      className={`inline-flex items-center ${className}`}
      style={{
        // Twemoji images get this class, set size via CSS
      }}
    >
      <style jsx>{`
        span :global(img.emoji) {
          height: 1.2em;
          width: auto;
          vertical-align: -0.2em;
        }
      `}</style>
      {emoji}
    </span>
  );
}
