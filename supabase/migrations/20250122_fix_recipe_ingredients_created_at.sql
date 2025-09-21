-- Add created_at column to recipe_ingredients table if it doesn't exist

DO $$
BEGIN
    -- Check if recipe_ingredients table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipe_ingredients') THEN
        -- Add created_at column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'recipe_ingredients'
                      AND column_name = 'created_at') THEN
            ALTER TABLE recipe_ingredients
            ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

            -- Update existing rows to have a created_at timestamp
            UPDATE recipe_ingredients
            SET created_at = NOW()
            WHERE created_at IS NULL;
        END IF;
    END IF;
END $$;