-- Add status column to meal_plans table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'meal_plans'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE meal_plans
    ADD COLUMN status text DEFAULT 'active';

    -- Add check constraint for valid status values
    ALTER TABLE meal_plans
    ADD CONSTRAINT meal_plans_status_check
    CHECK (status IN ('draft', 'active', 'completed', 'archived'));
  END IF;
END $$;