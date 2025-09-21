-- Add missing columns to planned_meals table
-- This migration ensures the planned_meals table has all necessary columns

-- Add custom_meal_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'planned_meals'
                   AND column_name = 'custom_meal_name') THEN
        ALTER TABLE planned_meals
        ADD COLUMN custom_meal_name VARCHAR(200);

        RAISE NOTICE 'Added custom_meal_name column to planned_meals';
    ELSE
        RAISE NOTICE 'custom_meal_name column already exists';
    END IF;
END $$;

-- Add prep_time column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'planned_meals'
                   AND column_name = 'prep_time') THEN
        ALTER TABLE planned_meals
        ADD COLUMN prep_time INTEGER;

        RAISE NOTICE 'Added prep_time column to planned_meals';
    ELSE
        RAISE NOTICE 'prep_time column already exists';
    END IF;
END $$;

-- Add cook_time column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'planned_meals'
                   AND column_name = 'cook_time') THEN
        ALTER TABLE planned_meals
        ADD COLUMN cook_time INTEGER;

        RAISE NOTICE 'Added cook_time column to planned_meals';
    ELSE
        RAISE NOTICE 'cook_time column already exists';
    END IF;
END $$;

-- Add is_leftover_meal column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'planned_meals'
                   AND column_name = 'is_leftover_meal') THEN
        ALTER TABLE planned_meals
        ADD COLUMN is_leftover_meal BOOLEAN DEFAULT false;

        RAISE NOTICE 'Added is_leftover_meal column to planned_meals';
    ELSE
        RAISE NOTICE 'is_leftover_meal column already exists';
    END IF;
END $$;

-- Add leftover_from_meal_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'planned_meals'
                   AND column_name = 'leftover_from_meal_id') THEN
        ALTER TABLE planned_meals
        ADD COLUMN leftover_from_meal_id UUID REFERENCES planned_meals(id);

        RAISE NOTICE 'Added leftover_from_meal_id column to planned_meals';
    ELSE
        RAISE NOTICE 'leftover_from_meal_id column already exists';
    END IF;
END $$;

-- Add completed column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'planned_meals'
                   AND column_name = 'completed') THEN
        ALTER TABLE planned_meals
        ADD COLUMN completed BOOLEAN DEFAULT false;

        RAISE NOTICE 'Added completed column to planned_meals';
    ELSE
        RAISE NOTICE 'completed column already exists';
    END IF;
END $$;

-- Add rating column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'planned_meals'
                   AND column_name = 'rating') THEN
        ALTER TABLE planned_meals
        ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5);

        RAISE NOTICE 'Added rating column to planned_meals';
    ELSE
        RAISE NOTICE 'rating column already exists';
    END IF;
END $$;

-- Add feedback column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'planned_meals'
                   AND column_name = 'feedback') THEN
        ALTER TABLE planned_meals
        ADD COLUMN feedback TEXT;

        RAISE NOTICE 'Added feedback column to planned_meals';
    ELSE
        RAISE NOTICE 'feedback column already exists';
    END IF;
END $$;

-- Add for_members column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'planned_meals'
                   AND column_name = 'for_members') THEN
        ALTER TABLE planned_meals
        ADD COLUMN for_members UUID[];

        RAISE NOTICE 'Added for_members column to planned_meals';
    ELSE
        RAISE NOTICE 'for_members column already exists';
    END IF;
END $$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Grant permissions
GRANT ALL ON planned_meals TO authenticated;
GRANT ALL ON planned_meals TO service_role;

-- Verify the updated schema
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'planned_meals'
ORDER BY ordinal_position;