-- Create meal planning rules tables for AI RAG system
-- These tables store best practices and patterns for intelligent meal planning

-- 1. Meal type characteristics and rules
CREATE TABLE IF NOT EXISTS meal_type_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    rule_category VARCHAR(50) NOT NULL, -- 'timing', 'nutrition', 'preparation', 'characteristics'
    rule_name VARCHAR(100) NOT NULL,
    rule_description TEXT NOT NULL,
    priority INTEGER DEFAULT 1, -- Higher priority rules are more important
    metadata JSONB DEFAULT '{}', -- Additional structured data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(meal_type, rule_category, rule_name)
);

-- 2. Recipe categories and their meal type associations
CREATE TABLE IF NOT EXISTS recipe_category_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name VARCHAR(100) NOT NULL,
    meal_types TEXT[] NOT NULL, -- Array of suitable meal types
    is_primary_for VARCHAR(20), -- Primary meal type this category is for
    characteristics JSONB DEFAULT '{}', -- e.g., {"quick": true, "portable": true}
    typical_prep_time_range INT4RANGE, -- e.g., '[10,30)' for 10-30 minutes
    nutritional_profile JSONB DEFAULT '{}', -- e.g., {"protein_rich": true, "light": false}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category_name)
);

-- 3. Theme night patterns
CREATE TABLE IF NOT EXISTS theme_night_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
    theme_name VARCHAR(100) NOT NULL,
    theme_description TEXT,
    suggested_categories TEXT[], -- Recipe categories that fit this theme
    suggested_cuisines TEXT[], -- Cuisine types that fit this theme
    is_popular BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}', -- Additional rules or suggestions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Dietary restriction rules
CREATE TABLE IF NOT EXISTS dietary_restriction_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restriction_name VARCHAR(100) NOT NULL UNIQUE,
    restriction_type VARCHAR(50), -- 'allergy', 'lifestyle', 'religious', 'medical'
    excluded_ingredients TEXT[], -- Ingredients to avoid
    excluded_categories TEXT[], -- Recipe categories to avoid
    preferred_categories TEXT[], -- Recipe categories that work well
    substitution_rules JSONB DEFAULT '{}', -- e.g., {"dairy": ["almond milk", "oat milk"]}
    meal_planning_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Meal rotation patterns
CREATE TABLE IF NOT EXISTS meal_rotation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type VARCHAR(50) NOT NULL, -- 'frequency', 'variety', 'balance'
    rule_name VARCHAR(100) NOT NULL,
    rule_description TEXT NOT NULL,
    parameters JSONB DEFAULT '{}', -- e.g., {"min_days_between_repeat": 7, "variety_target": 0.8}
    applies_to_meal_types TEXT[], -- Which meal types this rule applies to
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(rule_type, rule_name)
);

-- 6. Time-based meal planning rules
CREATE TABLE IF NOT EXISTS time_based_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_context VARCHAR(50) NOT NULL, -- 'weekday', 'weekend', 'season', 'time_of_day'
    context_value VARCHAR(100), -- e.g., 'monday-friday', 'summer', 'morning'
    meal_type VARCHAR(20),
    max_prep_time_minutes INTEGER,
    preferred_categories TEXT[],
    cooking_methods TEXT[], -- e.g., ['one-pot', 'slow-cooker', 'no-cook']
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Nutritional balance rules
CREATE TABLE IF NOT EXISTS nutritional_balance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_type VARCHAR(20),
    nutrient_category VARCHAR(50) NOT NULL, -- 'protein', 'carbs', 'vegetables', 'fats'
    target_range VARCHAR(100), -- e.g., '15-30g', '2-3 servings'
    importance VARCHAR(20) DEFAULT 'recommended', -- 'required', 'recommended', 'optional'
    meal_component_examples TEXT[], -- Examples of foods that provide this
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Family preference patterns
CREATE TABLE IF NOT EXISTS family_preference_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL, -- 'favorite_meal', 'disliked', 'frequency_preference'
    pattern_value JSONB NOT NULL, -- Flexible structure for different pattern types
    confidence_score DECIMAL(3,2), -- 0-1 score of how confident we are in this pattern
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default meal type rules
INSERT INTO meal_type_rules (meal_type, rule_category, rule_name, rule_description, priority) VALUES
-- Breakfast rules
('breakfast', 'timing', 'quick_preparation', 'Breakfast should be preparable in under 15 minutes on weekdays', 9),
('breakfast', 'nutrition', 'protein_requirement', 'Include 15-30g of protein for sustained energy', 8),
('breakfast', 'preparation', 'make_ahead', 'Prioritize recipes that can be prepared the night before', 7),
('breakfast', 'characteristics', 'grab_and_go', 'Should be portable for busy mornings', 6),
('breakfast', 'nutrition', 'include_fiber', 'Include whole grains or fruits for fiber', 5),

-- Lunch rules
('lunch', 'characteristics', 'portability', 'Must be easily portable and reheatable', 9),
('lunch', 'nutrition', 'balanced_meal', 'Include protein, vegetables, and complex carbs', 8),
('lunch', 'preparation', 'batch_friendly', 'Should work well for batch preparation', 7),
('lunch', 'timing', 'quick_reheat', 'Should reheat in under 5 minutes', 6),
('lunch', 'characteristics', 'cold_friendly', 'Consider meals that taste good cold', 5),

-- Dinner rules
('dinner', 'timing', 'weekday_quick', 'Weekday dinners should take less than 30 minutes', 8),
('dinner', 'timing', 'weekend_elaborate', 'Weekend dinners can be more elaborate (up to 90 minutes)', 5),
('dinner', 'nutrition', 'family_style', 'Portions should feed the whole family with potential leftovers', 7),
('dinner', 'characteristics', 'variety', 'Rotate between different proteins and cuisines', 6),
('dinner', 'preparation', 'one_pot_option', 'Include one-pot or sheet pan options for easy cleanup', 5),

-- Snack rules
('snack', 'nutrition', 'nutrient_dense', 'Choose nutrient-dense over empty calories', 8),
('snack', 'timing', 'no_prep', 'Should require minimal to no preparation', 9),
('snack', 'characteristics', 'portion_controlled', 'Pre-portioned or easily portionable', 7)
ON CONFLICT (meal_type, rule_category, rule_name) DO NOTHING;

-- Insert recipe category mappings
INSERT INTO recipe_category_mappings (category_name, meal_types, is_primary_for, characteristics, typical_prep_time_range, nutritional_profile) VALUES
('eggs', ARRAY['breakfast', 'lunch'], 'breakfast', '{"quick": true, "protein_rich": true}', '[5,15)', '{"protein_rich": true}'),
('oatmeal', ARRAY['breakfast'], 'breakfast', '{"make_ahead": true, "filling": true}', '[5,10)', '{"fiber_rich": true}'),
('smoothies', ARRAY['breakfast', 'snack'], 'breakfast', '{"portable": true, "quick": true}', '[3,5)', '{"customizable": true}'),
('sandwiches', ARRAY['lunch', 'dinner'], 'lunch', '{"portable": true, "customizable": true}', '[5,15)', '{"balanced": true}'),
('salads', ARRAY['lunch', 'dinner'], 'lunch', '{"light": true, "healthy": true}', '[10,20)', '{"vegetable_rich": true}'),
('grain_bowls', ARRAY['lunch', 'dinner'], 'lunch', '{"batch_friendly": true, "filling": true}', '[15,30)', '{"balanced": true}'),
('soup', ARRAY['lunch', 'dinner'], 'dinner', '{"freezer_friendly": true, "comforting": true}', '[20,60)', '{"warming": true}'),
('pasta', ARRAY['dinner'], 'dinner', '{"family_friendly": true, "filling": true}', '[15,30)', '{"carb_rich": true}'),
('stir_fry', ARRAY['dinner'], 'dinner', '{"quick": true, "vegetable_rich": true}', '[15,25)', '{"balanced": true}'),
('casserole', ARRAY['dinner'], 'dinner', '{"make_ahead": true, "family_style": true}', '[20,60)', '{"hearty": true}'),
('sheet_pan', ARRAY['dinner'], 'dinner', '{"easy_cleanup": true, "hands_off": true}', '[10,40)', '{"balanced": true}'),
('slow_cooker', ARRAY['dinner'], 'dinner', '{"hands_off": true, "batch_friendly": true}', '[15,480)', '{"tender": true}'),
('grilled', ARRAY['lunch', 'dinner'], 'dinner', '{"seasonal": true, "flavorful": true}', '[15,30)', '{"lean_protein": true}')
ON CONFLICT (category_name) DO NOTHING;

-- Insert theme night patterns
INSERT INTO theme_night_patterns (day_of_week, theme_name, theme_description, suggested_categories, suggested_cuisines, is_popular) VALUES
(1, 'Meatless Monday', 'Vegetarian or vegan meals to start the week healthy', ARRAY['salads', 'grain_bowls', 'pasta'], ARRAY['Mediterranean', 'Indian', 'Thai'], true),
(2, 'Taco Tuesday', 'Mexican and Latin-inspired cuisine', ARRAY['tacos', 'burritos', 'fajitas'], ARRAY['Mexican', 'Tex-Mex', 'Latin'], true),
(3, 'Whatever Wednesday', 'Try new recipes or use up leftovers', ARRAY[]::TEXT[], ARRAY[]::TEXT[], true),
(4, 'Throwback Thursday', 'Family favorites and comfort foods', ARRAY['casserole', 'pasta'], ARRAY['American', 'Italian'], true),
(5, 'Pizza Friday', 'Pizza night or takeout option', ARRAY['pizza', 'flatbread'], ARRAY['Italian', 'American'], true),
(6, 'Grill Saturday', 'Grilling and outdoor cooking', ARRAY['grilled', 'bbq'], ARRAY['American', 'BBQ'], true),
(0, 'Slow Cooker Sunday', 'Set it and forget it meals', ARRAY['slow_cooker', 'soup', 'stew'], ARRAY[]::TEXT[], true);

-- Insert dietary restriction rules
INSERT INTO dietary_restriction_rules (restriction_name, restriction_type, excluded_ingredients, excluded_categories, preferred_categories, substitution_rules, meal_planning_notes) VALUES
('keto', 'lifestyle', ARRAY['bread', 'pasta', 'rice', 'sugar', 'potatoes'], ARRAY['pasta', 'sandwiches'], ARRAY['eggs', 'salads', 'grilled'], '{"pasta": ["zucchini noodles", "shirataki"], "rice": ["cauliflower rice"], "bread": ["cloud bread", "lettuce wraps"]}', 'Focus on high fat, moderate protein, very low carb. Target under 20g net carbs per day.'),
('vegetarian', 'lifestyle', ARRAY['meat', 'poultry', 'fish'], ARRAY['grilled'], ARRAY['salads', 'grain_bowls', 'pasta'], '{"meat": ["tofu", "tempeh", "beans", "lentils"]}', 'Ensure adequate protein from plant sources. Include B12 supplementation.'),
('vegan', 'lifestyle', ARRAY['meat', 'poultry', 'fish', 'dairy', 'eggs', 'honey'], ARRAY['eggs'], ARRAY['grain_bowls', 'salads', 'stir_fry'], '{"dairy": ["plant milk", "nutritional yeast"], "eggs": ["flax eggs", "chickpea flour"]}', 'Focus on whole foods and ensure adequate B12, iron, and omega-3 sources.'),
('gluten_free', 'medical', ARRAY['wheat', 'barley', 'rye'], ARRAY['pasta', 'sandwiches'], ARRAY['grain_bowls', 'salads'], '{"pasta": ["rice noodles", "chickpea pasta"], "bread": ["gluten-free bread"]}', 'Check all sauces and seasonings for hidden gluten.'),
('dairy_free', 'allergy', ARRAY['milk', 'cheese', 'yogurt', 'butter', 'cream'], ARRAY[]::TEXT[], ARRAY['stir_fry', 'grilled'], '{"milk": ["almond milk", "oat milk"], "butter": ["olive oil", "coconut oil"]}', 'Ensure adequate calcium from other sources.'),
('low_sodium', 'medical', ARRAY['soy sauce', 'bouillon', 'cured meats'], ARRAY[]::TEXT[], ARRAY['grilled', 'salads'], '{"salt": ["herbs", "spices", "lemon"], "soy sauce": ["coconut aminos"]}', 'Limit sodium to 1500-2300mg per day. Use herbs and spices for flavor.'),
('diabetic', 'medical', ARRAY['sugar', 'white bread', 'white rice'], ARRAY[]::TEXT[], ARRAY['salads', 'grilled', 'eggs'], '{"sugar": ["stevia", "erythritol"], "white rice": ["brown rice", "quinoa"]}', 'Focus on low glycemic index foods. Balance carbs with protein and fiber.')
ON CONFLICT (restriction_name) DO NOTHING;

-- Insert meal rotation rules
INSERT INTO meal_rotation_rules (rule_type, rule_name, rule_description, parameters, applies_to_meal_types, priority) VALUES
('frequency', 'no_repeat_week', 'Do not repeat the same dinner within 7 days unless marked as staple', '{"min_days_between_repeat": 7, "exclude_staples": true}', ARRAY['dinner'], 9),
('frequency', 'breakfast_rotation', 'Rotate between 3-5 breakfast options weekly', '{"min_options": 3, "max_options": 5}', ARRAY['breakfast'], 7),
('variety', 'protein_variety', 'Rotate between different protein sources throughout the week', '{"proteins": ["chicken", "beef", "fish", "vegetarian", "pork"], "min_different": 3}', ARRAY['dinner'], 8),
('variety', 'cuisine_variety', 'Include at least 3 different cuisines per week', '{"min_cuisines": 3}', ARRAY['dinner'], 6),
('balance', 'new_recipe_ratio', 'Include 1-2 new recipes per week (20% new, 80% familiar)', '{"new_recipe_percentage": 0.2}', ARRAY['dinner'], 5),
('balance', 'leftover_planning', 'Plan for leftovers at least 2 nights per week', '{"leftover_meals_per_week": 2}', ARRAY['dinner'], 7),
('frequency', 'staple_frequency', 'Staple meals can repeat weekly', '{"min_days_between_repeat": 5, "max_weekly_frequency": 2}', ARRAY['breakfast', 'lunch', 'dinner'], 6)
ON CONFLICT (rule_type, rule_name) DO NOTHING;

-- Insert time-based rules
INSERT INTO time_based_rules (rule_context, context_value, meal_type, max_prep_time_minutes, preferred_categories, cooking_methods, notes) VALUES
('weekday', 'monday-friday', 'breakfast', 10, ARRAY['eggs', 'oatmeal', 'smoothies'], ARRAY['no-cook', 'quick-cook'], 'Focus on quick, energizing breakfasts'),
('weekday', 'monday-friday', 'dinner', 30, ARRAY['stir_fry', 'sheet_pan', 'pasta'], ARRAY['one-pot', 'quick-cook'], 'Quick dinners for busy weeknights'),
('weekend', 'saturday-sunday', 'breakfast', 30, ARRAY['eggs', 'pancakes', 'french_toast'], ARRAY['griddle', 'baked'], 'More elaborate breakfast options'),
('weekend', 'saturday-sunday', 'dinner', 90, ARRAY['slow_cooker', 'grilled', 'casserole'], ARRAY['slow-cook', 'grilled', 'baked'], 'Time for elaborate cooking or trying new recipes'),
('season', 'summer', 'dinner', 45, ARRAY['grilled', 'salads'], ARRAY['grilled', 'no-cook'], 'Light, fresh meals; utilize outdoor cooking'),
('season', 'winter', 'dinner', 60, ARRAY['soup', 'casserole', 'slow_cooker'], ARRAY['slow-cook', 'baked'], 'Warming, comfort foods'),
('time_of_day', 'morning', 'breakfast', 15, ARRAY['eggs', 'oatmeal', 'smoothies'], ARRAY['quick-cook', 'no-cook'], 'Quick morning preparation');

-- Insert nutritional balance rules
INSERT INTO nutritional_balance_rules (meal_type, nutrient_category, target_range, importance, meal_component_examples, notes) VALUES
('breakfast', 'protein', '15-30g', 'required', ARRAY['eggs', 'Greek yogurt', 'protein powder', 'nut butter'], 'Protein helps maintain satiety until lunch'),
('breakfast', 'fiber', '5-10g', 'recommended', ARRAY['oatmeal', 'whole grain toast', 'berries', 'chia seeds'], 'Fiber aids digestion and provides sustained energy'),
('lunch', 'vegetables', '2-3 servings', 'required', ARRAY['salad greens', 'roasted vegetables', 'raw veggies'], 'Half the plate should be vegetables'),
('lunch', 'protein', '20-30g', 'required', ARRAY['chicken', 'beans', 'tofu', 'fish'], 'Adequate protein prevents afternoon energy crashes'),
('dinner', 'vegetables', '2-3 servings', 'required', ARRAY['side salad', 'steamed vegetables', 'roasted vegetables'], 'Include a variety of colors'),
('dinner', 'protein', '25-35g', 'required', ARRAY['meat', 'fish', 'legumes', 'tofu'], 'Main protein source of the day'),
('dinner', 'complex_carbs', '30-45g', 'recommended', ARRAY['brown rice', 'quinoa', 'sweet potato', 'whole grain pasta'], 'Provides energy and satiety'),
('snack', 'protein', '5-10g', 'recommended', ARRAY['nuts', 'cheese', 'hummus', 'Greek yogurt'], 'Protein-rich snacks are more satisfying');

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meal_type_rules_meal_type ON meal_type_rules(meal_type);
CREATE INDEX IF NOT EXISTS idx_meal_type_rules_priority ON meal_type_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_category_mappings_meal_types ON recipe_category_mappings USING GIN(meal_types);
CREATE INDEX IF NOT EXISTS idx_theme_night_patterns_day ON theme_night_patterns(day_of_week);
CREATE INDEX IF NOT EXISTS idx_dietary_restriction_rules_name ON dietary_restriction_rules(restriction_name);
CREATE INDEX IF NOT EXISTS idx_family_preference_patterns_household ON family_preference_patterns(household_id);
CREATE INDEX IF NOT EXISTS idx_time_based_rules_context ON time_based_rules(rule_context, context_value);

-- Create a view for easy AI agent access to all meal planning rules
CREATE OR REPLACE VIEW meal_planning_knowledge_base AS
SELECT
    'meal_type_rule' as rule_source,
    meal_type as context_type,
    rule_category as category,
    rule_name as rule,
    rule_description as description,
    priority,
    metadata as additional_data
FROM meal_type_rules
UNION ALL
SELECT
    'category_mapping' as rule_source,
    category_name as context_type,
    'category' as category,
    category_name as rule,
    'Suitable for: ' || array_to_string(meal_types, ', ') as description,
    5 as priority,
    jsonb_build_object(
        'characteristics', characteristics,
        'nutritional_profile', nutritional_profile,
        'prep_time_range', typical_prep_time_range::text
    ) as additional_data
FROM recipe_category_mappings
UNION ALL
SELECT
    'theme_night' as rule_source,
    'day_' || day_of_week::text as context_type,
    'theme' as category,
    theme_name as rule,
    theme_description as description,
    CASE WHEN is_popular THEN 8 ELSE 5 END as priority,
    jsonb_build_object(
        'suggested_categories', suggested_categories,
        'suggested_cuisines', suggested_cuisines
    ) as additional_data
FROM theme_night_patterns
UNION ALL
SELECT
    'dietary_restriction' as rule_source,
    restriction_name as context_type,
    restriction_type as category,
    restriction_name as rule,
    meal_planning_notes as description,
    10 as priority,
    jsonb_build_object(
        'excluded_ingredients', excluded_ingredients,
        'preferred_categories', preferred_categories,
        'substitutions', substitution_rules
    ) as additional_data
FROM dietary_restriction_rules
UNION ALL
SELECT
    'rotation_rule' as rule_source,
    rule_type as context_type,
    'rotation' as category,
    rule_name as rule,
    rule_description as description,
    priority,
    parameters as additional_data
FROM meal_rotation_rules
ORDER BY priority DESC, rule_source, context_type;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;