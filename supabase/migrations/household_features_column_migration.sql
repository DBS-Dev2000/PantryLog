-- Household Features Column Migration
-- Add features column to households table for feature toggle management

-- Add features column as JSONB to store feature settings
ALTER TABLE households
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{
  "recipes_enabled": true,
  "ai_features_enabled": true,
  "shopping_list_sharing": true,
  "storage_editing": true,
  "multiple_households": false,
  "advanced_reporting": false,
  "custom_labels": true,
  "barcode_scanning": true
}'::jsonb;

-- Add index for better query performance on features
CREATE INDEX IF NOT EXISTS idx_households_features ON households USING GIN (features);

-- Update existing households to have default features if NULL
UPDATE households
SET features = '{
  "recipes_enabled": true,
  "ai_features_enabled": true,
  "shopping_list_sharing": true,
  "storage_editing": true,
  "multiple_households": false,
  "advanced_reporting": false,
  "custom_labels": true,
  "barcode_scanning": true
}'::jsonb
WHERE features IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN households.features IS 'JSONB object storing feature toggles for household (recipes, AI, sharing, etc.)';

-- Create helper function to check if household has feature enabled
CREATE OR REPLACE FUNCTION household_has_feature(household_uuid UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    feature_enabled BOOLEAN;
BEGIN
    SELECT COALESCE((features ->> feature_name)::boolean, true) INTO feature_enabled
    FROM households
    WHERE id = household_uuid;

    RETURN COALESCE(feature_enabled, true);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION household_has_feature(UUID, TEXT) IS 'Check if a household has a specific feature enabled';

-- Create function to update household features
CREATE OR REPLACE FUNCTION update_household_features(household_uuid UUID, new_features JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE households
    SET
        features = new_features,
        updated_at = timezone('utc'::text, now())
    WHERE id = household_uuid;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_household_features(UUID, JSONB) IS 'Update features for a household and set updated_at timestamp';

-- Example queries for testing:
-- SELECT household_has_feature('household-id-here', 'recipes_enabled');
-- SELECT update_household_features('household-id-here', '{"recipes_enabled": false}'::jsonb);