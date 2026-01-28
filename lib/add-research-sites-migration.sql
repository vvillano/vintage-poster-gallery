-- Migration: Add research sites table for price research links
-- Creates research_sites table to replace hardcoded RESEARCH_SOURCES constant

-- Create research_sites table
CREATE TABLE IF NOT EXISTS research_sites (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  url_template TEXT NOT NULL,
  requires_subscription BOOLEAN DEFAULT false,
  username TEXT,
  password TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_sites_name ON research_sites(name);
CREATE INDEX IF NOT EXISTS idx_research_sites_order ON research_sites(display_order);

COMMENT ON TABLE research_sites IS 'Price research sites with search URLs and optional credentials';
COMMENT ON COLUMN research_sites.url_template IS 'URL with optional {search} placeholder for search queries';
COMMENT ON COLUMN research_sites.requires_subscription IS 'Whether the site requires a paid subscription';
COMMENT ON COLUMN research_sites.username IS 'Optional login username for the site';
COMMENT ON COLUMN research_sites.password IS 'Optional login password for the site';
COMMENT ON COLUMN research_sites.display_order IS 'Order to display sites (lower numbers first)';

-- Pre-populate with initial research sites
-- Subscription sites (display first)
INSERT INTO research_sites (name, url_template, requires_subscription, display_order) VALUES
  ('Worthpoint', 'https://www.worthpoint.com/inventory/search?query={search}&sort=SaleDate&img=true&saleDate=ALL_TIME', true, 1),
  ('Invaluable', 'https://www.invaluable.com/search?keyword={search}&upcoming=false', true, 2),
  ('Rennert''s', 'https://auctions.posterauctions.com/poster-price-guide', true, 3)
ON CONFLICT (name) DO NOTHING;

-- Free sites
INSERT INTO research_sites (name, url_template, requires_subscription, display_order) VALUES
  ('Heritage Auctions', 'https://historical.ha.com/c/search-results.zx?N=51&Ntt={search}', false, 10),
  ('LiveAuctioneers', 'https://www.liveauctioneers.com/search/?keyword={search}&sort=-sale_date', false, 11),
  ('eBay Sold', 'https://www.ebay.com/sch/i.html?_nkw={search}&LH_Complete=1&LH_Sold=1&_sop=13', false, 12)
ON CONFLICT (name) DO NOTHING;
