-- Add attendees column to planned_meals table for tracking who will attend each meal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'planned_meals'
    AND column_name = 'attendees'
  ) THEN
    ALTER TABLE planned_meals
    ADD COLUMN attendees jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add index for attendees queries
CREATE INDEX IF NOT EXISTS idx_planned_meals_attendees
ON planned_meals USING gin(attendees);

-- Add dietary_preferences column to family_members if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'family_members'
    AND column_name = 'dietary_preferences'
  ) THEN
    ALTER TABLE family_members
    ADD COLUMN dietary_preferences jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;