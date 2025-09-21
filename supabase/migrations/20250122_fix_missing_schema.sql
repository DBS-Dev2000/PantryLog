-- Fix missing database schema elements that the API expects

-- Create meal_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS meal_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL,
  recipe_id uuid,
  meal_name text NOT NULL,
  meal_date date NOT NULL, -- Use meal_date instead of served_date
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  servings integer DEFAULT 4,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  would_make_again boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add served_date as alias for meal_date if API expects it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'meal_history'
    AND column_name = 'served_date'
  ) THEN
    ALTER TABLE meal_history ADD COLUMN served_date date;
    -- Copy meal_date to served_date for existing records
    UPDATE meal_history SET served_date = meal_date WHERE served_date IS NULL;
  END IF;
END $$;

-- Create member_dietary_restrictions table if it doesn't exist
CREATE TABLE IF NOT EXISTS member_dietary_restrictions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL,
  member_id uuid NOT NULL,
  restriction_type text NOT NULL,
  severity text DEFAULT 'moderate',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(member_id, restriction_type)
);

-- Create food_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS food_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL,
  preference_type text NOT NULL,
  preference_value text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create household_schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS household_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL,
  schedule_type text NOT NULL,
  schedule_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Create household_meal_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS household_meal_preferences (
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

-- Add indexes for performance (only if tables exist)
DO $$
BEGIN
  -- Only create indexes if the tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meal_history') THEN
    CREATE INDEX IF NOT EXISTS idx_meal_history_household_id ON meal_history(household_id);
    CREATE INDEX IF NOT EXISTS idx_meal_history_meal_date ON meal_history(meal_date);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_dietary_restrictions') THEN
    CREATE INDEX IF NOT EXISTS idx_member_dietary_restrictions_household_id ON member_dietary_restrictions(household_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'food_preferences') THEN
    CREATE INDEX IF NOT EXISTS idx_food_preferences_household_id ON food_preferences(household_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_schedules') THEN
    CREATE INDEX IF NOT EXISTS idx_household_schedules_household_id ON household_schedules(household_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_meal_preferences') THEN
    CREATE INDEX IF NOT EXISTS idx_household_meal_preferences_household_id ON household_meal_preferences(household_id);
  END IF;
END $$;

-- Add RLS policies (only if tables exist)
DO $$
BEGIN
  -- Enable RLS only if tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meal_history') THEN
    ALTER TABLE meal_history ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_dietary_restrictions') THEN
    ALTER TABLE member_dietary_restrictions ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'food_preferences') THEN
    ALTER TABLE food_preferences ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_schedules') THEN
    ALTER TABLE household_schedules ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_meal_preferences') THEN
    ALTER TABLE household_meal_preferences ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Basic RLS policies (users can only access their own household data)
DO $$
BEGIN
  -- meal_history policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meal_history') AND
     NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meal_history' AND policyname = 'meal_history_policy') THEN
    CREATE POLICY meal_history_policy ON meal_history
      FOR ALL USING (household_id = auth.uid());
  END IF;

  -- member_dietary_restrictions policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_dietary_restrictions') AND
     NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_dietary_restrictions' AND policyname = 'member_dietary_restrictions_policy') THEN
    CREATE POLICY member_dietary_restrictions_policy ON member_dietary_restrictions
      FOR ALL USING (household_id = auth.uid());
  END IF;

  -- food_preferences policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'food_preferences') AND
     NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'food_preferences' AND policyname = 'food_preferences_policy') THEN
    CREATE POLICY food_preferences_policy ON food_preferences
      FOR ALL USING (household_id = auth.uid());
  END IF;

  -- household_schedules policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_schedules') AND
     NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'household_schedules' AND policyname = 'household_schedules_policy') THEN
    CREATE POLICY household_schedules_policy ON household_schedules
      FOR ALL USING (household_id = auth.uid());
  END IF;

  -- household_meal_preferences policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_meal_preferences') AND
     NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'household_meal_preferences' AND policyname = 'household_meal_preferences_policy') THEN
    CREATE POLICY household_meal_preferences_policy ON household_meal_preferences
      FOR ALL USING (household_id = auth.uid());
  END IF;
END $$;