-- Fix dietary restrictions table structure
-- This migration ensures the dietary_restrictions table has all necessary columns

-- First, check if the table exists and add missing columns
DO $$
BEGIN
    -- Add display_name column if it doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dietary_restrictions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'display_name') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN display_name VARCHAR(100);
            UPDATE dietary_restrictions SET display_name = name WHERE display_name IS NULL;
            ALTER TABLE dietary_restrictions ALTER COLUMN display_name SET NOT NULL;
        END IF;

        -- Add restriction_type column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'restriction_type') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN restriction_type VARCHAR(50) DEFAULT 'lifestyle';
            ALTER TABLE dietary_restrictions ALTER COLUMN restriction_type SET NOT NULL;
        END IF;

        -- Add description column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'description') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN description TEXT;
        END IF;

        -- Add excluded_ingredients column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'excluded_ingredients') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN excluded_ingredients TEXT[];
        END IF;

        -- Add excluded_categories column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'excluded_categories') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN excluded_categories TEXT[];
        END IF;

        -- Add allowed_ingredients column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'allowed_ingredients') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN allowed_ingredients TEXT[];
        END IF;

        -- Add allowed_categories column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'allowed_categories') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN allowed_categories TEXT[];
        END IF;

        -- Add requires_substitutions column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'requires_substitutions') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN requires_substitutions BOOLEAN DEFAULT true;
        END IF;

        -- Add substitution_rules column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'substitution_rules') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN substitution_rules JSONB DEFAULT '{}';
        END IF;

        -- Add nutritional_notes column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'nutritional_notes') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN nutritional_notes TEXT;
        END IF;

        -- Add is_active column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'is_active') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN is_active BOOLEAN DEFAULT true;
        END IF;

        -- Add created_at column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'dietary_restrictions'
                      AND column_name = 'created_at') THEN
            ALTER TABLE dietary_restrictions ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE dietary_restrictions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL UNIQUE,
            display_name VARCHAR(100) NOT NULL,
            restriction_type VARCHAR(50) NOT NULL,
            description TEXT,
            excluded_ingredients TEXT[],
            excluded_categories TEXT[],
            allowed_ingredients TEXT[],
            allowed_categories TEXT[],
            requires_substitutions BOOLEAN DEFAULT true,
            substitution_rules JSONB DEFAULT '{}',
            nutritional_notes TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Now insert or update the dietary restrictions
INSERT INTO dietary_restrictions (name, display_name, restriction_type, description, excluded_ingredients, excluded_categories, allowed_ingredients, allowed_categories, substitution_rules, nutritional_notes) VALUES
-- Carnivore diet
('carnivore', 'Carnivore', 'lifestyle',
 'Only animal products - meat, fish, eggs, and limited dairy',
 ARRAY['vegetables', 'fruits', 'grains', 'legumes', 'nuts', 'seeds', 'sugar', 'plant_oils'],
 ARRAY['salads', 'grain_bowls', 'pasta', 'sandwiches', 'oatmeal', 'smoothies', 'vegetarian', 'vegan'],
 ARRAY['beef', 'pork', 'chicken', 'fish', 'eggs', 'butter', 'cheese', 'heavy_cream', 'bone_broth'],
 ARRAY['grilled', 'roasted_meats', 'eggs', 'seafood', 'meat_based_soups'],
 '{"vegetables": ["more meat"], "grains": ["meat"], "fruit": ["none"]}'::jsonb,
 'Zero plant foods. Focus on fatty cuts of meat, organ meats for nutrients. May include dairy if tolerated.'),

-- Keto diet
('keto', 'Ketogenic', 'lifestyle',
 'Very low carb, high fat, moderate protein diet',
 ARRAY['bread', 'pasta', 'rice', 'sugar', 'potatoes', 'most_fruits', 'beans', 'grains'],
 ARRAY['pasta', 'sandwiches', 'oatmeal', 'grain_bowls'],
 NULL,
 ARRAY['eggs', 'salads', 'grilled', 'meat_based', 'cheese_based'],
 '{"pasta": ["zucchini noodles", "shirataki"], "rice": ["cauliflower rice"], "bread": ["cloud bread", "lettuce wraps"]}'::jsonb,
 'Keep net carbs under 20g daily. Focus on healthy fats.'),

-- Vegetarian
('vegetarian', 'Vegetarian', 'lifestyle',
 'No meat, poultry, or fish',
 ARRAY['meat', 'poultry', 'fish', 'gelatin'],
 ARRAY['grilled_meats', 'bbq', 'meat_soups'],
 NULL,
 ARRAY['salads', 'grain_bowls', 'pasta', 'vegetarian', 'eggs'],
 '{"meat": ["tofu", "tempeh", "beans", "lentils", "mushrooms"]}'::jsonb,
 'Ensure adequate protein, B12, iron, and omega-3 fatty acids.'),

-- Vegan
('vegan', 'Vegan', 'lifestyle',
 'No animal products of any kind',
 ARRAY['meat', 'poultry', 'fish', 'dairy', 'eggs', 'honey', 'gelatin'],
 ARRAY['grilled_meats', 'bbq', 'eggs', 'cheese_based'],
 NULL,
 ARRAY['salads', 'grain_bowls', 'vegetarian', 'vegan'],
 '{"dairy": ["plant milk", "cashew cream"], "eggs": ["flax eggs", "tofu scramble"], "meat": ["plant proteins"]}'::jsonb,
 'Requires B12 supplementation. Focus on complete proteins.'),

-- Gluten-free
('gluten_free', 'Gluten-Free', 'medical',
 'No gluten-containing grains',
 ARRAY['wheat', 'barley', 'rye', 'spelt', 'kamut', 'triticale'],
 ARRAY['pasta', 'sandwiches', 'regular_bread'],
 NULL,
 NULL,
 '{"pasta": ["rice noodles", "corn pasta"], "bread": ["gluten-free bread"]}'::jsonb,
 'Check all sauces and processed foods for hidden gluten.'),

-- Dairy-free
('dairy_free', 'Dairy-Free', 'allergy',
 'No milk products',
 ARRAY['milk', 'cheese', 'yogurt', 'butter', 'cream', 'whey', 'casein'],
 ARRAY['cheese_based', 'cream_soups'],
 NULL,
 NULL,
 '{"milk": ["almond milk", "oat milk"], "butter": ["olive oil", "vegan butter"], "cheese": ["nutritional yeast"]}'::jsonb,
 'Ensure adequate calcium from other sources.'),

-- Paleo
('paleo', 'Paleo', 'lifestyle',
 'Whole foods diet avoiding processed foods, grains, and dairy',
 ARRAY['grains', 'legumes', 'dairy', 'processed_foods', 'refined_sugar'],
 ARRAY['pasta', 'sandwiches', 'grain_bowls', 'cheese_based'],
 NULL,
 ARRAY['grilled', 'salads', 'meat_based', 'vegetable_based'],
 '{"pasta": ["zucchini noodles", "spaghetti squash"], "bread": ["almond flour bread"]}'::jsonb,
 'Focus on whole, unprocessed foods.'),

-- Low FODMAP
('low_fodmap', 'Low FODMAP', 'medical',
 'Reduces fermentable carbohydrates for IBS management',
 ARRAY['onions', 'garlic', 'wheat', 'beans', 'apples', 'honey', 'high_lactose_dairy'],
 NULL,
 NULL,
 NULL,
 '{"onion": ["green onion tops", "chives"], "garlic": ["garlic oil"], "wheat": ["rice", "oats"]}'::jsonb,
 'Usually followed temporarily with gradual reintroduction.'),

-- Mediterranean
('mediterranean', 'Mediterranean', 'lifestyle',
 'Emphasizes whole grains, vegetables, olive oil, and moderate fish/poultry',
 ARRAY['processed_foods', 'red_meat_excess', 'refined_sugar'],
 NULL,
 ARRAY['olive_oil', 'fish', 'whole_grains', 'vegetables', 'fruits', 'nuts', 'legumes'],
 ARRAY['salads', 'grain_bowls', 'seafood', 'mediterranean'],
 '{}'::jsonb,
 'Heart-healthy diet rich in omega-3s and antioxidants.')

ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    restriction_type = EXCLUDED.restriction_type,
    description = EXCLUDED.description,
    excluded_ingredients = EXCLUDED.excluded_ingredients,
    excluded_categories = EXCLUDED.excluded_categories,
    allowed_ingredients = EXCLUDED.allowed_ingredients,
    allowed_categories = EXCLUDED.allowed_categories,
    substitution_rules = EXCLUDED.substitution_rules,
    nutritional_notes = EXCLUDED.nutritional_notes;

-- Grant permissions
GRANT ALL ON dietary_restrictions TO authenticated;