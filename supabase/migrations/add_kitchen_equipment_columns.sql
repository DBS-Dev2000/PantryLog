-- Add missing columns to household_meal_preferences table
-- These columns are needed for storing kitchen equipment and store preferences

DO $$
BEGIN
    -- Add kitchen_equipment column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'household_meal_preferences'
        AND column_name = 'kitchen_equipment'
    ) THEN
        ALTER TABLE household_meal_preferences
        ADD COLUMN kitchen_equipment JSONB DEFAULT '[]'::jsonb;

        RAISE NOTICE 'Added kitchen_equipment column to household_meal_preferences';
    ELSE
        RAISE NOTICE 'kitchen_equipment column already exists';
    END IF;

    -- Add preferred_stores column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'household_meal_preferences'
        AND column_name = 'preferred_stores'
    ) THEN
        ALTER TABLE household_meal_preferences
        ADD COLUMN preferred_stores JSONB DEFAULT '[]'::jsonb;

        RAISE NOTICE 'Added preferred_stores column to household_meal_preferences';
    ELSE
        RAISE NOTICE 'preferred_stores column already exists';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'household_meal_preferences'
AND column_name IN ('kitchen_equipment', 'preferred_stores')
ORDER BY column_name;