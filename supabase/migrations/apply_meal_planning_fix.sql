-- Complete Meal Planning Fix Script
-- Run this in Supabase SQL Editor to fix all meal planning tables

-- 1. Create or fix household_members table
DO $$
BEGIN
    -- Check if household_members table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public'
                   AND table_name = 'household_members') THEN
        RAISE NOTICE 'Creating household_members table...';

        CREATE TABLE household_members (
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
    ELSE
        RAISE NOTICE 'household_members table already exists';

        -- Check if age_group column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public'
                       AND table_name = 'household_members'
                       AND column_name = 'age_group') THEN
            RAISE NOTICE 'Adding age_group column...';
            ALTER TABLE household_members
            ADD COLUMN IF NOT EXISTS age_group VARCHAR(20)
            CHECK (age_group IN ('infant', 'toddler', 'child', 'teen', 'adult', 'senior'));
        END IF;
    END IF;
END $$;

-- 2. Create dietary_restrictions table
CREATE TABLE IF NOT EXISTS dietary_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create member_diets table
CREATE TABLE IF NOT EXISTS member_diets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
    restriction_id UUID NOT NULL REFERENCES dietary_restrictions(id),
    severity VARCHAR(20) CHECK (severity IN ('allergy', 'intolerance', 'preference')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, restriction_id)
);

-- 4. Create food_preferences table
CREATE TABLE IF NOT EXISTS food_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
    food_type VARCHAR(100) NOT NULL,
    preference VARCHAR(20) CHECK (preference IN ('love', 'like', 'neutral', 'dislike', 'hate')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, food_type)
);

-- 5. Create household_meal_preferences table
CREATE TABLE IF NOT EXISTS household_meal_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    budget_per_week DECIMAL(10,2),
    budget_per_meal DECIMAL(10,2),
    preferred_cuisines TEXT[], -- Array of cuisine types
    cooking_skill_level VARCHAR(20) CHECK (cooking_skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    max_cooking_time_minutes INTEGER,
    preferred_meal_types TEXT[], -- breakfast, lunch, dinner, snack
    servings_per_meal INTEGER DEFAULT 4,
    include_leftovers BOOLEAN DEFAULT true,
    shopping_day VARCHAR(10), -- day of week
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(household_id)
);

-- 6. Create household_schedules table
CREATE TABLE IF NOT EXISTS household_schedules (
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

-- 7. Create meal_plans table
CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    total_estimated_cost DECIMAL(10,2),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create planned_meals table
CREATE TABLE IF NOT EXISTS planned_meals (
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

-- 9. Create meal_plan_shopping_items table
CREATE TABLE IF NOT EXISTS meal_plan_shopping_items (
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

-- 10. Create meal_suggestions table
CREATE TABLE IF NOT EXISTS meal_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id),
    suggested_date DATE,
    meal_type VARCHAR(20) CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    reason TEXT,
    score DECIMAL(3,2), -- 0.00 to 1.00
    is_accepted BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Create meal_history table
CREATE TABLE IF NOT EXISTS meal_history (
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

-- 12. Insert default dietary restrictions
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

-- 13. Grant permissions for authenticated users
GRANT ALL ON household_members TO authenticated;
GRANT ALL ON household_members TO service_role;
GRANT ALL ON dietary_restrictions TO authenticated;
GRANT ALL ON dietary_restrictions TO service_role;
GRANT ALL ON member_diets TO authenticated;
GRANT ALL ON member_diets TO service_role;
GRANT ALL ON food_preferences TO authenticated;
GRANT ALL ON food_preferences TO service_role;
GRANT ALL ON household_meal_preferences TO authenticated;
GRANT ALL ON household_meal_preferences TO service_role;
GRANT ALL ON household_schedules TO authenticated;
GRANT ALL ON household_schedules TO service_role;
GRANT ALL ON meal_plans TO authenticated;
GRANT ALL ON meal_plans TO service_role;
GRANT ALL ON planned_meals TO authenticated;
GRANT ALL ON planned_meals TO service_role;
GRANT ALL ON meal_plan_shopping_items TO authenticated;
GRANT ALL ON meal_plan_shopping_items TO service_role;
GRANT ALL ON meal_suggestions TO authenticated;
GRANT ALL ON meal_suggestions TO service_role;
GRANT ALL ON meal_history TO authenticated;
GRANT ALL ON meal_history TO service_role;

-- 14. Enable RLS on all tables
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dietary_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_meal_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_history ENABLE ROW LEVEL SECURITY;

-- 15. Create RLS policies for household_members
CREATE POLICY "Users can view household members"
ON household_members FOR SELECT
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert household members"
ON household_members FOR INSERT
TO authenticated
WITH CHECK (
    household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update household members"
ON household_members FOR UPDATE
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can delete household members"
ON household_members FOR DELETE
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
    )
);

-- 16. Create policies for dietary_restrictions (read-only for all)
CREATE POLICY "Anyone can view dietary restrictions"
ON dietary_restrictions FOR SELECT
TO authenticated
USING (true);

-- 17. Create RLS policies for member_diets
CREATE POLICY "Users can manage member diets"
ON member_diets FOR ALL
TO authenticated
USING (
    member_id IN (
        SELECT id FROM household_members
        WHERE household_id IN (
            SELECT household_id FROM users WHERE id = auth.uid()
        )
    )
);

-- 18. Create RLS policies for food_preferences
CREATE POLICY "Users can manage food preferences"
ON food_preferences FOR ALL
TO authenticated
USING (
    member_id IN (
        SELECT id FROM household_members
        WHERE household_id IN (
            SELECT household_id FROM users WHERE id = auth.uid()
        )
    )
);

-- 19. Create RLS policies for household_meal_preferences
CREATE POLICY "Users can manage household meal preferences"
ON household_meal_preferences FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
    )
);

-- 20. Create RLS policies for household_schedules
CREATE POLICY "Users can manage household schedules"
ON household_schedules FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
    )
);

-- 21. Create RLS policies for meal_plans
CREATE POLICY "Users can manage meal plans"
ON meal_plans FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
    )
);

-- 22. Create RLS policies for planned_meals
CREATE POLICY "Users can manage planned meals"
ON planned_meals FOR ALL
TO authenticated
USING (
    meal_plan_id IN (
        SELECT id FROM meal_plans
        WHERE household_id IN (
            SELECT household_id FROM users WHERE id = auth.uid()
        )
    )
);

-- 23. Create RLS policies for meal_plan_shopping_items
CREATE POLICY "Users can manage shopping items"
ON meal_plan_shopping_items FOR ALL
TO authenticated
USING (
    meal_plan_id IN (
        SELECT id FROM meal_plans
        WHERE household_id IN (
            SELECT household_id FROM users WHERE id = auth.uid()
        )
    )
);

-- 24. Create RLS policies for meal_suggestions
CREATE POLICY "Users can manage meal suggestions"
ON meal_suggestions FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
    )
);

-- 25. Create RLS policies for meal_history
CREATE POLICY "Users can manage meal history"
ON meal_history FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM users WHERE id = auth.uid()
    )
);

-- 26. Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- 27. Verification queries
SELECT 'Verification Results:' as status;

SELECT
    'household_members exists: ' ||
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'household_members'
    ) THEN 'YES' ELSE 'NO' END as check_result;

SELECT
    'Total meal planning tables: ' || COUNT(*)::text as count_result
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'household_members', 'dietary_restrictions', 'member_diets',
    'food_preferences', 'household_meal_preferences', 'household_schedules',
    'meal_plans', 'planned_meals', 'meal_plan_shopping_items',
    'meal_suggestions', 'meal_history'
);

-- Show all meal planning tables that exist
SELECT table_name as "Meal Planning Tables"
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'household_members', 'dietary_restrictions', 'member_diets',
    'food_preferences', 'household_meal_preferences', 'household_schedules',
    'meal_plans', 'planned_meals', 'meal_plan_shopping_items',
    'meal_suggestions', 'meal_history'
)
ORDER BY table_name;