/**
 * Convert a 2-letter country code to Google Noto Emoji URL
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

  return `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/${size}/emoji_u${codePoints.join('_')}.png`;
}

/**
 * Convert an emoji character to Google Noto Emoji URL
 * Works for any emoji, not just flags
 */
export function getEmojiUrl(emoji: string, size: 32 | 72 | 128 | 512 = 72): string {
  if (!emoji) return '';

  const codePoints: string[] = [];

  // Get all code points from the emoji
  for (const char of emoji) {
    const codePoint = char.codePointAt(0);
    if (codePoint) {
      // Skip variation selectors (FE0F) as Noto doesn't include them in filenames
      if (codePoint !== 0xFE0F) {
        codePoints.push(codePoint.toString(16));
      }
    }
  }

  if (codePoints.length === 0) {
    return '';
  }

  return `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/${size}/emoji_u${codePoints.join('_')}.png`;
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
