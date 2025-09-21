-- Clean up and recreate meal planning tables with correct schema
-- This will drop incorrectly structured tables and recreate them properly

-- 1. First, drop all dependent tables in correct order
DROP TABLE IF EXISTS meal_history CASCADE;
DROP TABLE IF EXISTS meal_suggestions CASCADE;
DROP TABLE IF EXISTS meal_plan_shopping_items CASCADE;
DROP TABLE IF EXISTS planned_meals CASCADE;
DROP TABLE IF EXISTS meal_plans CASCADE;
DROP TABLE IF EXISTS household_schedules CASCADE;
DROP TABLE IF EXISTS household_meal_preferences CASCADE;
DROP TABLE IF EXISTS food_preferences CASCADE;
DROP TABLE IF EXISTS member_diets CASCADE;
DROP TABLE IF EXISTS dietary_restrictions CASCADE;
DROP TABLE IF EXISTS household_members CASCADE;

-- 2. Now recreate everything with the correct schema

-- Create household_members table
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

-- Create dietary_restrictions table (master list - NOT per member)
CREATE TABLE dietary_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create member_diets table (links members to their dietary restrictions)
CREATE TABLE member_diets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
    restriction_id UUID NOT NULL REFERENCES dietary_restrictions(id),
    severity VARCHAR(20) CHECK (severity IN ('allergy', 'intolerance', 'preference')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, restriction_id)
);

-- Create food_preferences table
CREATE TABLE food_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
    food_type VARCHAR(100) NOT NULL,
    preference VARCHAR(20) CHECK (preference IN ('love', 'like', 'neutral', 'dislike', 'hate')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(member_id, food_type)
);

-- Create household_meal_preferences table
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

-- Create household_schedules table
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

-- Create meal_plans table
CREATE TABLE meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    total_estimated_cost DECIMAL(10,2),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create planned_meals table
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

-- Create meal_plan_shopping_items table
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

-- Create meal_suggestions table
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

-- Create meal_history table
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

-- 3. Insert default dietary restrictions
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
    ('Diabetic-Friendly', 'Suitable for diabetics');

-- 4. Grant permissions
GRANT ALL ON household_members TO authenticated;
GRANT ALL ON dietary_restrictions TO authenticated;
GRANT ALL ON member_diets TO authenticated;
GRANT ALL ON food_preferences TO authenticated;
GRANT ALL ON household_meal_preferences TO authenticated;
GRANT ALL ON household_schedules TO authenticated;
GRANT ALL ON meal_plans TO authenticated;
GRANT ALL ON planned_meals TO authenticated;
GRANT ALL ON meal_plan_shopping_items TO authenticated;
GRANT ALL ON meal_suggestions TO authenticated;
GRANT ALL ON meal_history TO authenticated;

-- 5. Enable RLS
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

-- 6. Create RLS policies for household_members
CREATE POLICY "Users can view household members"
ON household_members FOR SELECT
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert household members"
ON household_members FOR INSERT
TO authenticated
WITH CHECK (
    household_id IN (
        SELECT household_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update household members"
ON household_members FOR UPDATE
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can delete household members"
ON household_members FOR DELETE
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM profiles WHERE id = auth.uid()
    )
);

-- 7. Create policy for dietary_restrictions (read-only for all authenticated users)
CREATE POLICY "Anyone can view dietary restrictions"
ON dietary_restrictions FOR SELECT
TO authenticated
USING (true);

-- 8. Create RLS policies for member_diets
CREATE POLICY "Users can manage member diets"
ON member_diets FOR ALL
TO authenticated
USING (
    member_id IN (
        SELECT id FROM household_members
        WHERE household_id IN (
            SELECT household_id FROM profiles WHERE id = auth.uid()
        )
    )
);

-- 9. Create RLS policies for food_preferences
CREATE POLICY "Users can manage food preferences"
ON food_preferences FOR ALL
TO authenticated
USING (
    member_id IN (
        SELECT id FROM household_members
        WHERE household_id IN (
            SELECT household_id FROM profiles WHERE id = auth.uid()
        )
    )
);

-- 10. Create RLS policies for household_meal_preferences
CREATE POLICY "Users can manage household meal preferences"
ON household_meal_preferences FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM profiles WHERE id = auth.uid()
    )
);

-- 11. Create RLS policies for household_schedules
CREATE POLICY "Users can manage household schedules"
ON household_schedules FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM profiles WHERE id = auth.uid()
    )
);

-- 12. Create RLS policies for meal_plans
CREATE POLICY "Users can manage meal plans"
ON meal_plans FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM profiles WHERE id = auth.uid()
    )
);

-- 13. Create RLS policies for planned_meals
CREATE POLICY "Users can manage planned meals"
ON planned_meals FOR ALL
TO authenticated
USING (
    meal_plan_id IN (
        SELECT id FROM meal_plans
        WHERE household_id IN (
            SELECT household_id FROM profiles WHERE id = auth.uid()
        )
    )
);

-- 14. Create RLS policies for meal_plan_shopping_items
CREATE POLICY "Users can manage shopping items"
ON meal_plan_shopping_items FOR ALL
TO authenticated
USING (
    meal_plan_id IN (
        SELECT id FROM meal_plans
        WHERE household_id IN (
            SELECT household_id FROM profiles WHERE id = auth.uid()
        )
    )
);

-- 15. Create RLS policies for meal_suggestions
CREATE POLICY "Users can manage meal suggestions"
ON meal_suggestions FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM profiles WHERE id = auth.uid()
    )
);

-- 16. Create RLS policies for meal_history
CREATE POLICY "Users can manage meal history"
ON meal_history FOR ALL
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM profiles WHERE id = auth.uid()
    )
);

-- 17. Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- 18. Verification
SELECT 'CLEAN RECREATION COMPLETE' as status;

SELECT COUNT(*) as "Total Tables Created"
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'household_members', 'dietary_restrictions', 'member_diets',
    'food_preferences', 'household_meal_preferences', 'household_schedules',
    'meal_plans', 'planned_meals', 'meal_plan_shopping_items',
    'meal_suggestions', 'meal_history'
);

-- Show the structure of dietary_restrictions to confirm it's correct
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'dietary_restrictions'
ORDER BY ordinal_position;

-- List all created tables
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