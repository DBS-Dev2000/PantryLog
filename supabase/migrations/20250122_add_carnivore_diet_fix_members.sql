-- Add carnivore diet to dietary restrictions and fix family member dietary preferences

-- First, ensure family_members table exists with proper structure
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    birth_date DATE,
    age_group VARCHAR(20) CHECK (age_group IN ('infant', 'toddler', 'child', 'teen', 'adult', 'senior')),
    is_primary_meal_planner BOOLEAN DEFAULT false,
    dietary_restrictions TEXT[], -- Array of dietary restriction names
    food_allergies TEXT[], -- Array of allergens
    preferred_cuisines TEXT[], -- Array of preferred cuisine types
    disliked_ingredients TEXT[], -- Array of disliked ingredients
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(household_id, name)
);

-- Add dietary preferences columns if they don't exist
DO $$
BEGIN
    -- Add dietary_restrictions column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'family_members'
                   AND column_name = 'dietary_restrictions') THEN
        ALTER TABLE family_members ADD COLUMN dietary_restrictions TEXT[];
    END IF;

    -- Add food_allergies column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'family_members'
                   AND column_name = 'food_allergies') THEN
        ALTER TABLE family_members ADD COLUMN food_allergies TEXT[];
    END IF;

    -- Add preferred_cuisines column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'family_members'
                   AND column_name = 'preferred_cuisines') THEN
        ALTER TABLE family_members ADD COLUMN preferred_cuisines TEXT[];
    END IF;

    -- Add disliked_ingredients column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'family_members'
                   AND column_name = 'disliked_ingredients') THEN
        ALTER TABLE family_members ADD COLUMN disliked_ingredients TEXT[];
    END IF;
END $$;

-- Create or update dietary restrictions reference table
CREATE TABLE IF NOT EXISTS dietary_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    restriction_type VARCHAR(50) NOT NULL, -- 'lifestyle', 'medical', 'religious', 'allergy'
    description TEXT,
    excluded_ingredients TEXT[],
    excluded_categories TEXT[],
    allowed_ingredients TEXT[], -- For restrictive diets like carnivore
    allowed_categories TEXT[], -- For restrictive diets
    requires_substitutions BOOLEAN DEFAULT true,
    substitution_rules JSONB DEFAULT '{}',
    nutritional_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert/Update dietary restrictions including carnivore
INSERT INTO dietary_restrictions (name, display_name, restriction_type, description, excluded_ingredients, excluded_categories, allowed_ingredients, allowed_categories, substitution_rules, nutritional_notes) VALUES
-- Carnivore diet (new)
('carnivore', 'Carnivore', 'lifestyle',
 'Only animal products - meat, fish, eggs, and limited dairy',
 ARRAY['vegetables', 'fruits', 'grains', 'legumes', 'nuts', 'seeds', 'sugar', 'plant_oils'],
 ARRAY['salads', 'grain_bowls', 'pasta', 'sandwiches', 'oatmeal', 'smoothies', 'vegetarian', 'vegan'],
 ARRAY['beef', 'pork', 'chicken', 'fish', 'eggs', 'butter', 'cheese', 'heavy_cream', 'bone_broth'],
 ARRAY['grilled', 'roasted_meats', 'eggs', 'seafood', 'meat_based_soups'],
 '{"vegetables": ["more meat"], "grains": ["meat"], "fruit": ["none"]}',
 'Zero plant foods. Focus on fatty cuts of meat, organ meats for nutrients. May include dairy if tolerated.'),

-- Update existing keto
('keto', 'Ketogenic', 'lifestyle',
 'Very low carb, high fat, moderate protein diet',
 ARRAY['bread', 'pasta', 'rice', 'sugar', 'potatoes', 'most_fruits', 'beans', 'grains'],
 ARRAY['pasta', 'sandwiches', 'oatmeal', 'grain_bowls'],
 NULL,
 ARRAY['eggs', 'salads', 'grilled', 'meat_based', 'cheese_based'],
 '{"pasta": ["zucchini noodles", "shirataki"], "rice": ["cauliflower rice"], "bread": ["cloud bread", "lettuce wraps"]}',
 'Keep net carbs under 20g daily. Focus on healthy fats.'),

-- Vegetarian
('vegetarian', 'Vegetarian', 'lifestyle',
 'No meat, poultry, or fish',
 ARRAY['meat', 'poultry', 'fish', 'gelatin'],
 ARRAY['grilled_meats', 'bbq', 'meat_soups'],
 NULL,
 ARRAY['salads', 'grain_bowls', 'pasta', 'vegetarian', 'eggs'],
 '{"meat": ["tofu", "tempeh", "beans", "lentils", "mushrooms"]}',
 'Ensure adequate protein, B12, iron, and omega-3 fatty acids.'),

-- Vegan
('vegan', 'Vegan', 'lifestyle',
 'No animal products of any kind',
 ARRAY['meat', 'poultry', 'fish', 'dairy', 'eggs', 'honey', 'gelatin'],
 ARRAY['grilled_meats', 'bbq', 'eggs', 'cheese_based'],
 NULL,
 ARRAY['salads', 'grain_bowls', 'vegetarian', 'vegan'],
 '{"dairy": ["plant milk", "cashew cream"], "eggs": ["flax eggs", "tofu scramble"], "meat": ["plant proteins"]}',
 'Requires B12 supplementation. Focus on complete proteins.'),

-- Gluten-free
('gluten_free', 'Gluten-Free', 'medical',
 'No gluten-containing grains',
 ARRAY['wheat', 'barley', 'rye', 'spelt', 'kamut', 'triticale'],
 ARRAY['pasta', 'sandwiches', 'regular_bread'],
 NULL,
 NULL,
 '{"pasta": ["rice noodles", "corn pasta"], "bread": ["gluten-free bread"]}',
 'Check all sauces and processed foods for hidden gluten.'),

-- Dairy-free
('dairy_free', 'Dairy-Free', 'allergy',
 'No milk products',
 ARRAY['milk', 'cheese', 'yogurt', 'butter', 'cream', 'whey', 'casein'],
 ARRAY['cheese_based', 'cream_soups'],
 NULL,
 NULL,
 '{"milk": ["almond milk", "oat milk"], "butter": ["olive oil", "vegan butter"], "cheese": ["nutritional yeast"]}',
 'Ensure adequate calcium from other sources.'),

-- Paleo
('paleo', 'Paleo', 'lifestyle',
 'Whole foods diet avoiding processed foods, grains, and dairy',
 ARRAY['grains', 'legumes', 'dairy', 'processed_foods', 'refined_sugar'],
 ARRAY['pasta', 'sandwiches', 'grain_bowls', 'cheese_based'],
 NULL,
 ARRAY['grilled', 'salads', 'meat_based', 'vegetable_based'],
 '{"pasta": ["zucchini noodles", "spaghetti squash"], "bread": ["almond flour bread"]}',
 'Focus on whole, unprocessed foods.'),

-- Low FODMAP
('low_fodmap', 'Low FODMAP', 'medical',
 'Reduces fermentable carbohydrates for IBS management',
 ARRAY['onions', 'garlic', 'wheat', 'beans', 'apples', 'honey', 'high_lactose_dairy'],
 NULL,
 NULL,
 NULL,
 '{"onion": ["green onion tops", "chives"], "garlic": ["garlic oil"], "wheat": ["rice", "oats"]}',
 'Usually followed temporarily with gradual reintroduction.'),

-- Mediterranean
('mediterranean', 'Mediterranean', 'lifestyle',
 'Emphasizes whole grains, vegetables, olive oil, and moderate fish/poultry',
 ARRAY['processed_foods', 'red_meat_excess', 'refined_sugar'],
 NULL,
 ARRAY['olive_oil', 'fish', 'whole_grains', 'vegetables', 'fruits', 'nuts', 'legumes'],
 ARRAY['salads', 'grain_bowls', 'seafood', 'mediterranean'],
 '{}',
 'Heart-healthy diet rich in omega-3s and antioxidants.')

ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    excluded_ingredients = EXCLUDED.excluded_ingredients,
    excluded_categories = EXCLUDED.excluded_categories,
    allowed_ingredients = EXCLUDED.allowed_ingredients,
    allowed_categories = EXCLUDED.allowed_categories,
    substitution_rules = EXCLUDED.substitution_rules,
    nutritional_notes = EXCLUDED.nutritional_notes;

-- Create meal attendance table to track who's eating which meals
CREATE TABLE IF NOT EXISTS meal_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    planned_meal_id UUID REFERENCES planned_meals(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    meal_type VARCHAR(20) NOT NULL,
    attending_members UUID[], -- Array of family_member IDs who will eat this meal
    dietary_accommodations JSONB DEFAULT '{}', -- Per-person modifications needed
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_meal_attendance_household ON meal_attendance(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_attendance_date ON meal_attendance(meal_date);
CREATE INDEX IF NOT EXISTS idx_family_members_household ON family_members(household_id);
CREATE INDEX IF NOT EXISTS idx_family_members_dietary ON family_members USING GIN(dietary_restrictions);

-- Enable RLS on new tables
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dietary_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_attendance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for family_members
DROP POLICY IF EXISTS "Users can view own family members" ON family_members;
DROP POLICY IF EXISTS "Users can insert own family members" ON family_members;
DROP POLICY IF EXISTS "Users can update own family members" ON family_members;
DROP POLICY IF EXISTS "Users can delete own family members" ON family_members;

CREATE POLICY "Users can view own family members" ON family_members
    FOR SELECT USING (household_id = auth.uid());

CREATE POLICY "Users can insert own family members" ON family_members
    FOR INSERT WITH CHECK (household_id = auth.uid());

CREATE POLICY "Users can update own family members" ON family_members
    FOR UPDATE USING (household_id = auth.uid())
    WITH CHECK (household_id = auth.uid());

CREATE POLICY "Users can delete own family members" ON family_members
    FOR DELETE USING (household_id = auth.uid());

-- Create RLS policies for dietary_restrictions (read-only for all authenticated users)
DROP POLICY IF EXISTS "Users can view dietary restrictions" ON dietary_restrictions;

CREATE POLICY "Users can view dietary restrictions" ON dietary_restrictions
    FOR SELECT USING (true);

-- Create RLS policies for meal_attendance
DROP POLICY IF EXISTS "Users can view own meal attendance" ON meal_attendance;
DROP POLICY IF EXISTS "Users can insert own meal attendance" ON meal_attendance;
DROP POLICY IF EXISTS "Users can update own meal attendance" ON meal_attendance;
DROP POLICY IF EXISTS "Users can delete own meal attendance" ON meal_attendance;

CREATE POLICY "Users can view own meal attendance" ON meal_attendance
    FOR SELECT USING (household_id = auth.uid());

CREATE POLICY "Users can insert own meal attendance" ON meal_attendance
    FOR INSERT WITH CHECK (household_id = auth.uid());

CREATE POLICY "Users can update own meal attendance" ON meal_attendance
    FOR UPDATE USING (household_id = auth.uid())
    WITH CHECK (household_id = auth.uid());

CREATE POLICY "Users can delete own meal attendance" ON meal_attendance
    FOR DELETE USING (household_id = auth.uid());

-- Create a function to suggest meals based on dietary restrictions
CREATE OR REPLACE FUNCTION get_suitable_meals_for_restrictions(
    restriction_names TEXT[]
) RETURNS TABLE (
    category_name TEXT,
    is_allowed BOOLEAN,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH restriction_data AS (
        SELECT
            unnest(excluded_categories) as excluded_cat,
            unnest(allowed_categories) as allowed_cat
        FROM dietary_restrictions
        WHERE name = ANY(restriction_names)
    ),
    all_categories AS (
        SELECT DISTINCT category_name
        FROM recipe_category_mappings
    )
    SELECT
        ac.category_name,
        CASE
            WHEN ac.category_name IN (SELECT allowed_cat FROM restriction_data WHERE allowed_cat IS NOT NULL) THEN true
            WHEN ac.category_name IN (SELECT excluded_cat FROM restriction_data WHERE excluded_cat IS NOT NULL) THEN false
            ELSE true
        END as is_allowed,
        CASE
            WHEN ac.category_name IN (SELECT allowed_cat FROM restriction_data WHERE allowed_cat IS NOT NULL)
                THEN 'Specifically allowed for diet'
            WHEN ac.category_name IN (SELECT excluded_cat FROM restriction_data WHERE excluded_cat IS NOT NULL)
                THEN 'Excluded by dietary restriction'
            ELSE 'Check ingredients'
        END as notes
    FROM all_categories ac;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON family_members TO authenticated;
GRANT ALL ON dietary_restrictions TO authenticated;
GRANT ALL ON meal_attendance TO authenticated;
GRANT EXECUTE ON FUNCTION get_suitable_meals_for_restrictions(TEXT[]) TO authenticated;