-- Add comprehensive UPC data fields to products table
-- This migration captures ALL data from the UPC API

-- Add new columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS ean TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimension JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lowest_recorded_price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS highest_recorded_price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_images JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offers JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS asin TEXT; -- Amazon ID
ALTER TABLE products ADD COLUMN IF NOT EXISTS elid TEXT; -- eBay ID
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS nutrition JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS raw_api_response JSONB; -- Store complete API response
ALTER TABLE products ADD COLUMN IF NOT EXISTS api_last_updated TIMESTAMP WITH TIME ZONE;

-- Create indexes for commonly searched fields
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
CREATE INDEX IF NOT EXISTS idx_products_brand_lower ON products(LOWER(brand));
CREATE INDEX IF NOT EXISTS idx_products_lowest_price ON products(lowest_recorded_price);
CREATE INDEX IF NOT EXISTS idx_products_offers ON products USING gin(offers);
CREATE INDEX IF NOT EXISTS idx_products_nutrition ON products USING gin(nutrition);

-- Add comment to document the raw_api_response field
COMMENT ON COLUMN products.raw_api_response IS 'Complete UPC API response stored for reference and future processing';

-- Create a view for products with price information
CREATE OR REPLACE VIEW products_with_prices AS
SELECT
    p.*,
    CASE
        WHEN p.lowest_recorded_price IS NOT NULL THEN p.lowest_recorded_price
        WHEN p.offers IS NOT NULL AND jsonb_array_length(p.offers) > 0 THEN
            (SELECT MIN((offer->>'price')::numeric)
             FROM jsonb_array_elements(p.offers) as offer
             WHERE offer->>'price' IS NOT NULL)
        ELSE NULL
    END as best_price,
    CASE
        WHEN p.offers IS NOT NULL AND jsonb_array_length(p.offers) > 0 THEN
            (SELECT offer->>'merchant'
             FROM jsonb_array_elements(p.offers) as offer
             WHERE (offer->>'price')::numeric = (
                 SELECT MIN((o->>'price')::numeric)
                 FROM jsonb_array_elements(p.offers) as o
                 WHERE o->>'price' IS NOT NULL
             )
             LIMIT 1)
        ELSE NULL
    END as best_price_merchant
FROM products p;

-- Create a function to extract nutrition data
CREATE OR REPLACE FUNCTION extract_nutrition_value(nutrition_data JSONB, nutrient_name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN nutrition_data->nutrient_name->>'value';
END;
$$ LANGUAGE plpgsql;

-- Add helper functions for working with offers
CREATE OR REPLACE FUNCTION get_latest_offer_price(offers JSONB)
RETURNS DECIMAL AS $$
DECLARE
    latest_offer JSONB;
BEGIN
    IF offers IS NULL OR jsonb_array_length(offers) = 0 THEN
        RETURN NULL;
    END IF;

    -- Get the offer with the most recent updated_t
    SELECT offer INTO latest_offer
    FROM jsonb_array_elements(offers) as offer
    ORDER BY (offer->>'updated_t')::bigint DESC
    LIMIT 1;

    RETURN (latest_offer->>'price')::decimal;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get available merchants
CREATE OR REPLACE FUNCTION get_available_merchants(offers JSONB)
RETURNS TEXT[] AS $$
DECLARE
    merchants TEXT[];
BEGIN
    IF offers IS NULL OR jsonb_array_length(offers) = 0 THEN
        RETURN ARRAY[]::TEXT[];
    END IF;

    SELECT array_agg(DISTINCT offer->>'merchant')
    INTO merchants
    FROM jsonb_array_elements(offers) as offer
    WHERE offer->>'availability' != 'Out of Stock';

    RETURN COALESCE(merchants, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;