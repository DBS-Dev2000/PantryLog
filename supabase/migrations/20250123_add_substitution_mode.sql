-- Add substitution mode to household ingredient equivalencies
-- This allows users to choose between "always substitute" and "only when available"

-- Add substitution_mode column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'household_ingredient_equivalencies'
        AND column_name = 'substitution_mode'
    ) THEN
        ALTER TABLE household_ingredient_equivalencies
        ADD COLUMN substitution_mode TEXT DEFAULT 'when_available'
        CHECK (substitution_mode IN ('always', 'when_available'));

        COMMENT ON COLUMN household_ingredient_equivalencies.substitution_mode IS
        'always = always use substitute (hard rule), when_available = only substitute if available';
    END IF;
END $$;

-- Add is_active column for enabling/disabling substitutions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'household_ingredient_equivalencies'
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE household_ingredient_equivalencies
        ADD COLUMN is_active BOOLEAN DEFAULT true;

        COMMENT ON COLUMN household_ingredient_equivalencies.is_active IS
        'Enable or disable substitution without deleting';
    END IF;
END $$;