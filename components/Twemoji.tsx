'use client';

import { getEmojiUrl, getCountryFlagUrl } from '@/lib/emoji';

interface EmojiProps {
  emoji: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface CountryFlagProps {
  countryCode: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { px: 72, class: 'h-4' },
  md: { px: 72, class: 'h-5' },
  lg: { px: 128, class: 'h-6' },
} as const;

/**
 * Renders any emoji using Google Noto Color Emoji
 */
export default function Emoji({ emoji, size = 'md', className = '' }: EmojiProps) {
  const { px, class: sizeClass } = SIZE_MAP[size];
  const url = getEmojiUrl(emoji, px as 32 | 72 | 128 | 512);

  if (!url) {
    return <span className={className}>{emoji}</span>;
  }

  return (
    <img
      src={url}
      alt={emoji}
      className={`${sizeClass} w-auto inline-block ${className}`}
      loading="lazy"
    />
  );
}

/**
 * Renders a country flag using Google Noto Color Emoji
 * Takes a 2-letter ISO country code (e.g., "US", "FR", "AT")
 */
export function CountryFlag({ countryCode, size = 'md', className = '' }: CountryFlagProps) {
  const { px, class: sizeClass } = SIZE_MAP[size];
  const url = getCountryFlagUrl(countryCode, px as 32 | 72 | 128 | 512);

  if (!url) {
    return <span className={className}>{countryCode}</span>;
  }

  return (
    <img
      src={url}
      alt={`${countryCode} flag`}
      className={`${sizeClass} w-auto inline-block ${className}`}
      loading="lazy"
    />
  );
}

// Re-export as Twemoji for backwards compatibility
export { Emoji as Twemoji };
