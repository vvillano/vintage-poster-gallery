# Shopify App Changes Needed

This document tracks changes required in the AVP Product Management Shopify app to support the Research App integration.

## New Metafields to Create

These metafields will be **pushed FROM the Research App TO Shopify**:

| Metafield | Type | Purpose |
|-----------|------|---------|
| `jadepuma.concise_description` | `multi_line_text_field` | Short description from AI research |
| `jadepuma.book_title_source` | `single_line_text_field` | Book source for antique prints |
| `jadepuma.publisher` | `single_line_text_field` | Publisher name (from verified entity) |
| `jadepuma.printer` | `single_line_text_field` | Printer name (from verified entity) |

## Existing Metafields (Read by Research App)

These are already in Shopify and will be **pulled TO the Research App** (read-only):

| Metafield | Type | Purpose |
|-----------|------|---------|
| `jadepuma.source_platform` | `single_line_text_field` | Where item was acquired |
| `jadepuma.private_seller_name` | `single_line_text_field` | Seller name/username |
| `jadepuma.private_seller_email` | `single_line_text_field` | Seller email |
| `jadepuma.purchase_price` | `money` | Purchase cost |
| `jadepuma.avp_shipping` | `money` | Shipping/other costs |
| `jadepuma.avp_restoration` | `money` | Restoration cost |
| `jadepuma.date` | `single_line_text_field` | Purchase date |

## Managed Lists to Sync

| List | Direction | Notes |
|------|-----------|-------|
| Sources/Platforms | Shopify → Research | Research app adds credentials locally |
| Available Tags | Bidirectional | AI suggests, user confirms, sync back |
| Colors | Bidirectional | AI identifies, user confirms, sync back |
| Artists | Research → Shopify | Research app is source of truth |
| Medium | Bidirectional | Maps to Printing Techniques |

## Implementation Status

### Completed in Research App

| Feature | Status | API Endpoint |
|---------|--------|--------------|
| Push title to Shopify | ✅ Done | `POST /api/shopify/push` (field: 'title') |
| Push research metafields | ✅ Done | `POST /api/shopify/push` (field: 'research_metafields') |
| Store original Shopify title | ✅ Done | shopify_title column added |
| Platform research data | ✅ Done | `/api/platform-research-data` |
| Private sellers directory | ✅ Done | `/api/private-sellers` |
| Platform identities | ✅ Done | `/api/platform-identities` |
| Research images (local) | ✅ Done | `/api/posters/[id]/research-images` |
| Managed list sync | 🔄 Stub | `/api/shopify/managed-lists` (needs AVP app integration) |

### New Database Tables

- `platform_research_data` - Credentials/URLs for acquisition platforms
- `private_sellers` - Seller contact info directory
- `platform_identities` - Platform usernames linked to sellers

### New Poster Fields

- `shopify_title` - Original title from Shopify (for revert)
- `research_images` - Local research images (signatures, title pages, etc.)

## Action Items for Shopify App

### Required for Push Operations

1. **Create jadepuma metafields** - The Research App will push these metafields:
   - `jadepuma.concise_description` (multi_line_text_field)
   - `jadepuma.book_title_source` (single_line_text_field)
   - `jadepuma.publisher` (single_line_text_field)
   - `jadepuma.printer` (single_line_text_field)

2. **Display in AVP app** - Show these research-pushed metafields in product view

### Required for List Sync (Future)

1. **Expose managed lists API** - Research App needs to fetch:
   - Available Tags list
   - Colors list
   - Sources/Platforms list

2. **Determine data format** - How are these lists stored?
   - Shop-level metaobjects?
   - Shop-level metafields?
   - Custom AVP app API?

## Future Considerations

1. **Platform Username field** - Consider adding a separate `jadepuma.platform_username` metafield to distinguish platform seller IDs from actual seller names

2. **Seller Phone** - Consider adding `jadepuma.private_seller_phone` if phone numbers become important

3. **Metaobjects** - Could create Shopify metaobjects for:
   - Verified Artists (sync from Research app)
   - Printers
   - Publishers
   - Books

---

*Last updated: 2026-01-31*
