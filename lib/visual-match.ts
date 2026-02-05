import Anthropic from '@anthropic-ai/sdk';

export interface VisualMatchResult {
  visualMatch: number;      // 0-100, how similar are the images?
  sameImage: boolean;       // High confidence this is the same poster
  sameArtist: boolean;      // Appears to be same artist/style (different work)
  explanation: string;      // Brief explanation for debugging
}

/**
 * Compare two images to determine if they show the same poster.
 * Uses Claude Vision (Sonnet for cost efficiency).
 *
 * @param posterImageUrl - URL of the user's poster image
 * @param resultThumbnailUrl - URL of the search result thumbnail
 * @returns Visual match result with similarity score
 */
export async function compareImages(
  posterImageUrl: string,
  resultThumbnailUrl: string
): Promise<VisualMatchResult> {
  const anthropic = new Anthropic();

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: posterImageUrl }
          },
          {
            type: 'image',
            source: { type: 'url', url: resultThumbnailUrl }
          },
          {
            type: 'text',
            text: `Compare these two images. The first is a poster we're researching. The second is a search result.

Determine:
1. Are these the SAME poster (same artwork, possibly different scan/photo/condition)?
2. Or are they DIFFERENT artworks (perhaps by the same artist, similar style, but different images)?

Return ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "visualMatch": <0-100 similarity score>,
  "sameImage": <true if definitely same poster, false otherwise>,
  "sameArtist": <true if appears to be same artist/style but different work>,
  "explanation": "<brief reason, max 50 words>"
}

Scoring guide:
- 90-100: Definitely same poster (identical artwork)
- 70-89: Very likely same poster (minor differences in photo/scan)
- 50-69: Possibly same, needs human review
- 30-49: Same artist/style, different work
- 0-29: Different/unrelated images`
          }
        ]
      }]
    });

    // Extract JSON from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse the JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]) as VisualMatchResult;

    // Validate and normalize the result
    return {
      visualMatch: Math.max(0, Math.min(100, result.visualMatch || 0)),
      sameImage: Boolean(result.sameImage),
      sameArtist: Boolean(result.sameArtist),
      explanation: result.explanation || 'No explanation provided',
    };
  } catch (error) {
    console.error('Visual comparison error:', error);

    // Return a default "unable to compare" result
    return {
      visualMatch: 0,
      sameImage: false,
      sameArtist: false,
      explanation: error instanceof Error ? error.message : 'Comparison failed',
    };
  }
}

/**
 * Batch compare multiple search result thumbnails against a poster image.
 * Runs comparisons in parallel for efficiency.
 *
 * @param posterImageUrl - URL of the user's poster image
 * @param thumbnailUrls - Array of search result thumbnail URLs
 * @param maxConcurrent - Maximum concurrent comparisons (default: 5)
 * @returns Map of thumbnail URL to visual match result
 */
export async function batchCompareImages(
  posterImageUrl: string,
  thumbnailUrls: string[],
  maxConcurrent: number = 5
): Promise<Map<string, VisualMatchResult>> {
  const results = new Map<string, VisualMatchResult>();

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < thumbnailUrls.length; i += maxConcurrent) {
    const batch = thumbnailUrls.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(async (thumbnailUrl) => {
        const result = await compareImages(posterImageUrl, thumbnailUrl);
        return { thumbnailUrl, result };
      })
    );

    for (const { thumbnailUrl, result } of batchResults) {
      results.set(thumbnailUrl, result);
    }
  }

  return results;
}

/**
 * Check if a visual match result indicates a confirmed match.
 */
export function isConfirmedMatch(result: VisualMatchResult): boolean {
  return result.sameImage || result.visualMatch >= 85;
}

/**
 * Check if a visual match result indicates a likely match.
 */
export function isLikelyMatch(result: VisualMatchResult): boolean {
  return result.visualMatch >= 60;
}

/**
 * Get a human-readable label for a visual match result.
 */
export function getMatchLabel(result: VisualMatchResult): string {
  if (result.sameImage || result.visualMatch >= 85) {
    return 'Same poster confirmed';
  }
  if (result.visualMatch >= 60) {
    return 'Likely same poster';
  }
  if (result.visualMatch >= 40 || result.sameArtist) {
    return 'Same artist, different work';
  }
  if (result.visualMatch >= 20) {
    return 'Possibly related';
  }
  return 'Different/unrelated';
}

/**
 * Get a color class for displaying visual match in UI.
 */
export function getMatchColor(result: VisualMatchResult): string {
  if (result.sameImage || result.visualMatch >= 85) {
    return 'text-green-600'; // Confirmed match
  }
  if (result.visualMatch >= 60) {
    return 'text-blue-600'; // Likely match
  }
  if (result.visualMatch >= 40) {
    return 'text-amber-600'; // Uncertain
  }
  return 'text-slate-400'; // Low/no match
}
