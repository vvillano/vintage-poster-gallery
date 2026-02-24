import { sql } from '@vercel/postgres';
import {
  updateShopifyProduct,
  setProductMetafield,
  getProductMetafields,
} from '@/lib/shopify';

// Re-export constants from the shared client/server module
export {
  PUSH_FIELD_KEYS,
  ALL_FIELD_KEYS,
  BULK_FIELD_MAP,
  FIELD_LABELS,
  expandFieldKeys,
} from '@/lib/push-constants';

import { PUSH_FIELD_KEYS } from '@/lib/push-constants';


/**
 * Metafield type mapping for Shopify API
 */
function getMetafieldType(fieldKey: string): 'single_line_text_field' | 'multi_line_text_field' | 'json' {
  switch (fieldKey) {
    case PUSH_FIELD_KEYS.customHistory:
    case PUSH_FIELD_KEYS.conciseDescription:
    case PUSH_FIELD_KEYS.artistBio:
      return 'multi_line_text_field';
    case PUSH_FIELD_KEYS.customTalkingPoints:
      return 'json';
    default:
      return 'single_line_text_field';
  }
}

/**
 * Get the local value for a field from the poster database row.
 * For linked entity fields (publisher, printer, etc.), fetches from related tables.
 */
export async function getLocalValueForField(
  item: any,
  fieldKey: string,
  options?: { customConciseDescription?: string }
): Promise<string | null> {
  switch (fieldKey) {
    case PUSH_FIELD_KEYS.title:
      return item.title || null;

    case PUSH_FIELD_KEYS.description:
      return item.raw_ai_response?.productDescriptions?.standard
        || item.product_description
        || null;

    case PUSH_FIELD_KEYS.tags:
      return item.item_tags && item.item_tags.length > 0
        ? item.item_tags.join(', ')
        : null;

    case PUSH_FIELD_KEYS.customArtist:
      return item.artist || null;

    case PUSH_FIELD_KEYS.customDate:
      return item.estimated_date || null;

    case PUSH_FIELD_KEYS.customTechnique:
      return item.printing_technique || null;

    case PUSH_FIELD_KEYS.customHistory:
      return item.historical_context || null;

    case PUSH_FIELD_KEYS.customTalkingPoints:
      return item.raw_ai_response?.talkingPoints
        ? JSON.stringify(item.raw_ai_response.talkingPoints)
        : null;

    case PUSH_FIELD_KEYS.conciseDescription:
      return options?.customConciseDescription
        || item.raw_ai_response?.productDescriptions?.concise
        || null;

    case PUSH_FIELD_KEYS.bookTitleSource:
      if (item.publication_id) {
        try {
          const result = await sql`SELECT title, author FROM publications WHERE id = ${item.publication_id}`;
          if (result.rows.length > 0) {
            let title = result.rows[0].title;
            if (result.rows[0].author) title += ` by ${result.rows[0].author}`;
            return title;
          }
        } catch (err) {
          console.error('Error fetching publication:', err);
        }
      }
      return null;

    case PUSH_FIELD_KEYS.publisher:
      if (item.publisher_id) {
        try {
          const result = await sql`SELECT name FROM publishers WHERE id = ${item.publisher_id}`;
          if (result.rows.length > 0) return result.rows[0].name;
        } catch (err) {
          console.error('Error fetching publisher:', err);
        }
      }
      return null;

    case PUSH_FIELD_KEYS.printer:
      if (item.printer_id) {
        try {
          const result = await sql`SELECT name FROM printers WHERE id = ${item.printer_id}`;
          if (result.rows.length > 0) return result.rows[0].name;
        } catch (err) {
          console.error('Error fetching printer:', err);
        }
      }
      return item.printer || null;

    case PUSH_FIELD_KEYS.color:
      return item.colors && item.colors.length > 0
        ? item.colors.join(', ')
        : null;

    case PUSH_FIELD_KEYS.artistBio:
      if (item.artist_id) {
        try {
          const result = await sql`SELECT bio FROM artists WHERE id = ${item.artist_id}`;
          if (result.rows.length > 0 && result.rows[0].bio) return result.rows[0].bio;
        } catch (err) {
          console.error('Error fetching artist bio:', err);
        }
      }
      return null;

    case PUSH_FIELD_KEYS.countryOfOrigin:
      return item.country_of_origin || null;

    case PUSH_FIELD_KEYS.medium:
      return item.printing_technique || null;

    default:
      return null;
  }
}

/**
 * Get the current Shopify value for a field from the stored shopifyData snapshot.
 */
export function getShopifyValueForField(
  shopifyData: any,
  fieldKey: string
): string | null {
  if (!shopifyData) return null;

  switch (fieldKey) {
    case PUSH_FIELD_KEYS.title:
      return shopifyData.title || null;

    case PUSH_FIELD_KEYS.description:
      return shopifyData.bodyHtml || null;

    case PUSH_FIELD_KEYS.tags:
      return shopifyData.shopifyTags && shopifyData.shopifyTags.length > 0
        ? shopifyData.shopifyTags.join(', ')
        : null;

    default: {
      // Parse metafield keys: "metafield:namespace.key"
      const match = fieldKey.match(/^metafield:(\w+)\.(.+)$/);
      if (match && shopifyData.metafields) {
        const [, namespace, key] = match;
        const mf = shopifyData.metafields.find(
          (m: any) => m.namespace === namespace && m.key === key
        );
        return mf?.value || null;
      }
      return null;
    }
  }
}

/**
 * Push a single field to Shopify.
 * Handles the Shopify API call for one specific field key.
 */
export async function pushSingleField(
  productId: string,
  item: any,
  fieldKey: string,
  options?: { customConciseDescription?: string }
): Promise<void> {
  const value = await getLocalValueForField(item, fieldKey, options);

  if (!value) {
    throw new Error(`No value available to push for ${fieldKey}`);
  }

  switch (fieldKey) {
    case PUSH_FIELD_KEYS.title:
      await updateShopifyProduct(productId, { title: value });
      break;

    case PUSH_FIELD_KEYS.description: {
      // Convert to HTML and append Size/Artist/Condition
      let htmlDescription = value
        .split('\n\n')
        .map((p: string) => `<p>${p.trim()}</p>`)
        .join('\n');

      try {
        const metafields = await getProductMetafields(productId);
        const mfMap = new Map<string, string>();
        for (const mf of metafields) {
          mfMap.set(`${mf.namespace}.${mf.key}`, mf.value);
        }

        const appendParts: string[] = [];
        const height = mfMap.get('specs.height');
        const width = mfMap.get('specs.width');
        if (height && width) {
          appendParts.push(`<p><strong>Size:</strong> ${height}" x ${width}"</p>`);
        } else if (height) {
          appendParts.push(`<p><strong>Size:</strong> ${height}" H</p>`);
        } else if (width) {
          appendParts.push(`<p><strong>Size:</strong> ${width}" W</p>`);
        }
        if (item.artist) {
          appendParts.push(`<p><strong>Artist:</strong> ${item.artist}</p>`);
        }
        const condition = mfMap.get('jadepuma.condition');
        const conditionDetails = mfMap.get('jadepuma.condition_details');
        if (condition && conditionDetails) {
          appendParts.push(`<p><strong>Condition:</strong> ${condition}, ${conditionDetails}</p>`);
        } else if (condition) {
          appendParts.push(`<p><strong>Condition:</strong> ${condition}</p>`);
        }
        if (appendParts.length > 0) {
          htmlDescription += '\n<br>\n' + appendParts.join('\n');
        }
      } catch (appendError) {
        console.error('Error fetching metafields for description append:', appendError);
      }

      await updateShopifyProduct(productId, { bodyHtml: htmlDescription });
      break;
    }

    case PUSH_FIELD_KEYS.tags: {
      const tags = item.item_tags || [];
      if (tags.length === 0) throw new Error('No tags available to push');
      await updateShopifyProduct(productId, { tags });
      break;
    }

    default: {
      // All metafield fields: parse "metafield:namespace.key"
      const match = fieldKey.match(/^metafield:(\w+)\.(.+)$/);
      if (!match) {
        throw new Error(`Unknown field key: ${fieldKey}`);
      }
      const [, namespace, key] = match;
      await setProductMetafield(productId, {
        namespace,
        key,
        value,
        type: getMetafieldType(fieldKey),
      });
      break;
    }
  }
}


/**
 * Record a push in push_history and remove from push_queue.
 */
export async function recordPushAndCleanQueue(
  posterId: number,
  fieldKey: string,
  previousValue: string | null,
  newValue: string | null,
  pushedBy: string
): Promise<void> {
  // Record in history
  await sql`
    INSERT INTO push_history (poster_id, field_key, previous_value, new_value, pushed_by)
    VALUES (${posterId}, ${fieldKey}, ${previousValue}, ${newValue}, ${pushedBy})
  `;

  // Remove from queue
  await sql`
    DELETE FROM push_queue
    WHERE poster_id = ${posterId} AND field_key = ${fieldKey}
  `;
}
