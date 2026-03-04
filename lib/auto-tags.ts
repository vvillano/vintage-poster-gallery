/**
 * Auto-tag computation utility
 *
 * Determines which size tags and date tags should be automatically applied
 * to a product based on its dimensions (height/width) and year.
 * Client-safe -- no server imports.
 */

export interface SizeTagRule {
  id: number;
  name: string;
  tagType: string; // 'size_bucket' or 'orientation'
  minValue: number | null;
  maxValue: number | null;
}

export interface DateTagRule {
  id: number;
  name: string;
  startYear: number | null;
  endYear: number | null;
}

/**
 * Compute which size tags apply given height and width (in inches).
 * Size bucket is based on the larger dimension.
 * "Horizontal" applies when width > height.
 */
export function computeSizeTags(
  height: number | null,
  width: number | null,
  rules: SizeTagRule[]
): string[] {
  if (height == null && width == null) return [];

  const tags: string[] = [];
  const h = height ?? 0;
  const w = width ?? 0;
  const maxDimension = Math.max(h, w);

  for (const rule of rules) {
    if (rule.tagType === 'orientation') {
      // Horizontal: width > height (both must be present and positive)
      if (h > 0 && w > 0 && w > h) {
        tags.push(rule.name);
      }
      continue;
    }

    // Size bucket: check if maxDimension falls within [minValue, maxValue]
    if (rule.tagType === 'size_bucket' && maxDimension > 0) {
      const min = rule.minValue ?? 0;
      const max = rule.maxValue ?? Infinity;
      if (maxDimension >= min && maxDimension <= max) {
        tags.push(rule.name);
      }
    }
  }

  return tags;
}

/**
 * Compute which date tag applies given a year.
 * Returns at most one date tag (the matching range).
 */
export function computeDateTags(
  year: number | null,
  rules: DateTagRule[]
): string[] {
  if (year == null) return [];

  for (const rule of rules) {
    const start = rule.startYear ?? -Infinity;
    const end = rule.endYear ?? Infinity;
    if (year >= start && year <= end) {
      return [rule.name];
    }
  }

  return [];
}

/**
 * Parse a year string (from metafield) into a number.
 * Handles formats like "1920", "c. 1920", "1920s", "ca 1925".
 */
export function parseYear(yearStr: string | null | undefined): number | null {
  if (!yearStr) return null;
  // Extract first 4-digit number
  const match = yearStr.match(/\b(\d{4})\b/);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Compute all auto-tags for a product and return them,
 * along with which ones are new (not already in the product's tags).
 */
export function computeAutoTags(
  height: number | null,
  width: number | null,
  year: number | null,
  sizeRules: SizeTagRule[],
  dateRules: DateTagRule[],
  existingTags: string[]
): { allAutoTags: string[]; newAutoTags: string[] } {
  const sizeTags = computeSizeTags(height, width, sizeRules);
  const dateTags = computeDateTags(year, dateRules);
  const allAutoTags = [...sizeTags, ...dateTags];

  const existingLower = new Set(existingTags.map(t => t.toLowerCase()));
  const newAutoTags = allAutoTags.filter(t => !existingLower.has(t.toLowerCase()));

  return { allAutoTags, newAutoTags };
}
