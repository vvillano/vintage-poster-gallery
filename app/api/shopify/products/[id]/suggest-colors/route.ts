import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getColorNames } from '@/lib/colors';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { imageUrl } = body as { imageUrl: string };

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    // Get available color names from managed list
    const colorList = await getColorNames();
    if (colorList.length === 0) {
      return NextResponse.json({ error: 'No colors configured' }, { status: 400 });
    }

    // Call Sonnet for color detection (cheap, fast)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'url',
                url: imageUrl,
              },
            },
            {
              type: 'text',
              text: `Select 2-5 colors from the list below that a customer shopping for wall art would use to find this poster.
Think like an interior designer matching art to a room's color scheme.
Focus on the artwork itself, not background or framing elements.

Rules:
- Choose the MOST SPECIFIC match: use "Navy" not "Blue" for dark blues, "Olive" not "Green" for muted yellow-greens, "Burgundy" not "Red" for dark wine reds, "Gold" not "Yellow" for warm metallic yellows, "Cream" not "White" for warm off-whites, "Tan" not "Brown" for light sandy browns
- For aged/yellowed paper, use "Cream" or "Tan" only if it is a significant visual element
- Only use colors from this exact list

AVAILABLE COLORS:
${colorList.join(', ')}

Respond with ONLY a JSON array of color names, nothing else. Example: ["Red", "Gold", "Black"]`,
            },
          ],
        },
      ],
    });

    // Parse response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from Claude');
    }

    let suggestedColors: string[] = [];
    const match = textContent.text.match(/\[[\s\S]*\]/);
    if (match) {
      suggestedColors = JSON.parse(match[0]);
      // Filter to only valid colors from our list
      suggestedColors = suggestedColors.filter(c =>
        colorList.some(cl => cl.toLowerCase() === c.toLowerCase())
      );
    }

    // Persist to linked poster if one exists
    const gid = id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;
    const posterResult = await sql`
      SELECT id, raw_ai_response FROM posters
      WHERE shopify_product_id = ${gid}
      LIMIT 1
    `;

    if (posterResult.rows.length > 0) {
      const poster = posterResult.rows[0];
      const raw = typeof poster.raw_ai_response === 'string'
        ? JSON.parse(poster.raw_ai_response)
        : (poster.raw_ai_response || {});
      const updatedRaw = { ...raw, suggestedColors };
      await sql`
        UPDATE posters SET raw_ai_response = ${JSON.stringify(updatedRaw)}
        WHERE id = ${poster.id}
      `;
    }

    return NextResponse.json({ suggestedColors });
  } catch (error) {
    console.error('Suggest colors error:', error);
    return NextResponse.json(
      { error: 'Failed to suggest colors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
