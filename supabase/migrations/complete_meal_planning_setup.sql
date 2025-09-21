-- Complete Meal Planning Setup with Diagnostics
-- This script handles all cases and ensures proper setup

-- Step 1: Diagnostics - Show current state
SELECT '=== CURRENT DATABASE STATE ===' as diagnostic;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'household_members')
        THEN 'EXISTS'
        ELSE 'DOES NOT EXIST'
    END as "household_members table";

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_members')
        THEN 'EXISTS'
        ELSE 'DOES NOT EXIST'
    END as "family_members table";

-- Step 2: Check what columns household_members has (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'household_members') THEN
        RAISE NOTICE 'household_members columns:';
        FOR r IN (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'household_members' ORDER BY ordinal_position)
        LOOP
            RAISE NOTICE '  - %', r.column_name;
        END LOOP;
    END IF;
END $$;

-- Step 3: Clean up meal planning tables
DROP TABLE IF EXISTS meal_history CASCADE;
DROP TABLE IF EXISTS meal_suggestions CASCADE;
DROP TABLE IF EXISTS meal_plan_shopping_items CASCADE;
DROP TABLE IF EXISTS planned_meals CASCADE;
DROP TABLE IF EXISTS meal_plans CASCADE;
DROP TABLE IF EXISTS household_schedules CASCADE;
DROP TABLE IF EXISTS household_meal_preferences CASCADE;
DROP TABLE IF EXISTS food_preferences CASCADE;
DROP TABLE IF EXISTS member_dietary_restrictions CASCADE;
DROP TABLE IF EXISTS member_diets CASCADE;
DROP TABLE IF EXISTS dietary_restrictions CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;

-- Step 4: Handle the household_members situation
DO $$
BEGIN
    -- Check if household_members exists and has meal planning columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'household_members'
        AND column_name = 'name'
    ) THEN
        -- This is the meal planning version, drop it
        DROP TABLE IF EXISTS household_members CASCADE;
        RAISE NOTICE 'Dropped meal planning household_members table';
    END IF;

    -- Ensure we have the proper household_members table for user-household linking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'household_members'
    ) THEN
        -- Create the user-household linking table
        CREATE TABLE household_members (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
            user_id UUID NOT NULL, -- References auth.users(id)
            role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member', 'guest')),
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            invited_by UUID,
            UNIQUE(household_id, user_id)
        );

        CREATE INDEX idx_household_members_user_id ON household_members(user_id);
        CREATE INDEX idx_household_members_household_id ON household_members(household_id);

        RAISE NOTICE 'Created household_members table for user-household linking';

        -- Insert existing households with their owner as admin
        -- Assuming household.id might be the user_id in single-user mode
        INSERT INTO household_members (household_id, user_id, role)
        SELECT DISTINCT h.id, auth.uid(), 'admin'
        FROM households h
        WHERE auth.uid() IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = h.id
            AND hm.user_id = auth.uid()
        );
    END IF;
END $$;

-- Step 5: Create meal planning tables with family_members
CREATE TABLE family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    birth_date DATE,
    age_group VARCHAR(20) CHECK (age_group IN ('infant', 'toddler', 'child', 'teen', 'adult', 'senior')),
    is_primary_meal_planner BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(household_id, name)
);

CREATE TABLE dietary_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE member_dietary_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    restriction_id UUID NOT NULL REFERENCES dietary_restrictions(id),
    severity VARCHAR(20) CHECK (severity IN ('allergy', 'intolerance', 'preference')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, restriction_id)
);

CREATE TABLE food_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    food_type VARCHAR(100) NOT NULL,
    preference VARCHAR(20) CHECK (preference IN ('love', 'like', 'neutral', 'dislike', 'hate')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, food_type)
);

CREATE TABLE household_meal_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    budget_per_week DECIMAL(10,2),
    budget_per_meal DECIMAL(10,2),
    preferred_cuisines TEXT[],
    cooking_skill_level VARCHAR(20) CHECK (cooking_skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    max_cooking_time_minutes INTEGER,
    preferred_meal_types TEXT[],
    servings_per_meal INTEGER DEFAULT 4,
    include_leftovers BOOLEAN DEFAULT true,
    shopping_day VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(household_id)
);

CREATE TABLE household_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    day_of_week VARCHAR(10) NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    preferred_time TIME,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(household_id, day_of_week, meal_type)
);

CREATE TABLE meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    total_estimated_cost DECIMAL(10,2),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE planned_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id),
    meal_date DATE NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    servings INTEGER DEFAULT 4,
    estimated_cost DECIMAL(10,2),
    is_prepared BOOLEAN DEFAULT false,
    prepared_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE meal_plan_shopping_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    ingredient_name VARCHAR(200) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50),
    estimated_cost DECIMAL(10,2),
    is_purchased BOOLEAN DEFAULT false,
    purchased_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE meal_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id),
    suggested_date DATE,
    meal_type VARCHAR(20) CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    reason TEXT,
    score DECIMAL(3,2),
    is_accepted BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE meal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id),
    meal_date DATE NOT NULL,
    meal_type VARCHAR(20) CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    servings INTEGER,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Insert default dietary restrictions
INSERT INTO dietary_restrictions (name, description) VALUES
    ('Gluten-Free', 'Avoid gluten-containing grains'),
    ('Dairy-Free', 'Avoid all dairy products'),
    ('Vegetarian', 'No meat or fish'),
    ('Vegan', 'No animal products'),
    ('Nut Allergy', 'Avoid all tree nuts and peanuts'),
    ('Shellfish Allergy', 'Avoid shellfish'),
    ('Egg Allergy', 'Avoid eggs'),
    ('Soy-Free', 'Avoid soy products'),
    ('Low-Carb', 'Reduced carbohydrate intake'),
    ('Keto', 'Very low carb, high fat diet'),
    ('Paleo', 'Paleolithic diet'),
    ('Halal', 'Follows Islamic dietary laws'),
    ('Kosher', 'Follows Jewish dietary laws'),
    ('Low-Sodium', 'Reduced sodium intake'),
    ('Diabetic-Friendly', 'Suitable for diabetics')
ON CONFLICT (name) DO NOTHING;

-- Step 7: Grant permissions
GRANT ALL ON household_members TO authenticated;
GRANT ALL ON family_members TO authenticated;
GRANT ALL ON dietary_restrictions TO authenticated;
GRANT ALL ON member_dietary_restrictions TO authenticated;
GRANT ALL ON food_preferences TO authenticated;
GRANT ALL ON household_meal_preferences TO authenticated;
GRANT ALL ON household_schedules TO authenticated;
GRANT ALL ON meal_plans TO authenticated;
GRANT ALL ON planned_meals TO authenticated;
GRANT ALL ON meal_plan_shopping_items TO authenticated;
GRANT ALL ON meal_suggestions TO authenticated;
GRANT ALL ON meal_history TO authenticated;

-- Step 8: Enable RLS
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dietary_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_dietary_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_meal_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_history ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies

-- Policies for household_members (user-household linking)
CREATE POLICY "Users can view their household memberships"
ON household_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policies for family_members
CREATE POLICY "Users can view family members"
ON family_members FOR SELECT
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert family members"
ON family_members FOR INSERT
TO authenticated
WITH CHECK (
    household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update family members"
ON family_members FOR UPDATE
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete family members"
ON family_members FOR DELETE
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
);

-- Policy for dietary_restrictions
CREATE POLICY "Anyone can view dietary restrictions"
ON dietary_restrictions FOR SELECT
TO authenticated
USING (true);

-- Policies for member_dietary_restrictions
CREATE POLICY "Users can manage member dietary restrictions"
ON member_dietary_restrictions FOR ALL
TO authenticated
USING (
    member_id IN (
        SELECT id FROM family_members
        WHERE household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    )
);

-- Policies for food_preferences
CREATE POLICY "Users can manage food preferences"
ON food_preferences FOR ALL
TO authenticated
USING (
    member_id IN (
        SELECT id FROM family_members
        WHERE household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    )
);

-- Policies for household_meal_preferences
CREATE POLICY "Users can manage household meal preferences"
ON household_meal_preferences FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
);

-- Policies for household_schedules
CREATE POLICY "Users can manage household schedules"
ON household_schedules FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
);

-- Policies for meal_plans
CREATE POLICY "Users can manage meal plans"
ON meal_plans FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
);

-- Policies for planned_meals
CREATE POLICY "Users can manage planned meals"
ON planned_meals FOR ALL
TO authenticated
USING (
    meal_plan_id IN (
        SELECT id FROM meal_plans
        WHERE household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    )
);

-- Policies for meal_plan_shopping_items
CREATE POLICY "Users can manage shopping items"
ON meal_plan_shopping_items FOR ALL
TO authenticated
USING (
    meal_plan_id IN (
        SELECT id FROM meal_plans
        WHERE household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    )
);

-- Policies for meal_suggestions
CREATE POLICY "Users can manage meal suggestions"
ON meal_suggestions FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
);

-- Policies for meal_history
CREATE POLICY "Users can manage meal history"
ON meal_history FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
);

-- Step 10: Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Step 11: Final verification
SELECT '=== MIGRATION COMPLETE ===' as status;

SELECT 'Tables Created:' as verification_type,
       COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'household_members', 'family_members', 'dietary_restrictions', 'member_dietary_restrictions',
    'food_preferences', 'household_meal_preferences', 'household_schedules',
    'meal_plans', 'planned_meals', 'meal_plan_shopping_items',
    'meal_suggestions', 'meal_history'
);

SELECT table_name as "Created Tables"
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'household_members', 'family_members', 'dietary_restrictions', 'member_dietary_restrictions',
    'food_preferences', 'household_meal_preferences', 'household_schedules',
    'meal_plans', 'planned_meals', 'meal_plan_shopping_items',
    'meal_suggestions', 'meal_history'
)
ORDER BY table_name;