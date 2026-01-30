/**
 * Historical country flags that don't exist in Twemoji
 * Uses Wikimedia Commons SVGs converted to PNG via Wikipedia's thumb service
 */
const HISTORICAL_FLAGS: Record<string, string> = {
  // Yugoslavia (1918-1992)
  'YU': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Flag_of_Yugoslavia_%281946-1992%29.svg/80px-Flag_of_Yugoslavia_%281946-1992%29.svg.png',
  // Czechoslovakia (1918-1992)
  'CS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Flag_of_the_Czech_Republic.svg/80px-Flag_of_the_Czech_Republic.svg.png',
  // Soviet Union (1922-1991)
  'SU': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Flag_of_the_Soviet_Union.svg/80px-Flag_of_the_Soviet_Union.svg.png',
  // East Germany (1949-1990)
  'DD': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Flag_of_East_Germany.svg/80px-Flag_of_East_Germany.svg.png',
  // West Germany (use current German flag)
  'DE': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/80px-Flag_of_Germany.svg.png',
};

/**
 * Convert a 2-letter country code to flag image URL
 *
 * For current countries: Uses Twemoji via jsDelivr
 * For historical countries: Uses Wikimedia Commons
 *
 * Country codes use Regional Indicator Symbols:
 * - Each letter A-Z maps to U+1F1E6 through U+1F1FF
 * - US → 🇺🇸 → U+1F1FA U+1F1F8 → emoji_u1f1fa_1f1f8.png
 */
export function getCountryFlagUrl(countryCode: string, size: 32 | 72 | 128 | 512 = 72): string {
  if (!countryCode || countryCode.length !== 2) {
    return '';
  }

  const code = countryCode.toUpperCase();

  // Check for historical flags first
  if (HISTORICAL_FLAGS[code]) {
    return HISTORICAL_FLAGS[code];
  }

  const codePoints: string[] = [];

  for (const char of code) {
    // Convert A-Z to regional indicator symbols (U+1F1E6 - U+1F1FF)
    const charCode = char.charCodeAt(0);
    if (charCode >= 65 && charCode <= 90) { // A-Z
      const regionalIndicator = 0x1F1E6 + (charCode - 65);
      codePoints.push(regionalIndicator.toString(16));
    }
  }

  if (codePoints.length !== 2) {
    return '';
  }

  // Use Twemoji via jsDelivr (more reliable, has all flags)
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${codePoints.join('-')}.png`;
}

/**
 * Convert an emoji character to Twemoji URL
 * Works for any emoji, not just flags
 */
export function getEmojiUrl(emoji: string, size: 32 | 72 | 128 | 512 = 72): string {
  if (!emoji) return '';

  const codePoints: string[] = [];

  // Get all code points from the emoji
  for (const char of emoji) {
    const codePoint = char.codePointAt(0);
    if (codePoint) {
      // Skip variation selectors (FE0F) as Twemoji doesn't include them in filenames
      if (codePoint !== 0xFE0F) {
        codePoints.push(codePoint.toString(16));
      }
    }
  }

  if (codePoints.length === 0) {
    return '';
  }

  // Use Twemoji via jsDelivr - uses dashes between codepoints
  // Size 72x72 is available, for SVG use /assets/svg/
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${codePoints.join('-')}.png`;
}

/**
 * Common emoji mappings for quick access
 */
export const COMMON_EMOJIS = {
  globe: '🌍',
  pin: '📍',
  checkmark: '✅',
  warning: '⚠️',
  info: 'ℹ️',
  star: '⭐',
} as const;
