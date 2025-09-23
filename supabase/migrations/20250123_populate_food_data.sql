-- Populate initial food taxonomy and ingredient data
-- This is a subset - we can add more via admin interface later

-- Insert common ingredient equivalencies
INSERT INTO ingredient_equivalencies (primary_name, equivalent_names, category) VALUES
('salt', ARRAY['sea salt', 'kosher salt', 'table salt', 'iodized salt', 'himalayan pink salt', 'celtic sea salt', 'fleur de sel', 'rock salt', 'fine salt', 'coarse salt', 'salt flakes', 'seasoning salt', 'garlic salt', 'onion salt'], 'seasonings'),
('pepper', ARRAY['black pepper', 'white pepper', 'peppercorns', 'ground pepper', 'cracked pepper', 'pink peppercorns', 'green peppercorns', 'pepper blend', 'fresh ground pepper', 'fine ground pepper'], 'seasonings'),
('sugar', ARRAY['granulated sugar', 'white sugar', 'cane sugar', 'beet sugar', 'caster sugar', 'superfine sugar', 'powdered sugar', 'confectioners sugar', 'icing sugar', 'turbinado sugar', 'raw sugar', 'demerara sugar'], 'baking'),
('butter', ARRAY['unsalted butter', 'salted butter', 'sweet butter', 'cultured butter', 'european butter', 'irish butter', 'clarified butter', 'ghee', 'butter sticks', 'whipped butter'], 'dairy'),
('oil', ARRAY['vegetable oil', 'canola oil', 'corn oil', 'sunflower oil', 'safflower oil', 'grapeseed oil', 'cooking oil', 'neutral oil', 'frying oil'], 'oils'),
('olive oil', ARRAY['extra virgin olive oil', 'virgin olive oil', 'light olive oil', 'pure olive oil', 'evoo', 'cold pressed olive oil', 'first press olive oil'], 'oils'),
('eggs', ARRAY['large eggs', 'medium eggs', 'extra large eggs', 'jumbo eggs', 'farm eggs', 'free range eggs', 'organic eggs', 'brown eggs', 'white eggs', 'cage free eggs', 'pasture raised eggs', 'whole eggs', 'fresh eggs'], 'dairy'),
('milk', ARRAY['whole milk', '2% milk', '1% milk', 'skim milk', 'nonfat milk', 'low fat milk', 'reduced fat milk', 'homogenized milk', 'fresh milk', 'dairy milk', 'cows milk'], 'dairy'),
('flour', ARRAY['all-purpose flour', 'all purpose flour', 'ap flour', 'plain flour', 'white flour', 'wheat flour', 'unbleached flour', 'bleached flour', 'enriched flour'], 'baking'),
('chicken', ARRAY['chicken breast', 'chicken breasts', 'chicken thighs', 'chicken legs', 'chicken wings', 'chicken drumsticks', 'boneless chicken', 'skinless chicken', 'chicken tenders', 'chicken cutlets', 'chicken pieces', 'whole chicken', 'rotisserie chicken'], 'proteins'),
('beef', ARRAY['ground beef', 'beef steak', 'sirloin', 'ribeye', 'tenderloin', 'chuck roast', 'beef roast', 'stew meat', 'beef chunks', 'hamburger', 'lean beef', 'beef mince'], 'proteins'),
('onion', ARRAY['yellow onion', 'white onion', 'red onion', 'sweet onion', 'vidalia onion', 'spanish onion', 'large onion', 'medium onion', 'small onion', 'diced onion', 'chopped onion', 'onions'], 'produce'),
('garlic', ARRAY['garlic cloves', 'minced garlic', 'chopped garlic', 'crushed garlic', 'fresh garlic', 'garlic bulb', 'garlic head', 'peeled garlic', 'whole garlic'], 'produce'),
('tomatoes', ARRAY['tomato', 'fresh tomatoes', 'roma tomatoes', 'plum tomatoes', 'cherry tomatoes', 'grape tomatoes', 'beefsteak tomatoes', 'vine tomatoes', 'heirloom tomatoes', 'ripe tomatoes', 'sliced tomatoes', 'diced tomatoes'], 'produce')
ON CONFLICT (primary_name) DO NOTHING;

-- Insert basic food taxonomy data (focusing on common items)
INSERT INTO food_taxonomy (
    food_name, category, subcategory,
    shelf_life_pantry_days, shelf_life_fridge_days, shelf_life_freezer_days,
    portion_size, portion_unit, storage_recommendation
) VALUES
-- Proteins
('chicken breast', 'proteins', 'poultry', 0, 2, 270, '4', 'oz', 'Store in coldest part of fridge'),
('ground beef', 'proteins', 'beef', 0, 2, 120, '4', 'oz', 'Store in coldest part of fridge'),
('eggs', 'proteins', 'eggs', 7, 35, 365, '2', 'eggs', 'Store in main fridge compartment'),
('salmon', 'proteins', 'seafood', 0, 2, 180, '4', 'oz', 'Store on ice in fridge'),

-- Dairy
('milk', 'dairy', 'milk', 0, 7, 90, '1', 'cup', 'Store in main fridge compartment'),
('butter', 'dairy', 'butter', 30, 90, 365, '1', 'tbsp', 'Can store at room temp if used quickly'),
('cheese', 'dairy', 'cheese', 0, 30, 180, '1', 'oz', 'Wrap tightly to prevent drying'),
('yogurt', 'dairy', 'yogurt', 0, 14, 60, '1', 'cup', 'Do not freeze'),

-- Grains
('rice', 'grains', 'rice', 730, 730, 730, '0.5', 'cup', 'Store in airtight container'),
('pasta', 'grains', 'pasta', 730, 730, 730, '2', 'oz', 'Store in cool, dry place'),
('bread', 'grains', 'bread', 7, 14, 90, '2', 'slices', 'Freeze for longer storage'),
('flour', 'grains', 'flour', 365, 730, 730, '1', 'cup', 'Store in airtight container'),

-- Produce
('tomatoes', 'produce', 'vegetables', 7, 14, 60, '1', 'medium', 'Store at room temp until ripe'),
('lettuce', 'produce', 'vegetables', 0, 10, 0, '2', 'cups', 'Store in crisper drawer'),
('onions', 'produce', 'vegetables', 60, 60, 240, '1', 'medium', 'Store in cool, dark, dry place'),
('potatoes', 'produce', 'vegetables', 30, 30, 365, '1', 'medium', 'Store in cool, dark place'),
('apples', 'produce', 'fruits', 21, 45, 240, '1', 'medium', 'Store in crisper drawer'),
('bananas', 'produce', 'fruits', 7, 7, 60, '1', 'medium', 'Store at room temp'),

-- Condiments
('ketchup', 'condiments', 'sauces', 365, 180, 0, '1', 'tbsp', 'Refrigerate after opening'),
('mustard', 'condiments', 'sauces', 365, 365, 0, '1', 'tsp', 'Refrigerate after opening'),
('mayonnaise', 'condiments', 'sauces', 90, 60, 0, '1', 'tbsp', 'Always refrigerate after opening'),

-- Oils & Vinegars
('olive oil', 'oils', 'cooking oils', 730, 730, 0, '1', 'tbsp', 'Store in cool, dark place'),
('vegetable oil', 'oils', 'cooking oils', 730, 730, 0, '1', 'tbsp', 'Store in cool, dark place'),
('vinegar', 'condiments', 'vinegars', 1095, 1095, 0, '1', 'tbsp', 'Store in pantry')
ON CONFLICT (food_name) DO NOTHING;

-- Create a function to migrate household food rules if they exist
CREATE OR REPLACE FUNCTION migrate_household_food_rules()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- This would migrate any existing household-specific rules
    -- Currently just a placeholder for future migration
    RAISE NOTICE 'Food data migration completed';
END;
$$;

-- Run the migration
SELECT migrate_household_food_rules();

-- Drop the temporary function
DROP FUNCTION IF EXISTS migrate_household_food_rules();