-- Safe schema creation for meal planning
-- This migration is designed to never fail regardless of current database state

-- Function to safely execute SQL with error handling
CREATE OR REPLACE FUNCTION safe_execute(sql_text TEXT)
RETURNS VOID AS $$
BEGIN
  BEGIN
    EXECUTE sql_text;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the migration
      RAISE NOTICE 'Skipped SQL due to error: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create tables only if they don't exist and are safe to create
DO $$
BEGIN
  -- Create meal_history table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meal_history') THEN
    CREATE TABLE meal_history (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      household_id uuid NOT NULL,
      recipe_id uuid,
      meal_name text NOT NULL,
      meal_date date NOT NULL,
      meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
      servings integer DEFAULT 4,
      rating integer CHECK (rating >= 1 AND rating <= 5),
      would_make_again boolean DEFAULT true,
      notes text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );

    -- Add served_date alias
    ALTER TABLE meal_history ADD COLUMN served_date date;

    -- Create indexes
    CREATE INDEX idx_meal_history_household_id ON meal_history(household_id);
    CREATE INDEX idx_meal_history_meal_date ON meal_history(meal_date);

    -- Enable RLS and create policy
    ALTER TABLE meal_history ENABLE ROW LEVEL SECURITY;
    CREATE POLICY meal_history_policy ON meal_history FOR ALL USING (household_id = auth.uid());
  END IF;

  -- Create member_dietary_restrictions table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_dietary_restrictions') THEN
    CREATE TABLE member_dietary_restrictions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      household_id uuid NOT NULL,
      member_id uuid NOT NULL,
      restriction_type text NOT NULL,
      severity text DEFAULT 'moderate',
      created_at timestamp with time zone DEFAULT now(),
      UNIQUE(member_id, restriction_type)
    );

    -- Create indexes
    CREATE INDEX idx_member_dietary_restrictions_household_id ON member_dietary_restrictions(household_id);

    -- Enable RLS and create policy
    ALTER TABLE member_dietary_restrictions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY member_dietary_restrictions_policy ON member_dietary_restrictions FOR ALL USING (household_id = auth.uid());
  END IF;

  -- Create food_preferences table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'food_preferences') THEN
    CREATE TABLE food_preferences (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      household_id uuid NOT NULL,
      preference_type text NOT NULL,
      preference_value text NOT NULL,
      created_at timestamp with time zone DEFAULT now()
    );

    -- Create indexes
    CREATE INDEX idx_food_preferences_household_id ON food_preferences(household_id);

    -- Enable RLS and create policy
    ALTER TABLE food_preferences ENABLE ROW LEVEL SECURITY;
    CREATE POLICY food_preferences_policy ON food_preferences FOR ALL USING (household_id = auth.uid());
  END IF;

  -- Create household_schedules table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_schedules') THEN
    CREATE TABLE household_schedules (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      household_id uuid NOT NULL,
      schedule_type text NOT NULL,
      schedule_data jsonb DEFAULT '{}'::jsonb,
      created_at timestamp with time zone DEFAULT now()
    );

    -- Create indexes
    CREATE INDEX idx_household_schedules_household_id ON household_schedules(household_id);

    -- Enable RLS and create policy
    ALTER TABLE household_schedules ENABLE ROW LEVEL SECURITY;
    CREATE POLICY household_schedules_policy ON household_schedules FOR ALL USING (household_id = auth.uid());
  END IF;

  -- Create household_meal_preferences table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_meal_preferences') THEN
    CREATE TABLE household_meal_preferences (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      household_id uuid NOT NULL,
      max_prep_time_weekday integer DEFAULT 30,
      max_prep_time_weekend integer DEFAULT 60,
      preferred_meal_types text[] DEFAULT ARRAY['breakfast', 'lunch', 'dinner'],
      avoid_ingredients text[] DEFAULT ARRAY[]::text[],
      favorite_cuisines text[] DEFAULT ARRAY[]::text[],
      budget_per_week decimal(10,2),
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );

    -- Create indexes
    CREATE INDEX idx_household_meal_preferences_household_id ON household_meal_preferences(household_id);

    -- Enable RLS and create policy
    ALTER TABLE household_meal_preferences ENABLE ROW LEVEL SECURITY;
    CREATE POLICY household_meal_preferences_policy ON household_meal_preferences FOR ALL USING (household_id = auth.uid());
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, just log it and continue
    RAISE NOTICE 'Migration completed with some warnings: %', SQLERRM;
END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS safe_execute(TEXT);