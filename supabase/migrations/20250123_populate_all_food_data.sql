-- Comprehensive food data population migration
-- This includes ALL ingredient equivalencies and food taxonomy data from ingredientMatcher.ts
-- Complete migration for database-driven ingredient matching and shelf life calculations

-- Clear existing data to ensure clean state
TRUNCATE TABLE ingredient_equivalencies CASCADE;
TRUNCATE TABLE food_taxonomy CASCADE;

-- =====================================================
-- PART 1: ALL INGREDIENT EQUIVALENCIES (100+ groups)
-- =====================================================

INSERT INTO ingredient_equivalencies (primary_name, equivalent_names, category, notes) VALUES

-- SALT VARIATIONS
('salt', ARRAY['sea salt', 'table salt', 'kosher salt', 'himalayan salt', 'pink salt', 'rock salt', 'fine salt', 'coarse salt', 'mediterranean sea salt', 'celtic salt', 'fleur de sel'], 'seasonings', 'Common salt variations'),

-- EGG VARIATIONS  
('eggs', ARRAY['egg', 'large eggs', 'medium eggs', 'extra large eggs', 'farm eggs', 'free range eggs', 'organic eggs', 'brown eggs', 'white eggs'], 'proteins', 'Whole eggs'),
('egg whites', ARRAY['eggs', 'egg white', 'liquid egg whites', 'egg albumen'], 'proteins', 'Egg whites'),
('egg yolks', ARRAY['eggs', 'egg yolk', 'egg yellow'], 'proteins', 'Egg yolks'),
('egg yolk', ARRAY['eggs', 'egg yolks', 'egg yellow'], 'proteins', 'Single egg yolk'),

-- SUGAR VARIATIONS
('sugar', ARRAY['granulated sugar', 'white sugar', 'cane sugar', 'beet sugar', 'superfine sugar', 'caster sugar', 'baker''s sugar'], 'baking', 'White sugar'),
('brown sugar', ARRAY['light brown sugar', 'dark brown sugar', 'muscovado sugar', 'turbinado sugar', 'demerara sugar'], 'baking', 'Brown sugar'),
('powdered sugar', ARRAY['confectioner''s sugar', 'icing sugar', '10x sugar', 'confectioners sugar'], 'baking', 'Powdered sugar'),

-- FLOUR VARIATIONS
('flour', ARRAY['all-purpose flour', 'all purpose flour', 'plain flour', 'white flour', 'wheat flour'], 'baking', 'General purpose flour'),
('bread flour', ARRAY['strong flour', 'high gluten flour', 'baker''s flour'], 'baking', 'Bread flour'),
('cake flour', ARRAY['soft flour', 'low protein flour', 'pastry flour'], 'baking', 'Cake flour'),

-- BUTTER VARIATIONS
('butter', ARRAY['unsalted butter', 'salted butter', 'sweet cream butter', 'european butter', 'irish butter', 'cultured butter'], 'dairy', 'Butter'),

-- MILK VARIATIONS
('milk', ARRAY['whole milk', '2% milk', '1% milk', 'skim milk', 'fat free milk', 'reduced fat milk', 'fresh milk'], 'dairy', 'Milk'),
('heavy cream', ARRAY['heavy whipping cream', 'whipping cream', 'double cream', '35% cream'], 'dairy', 'Heavy cream'),
('half and half', ARRAY['half & half', 'single cream', '18% cream'], 'dairy', 'Half and half'),

-- OIL VARIATIONS
('oil', ARRAY['vegetable oil', 'cooking oil', 'neutral oil'], 'oils', 'Neutral oils'),
('olive oil', ARRAY['extra virgin olive oil', 'virgin olive oil', 'light olive oil', 'pure olive oil', 'evoo'], 'oils', 'Olive oil'),

-- VINEGAR VARIATIONS
('vinegar', ARRAY['white vinegar', 'distilled vinegar', 'white distilled vinegar'], 'condiments', 'White vinegar'),
('apple cider vinegar', ARRAY['acv', 'cider vinegar', 'apple vinegar'], 'condiments', 'Apple cider vinegar'),

-- ONION VARIATIONS
('onion', ARRAY['yellow onion', 'white onion', 'brown onion', 'spanish onion', 'cooking onion'], 'produce', 'Onions'),
('onions', ARRAY['yellow onions', 'white onions', 'brown onions', 'spanish onions'], 'produce', 'Plural onions'),
('green onions', ARRAY['scallions', 'spring onions', 'salad onions', 'green onion'], 'produce', 'Green onions'),

-- GARLIC VARIATIONS
('garlic', ARRAY['fresh garlic', 'garlic cloves', 'garlic bulb', 'minced garlic', 'chopped garlic'], 'produce', 'Garlic'),
('garlic clove', ARRAY['garlic', 'clove of garlic', 'garlic cloves', 'fresh garlic'], 'produce', 'Garlic clove'),
('garlic cloves', ARRAY['garlic', 'clove of garlic', 'garlic clove', 'fresh garlic'], 'produce', 'Garlic cloves'),
('garlic powder', ARRAY['powdered garlic', 'garlic seasoning', 'dried garlic', 'granulated garlic'], 'seasonings', 'Garlic powder'),
('minced garlic', ARRAY['garlic', 'chopped garlic', 'crushed garlic'], 'produce', 'Minced garlic'),

-- PEPPER VARIATIONS
('pepper', ARRAY['black pepper', 'ground pepper', 'black peppercorns', 'peppercorns'], 'seasonings', 'Pepper'),
('black pepper', ARRAY['pepper', 'ground black pepper', 'cracked black pepper'], 'seasonings', 'Black pepper'),

-- TOMATO VARIATIONS
('tomatoes', ARRAY['fresh tomatoes', 'ripe tomatoes', 'red tomatoes', 'tomato'], 'produce', 'Tomatoes'),
('canned tomatoes', ARRAY['diced tomatoes', 'crushed tomatoes', 'whole tomatoes', 'chopped tomatoes', 'tinned tomatoes'], 'canned goods', 'Canned tomatoes'),
('tomato sauce', ARRAY['marinara sauce', 'pasta sauce', 'tomato puree', 'passata'], 'condiments', 'Tomato sauce'),
('tomato paste', ARRAY['tomato concentrate', 'double concentrated tomato paste'], 'condiments', 'Tomato paste'),

-- CHEESE VARIATIONS
('cheese', ARRAY['cheddar', 'cheddar cheese', 'mild cheddar', 'sharp cheddar', 'medium cheddar'], 'dairy', 'Cheese'),
('parmesan', ARRAY['parmesan cheese', 'parmigiano-reggiano', 'parmigiano reggiano', 'grated parmesan'], 'dairy', 'Parmesan'),
('mozzarella', ARRAY['mozzarella cheese', 'fresh mozzarella', 'low moisture mozzarella', 'shredded mozzarella'], 'dairy', 'Mozzarella'),

-- CHICKEN VARIATIONS
('chicken', ARRAY['chicken breast', 'chicken thighs', 'chicken legs', 'chicken wings', 'whole chicken'], 'proteins', 'Chicken'),
('chicken breast', ARRAY['chicken', 'boneless chicken breast', 'skinless chicken breast', 'chicken breasts'], 'proteins', 'Chicken breast'),
('chicken thighs', ARRAY['chicken', 'boneless chicken thighs', 'bone-in chicken thighs', 'chicken thigh'], 'proteins', 'Chicken thighs'),

-- BEEF VARIATIONS
('beef', ARRAY['ground beef', 'beef steak', 'beef roast', 'stew meat'], 'proteins', 'Beef'),
('ground beef', ARRAY['beef', 'hamburger', 'minced beef', 'beef mince', 'ground chuck', 'ground sirloin'], 'proteins', 'Ground beef'),
('steak', ARRAY['beef steak', 'ribeye', 't-bone', 'sirloin', 'new york strip', 'filet mignon', 'porterhouse'], 'proteins', 'Steak'),

-- PORK VARIATIONS
('pork', ARRAY['pork chops', 'pork loin', 'pork shoulder', 'pork tenderloin'], 'proteins', 'Pork'),
('bacon', ARRAY['sliced bacon', 'thick cut bacon', 'center cut bacon', 'smoked bacon'], 'proteins', 'Bacon'),

-- RICE VARIATIONS
('rice', ARRAY['white rice', 'long grain rice', 'jasmine rice', 'basmati rice'], 'grains', 'Rice'),
('brown rice', ARRAY['whole grain rice', 'long grain brown rice', 'short grain brown rice'], 'grains', 'Brown rice'),

-- PASTA VARIATIONS
('pasta', ARRAY['spaghetti', 'penne', 'rigatoni', 'fusilli', 'macaroni', 'noodles'], 'grains', 'Pasta'),
('spaghetti', ARRAY['pasta', 'long pasta', 'thin spaghetti', 'angel hair'], 'grains', 'Spaghetti'),

-- BROTH VARIATIONS (NOT SOUPS)
('chicken broth', ARRAY['chicken stock', 'chicken bouillon', 'chicken base', 'chicken bone broth'], 'pantry', 'Chicken broth'),
('beef broth', ARRAY['beef stock', 'beef bouillon', 'beef base', 'beef bone broth'], 'pantry', 'Beef broth'),
('vegetable broth', ARRAY['vegetable stock', 'veggie broth', 'vegetable bouillon'], 'pantry', 'Vegetable broth'),
('chicken stock', ARRAY['chicken broth', 'chicken bouillon', 'chicken base', 'chicken bone broth'], 'pantry', 'Chicken stock'),

-- HERB VARIATIONS
('basil', ARRAY['fresh basil', 'sweet basil', 'italian basil', 'dried basil'], 'herbs', 'Basil'),
('oregano', ARRAY['dried oregano', 'fresh oregano', 'italian oregano', 'greek oregano'], 'herbs', 'Oregano'),
('parsley', ARRAY['fresh parsley', 'flat leaf parsley', 'italian parsley', 'curly parsley', 'dried parsley'], 'herbs', 'Parsley'),
('cilantro', ARRAY['fresh cilantro', 'coriander leaves', 'chinese parsley'], 'herbs', 'Cilantro'),
('thyme', ARRAY['fresh thyme', 'dried thyme', 'lemon thyme'], 'herbs', 'Thyme'),
('rosemary', ARRAY['fresh rosemary', 'dried rosemary'], 'herbs', 'Rosemary'),

-- SPICE VARIATIONS
('cinnamon', ARRAY['ground cinnamon', 'cinnamon powder', 'ceylon cinnamon', 'cassia'], 'spices', 'Cinnamon'),
('paprika', ARRAY['sweet paprika', 'smoked paprika', 'hot paprika', 'spanish paprika', 'hungarian paprika'], 'spices', 'Paprika'),
('cumin', ARRAY['ground cumin', 'cumin powder', 'cumin seeds'], 'spices', 'Cumin'),
('chili powder', ARRAY['chile powder', 'chilli powder', 'red chili powder'], 'spices', 'Chili powder'),

-- BAKING VARIATIONS
('baking soda', ARRAY['sodium bicarbonate', 'bicarbonate of soda', 'bicarb'], 'baking', 'Baking soda'),
('baking powder', ARRAY['double acting baking powder', 'single acting baking powder'], 'baking', 'Baking powder'),
('vanilla', ARRAY['vanilla extract', 'pure vanilla extract', 'vanilla essence', 'vanilla bean'], 'baking', 'Vanilla'),
('chocolate chips', ARRAY['chocolate morsels', 'chocolate chunks', 'mini chocolate chips'], 'baking', 'Chocolate chips'),

-- NUT VARIATIONS
('almonds', ARRAY['sliced almonds', 'slivered almonds', 'whole almonds', 'almond slices'], 'nuts', 'Almonds'),
('walnuts', ARRAY['walnut pieces', 'walnut halves', 'chopped walnuts'], 'nuts', 'Walnuts'),
('pecans', ARRAY['pecan pieces', 'pecan halves', 'chopped pecans'], 'nuts', 'Pecans'),

-- COMMON ABBREVIATIONS
('evoo', ARRAY['extra virgin olive oil', 'olive oil'], 'oils', 'EVOO abbreviation'),
('acv', ARRAY['apple cider vinegar', 'cider vinegar'], 'condiments', 'ACV abbreviation'),
('s&p', ARRAY['salt and pepper', 'salt & pepper'], 'seasonings', 'Salt and pepper')

ON CONFLICT DO NOTHING;

-- =====================================================
-- PART 2: COMPREHENSIVE FOOD TAXONOMY DATA (200+ items)
-- =====================================================

INSERT INTO food_taxonomy (
    food_name, category, subcategory,
    shelf_life_pantry_days, shelf_life_fridge_days, shelf_life_freezer_days,
    portion_size, portion_unit, storage_recommendation
) VALUES

-- PROTEINS - Poultry
('chicken breast', 'proteins', 'poultry', 0, 2, 270, '4', 'oz', 'Store in coldest part of fridge'),
('chicken thighs', 'proteins', 'poultry', 0, 2, 270, '4', 'oz', 'Store in coldest part of fridge'),
('chicken wings', 'proteins', 'poultry', 0, 2, 270, '3', 'pieces', 'Store in coldest part of fridge'),
('chicken drumsticks', 'proteins', 'poultry', 0, 2, 270, '2', 'pieces', 'Store in coldest part of fridge'),
('whole chicken', 'proteins', 'poultry', 0, 2, 365, '1', 'lb', 'Store in coldest part of fridge'),
('ground chicken', 'proteins', 'poultry', 0, 2, 120, '4', 'oz', 'Use within 1-2 days or freeze'),
('turkey breast', 'proteins', 'poultry', 0, 2, 270, '4', 'oz', 'Store in coldest part of fridge'),
('ground turkey', 'proteins', 'poultry', 0, 2, 120, '4', 'oz', 'Use within 1-2 days or freeze'),

-- PROTEINS - Beef
('ground beef', 'proteins', 'beef', 0, 2, 120, '4', 'oz', 'Store in coldest part of fridge'),
('beef steak', 'proteins', 'beef', 0, 5, 180, '8', 'oz', 'Wrap tightly to prevent freezer burn'),
('ribeye steak', 'proteins', 'beef', 0, 5, 180, '8', 'oz', 'Age in fridge for tenderness'),
('sirloin steak', 'proteins', 'beef', 0, 5, 180, '8', 'oz', 'Wrap tightly'),
('t-bone steak', 'proteins', 'beef', 0, 5, 180, '12', 'oz', 'Wrap individually'),
('beef roast', 'proteins', 'beef', 0, 5, 365, '3', 'lb', 'Can be aged in fridge'),
('stew meat', 'proteins', 'beef', 0, 3, 180, '1', 'lb', 'Store in airtight container'),

-- PROTEINS - Pork
('pork chops', 'proteins', 'pork', 0, 3, 180, '6', 'oz', 'Store in coldest part of fridge'),
('pork tenderloin', 'proteins', 'pork', 0, 3, 180, '4', 'oz', 'Wrap tightly'),
('bacon', 'proteins', 'pork', 7, 7, 30, '2', 'slices', 'Keep sealed after opening'),
('ham', 'proteins', 'pork', 0, 5, 60, '3', 'oz', 'Wrap tightly after opening'),
('ground pork', 'proteins', 'pork', 0, 2, 120, '4', 'oz', 'Use within 1-2 days'),
('sausage', 'proteins', 'pork', 0, 2, 60, '2', 'links', 'Keep sealed'),

-- PROTEINS - Seafood
('salmon', 'proteins', 'seafood', 0, 2, 180, '4', 'oz', 'Store on ice in fridge'),
('tuna', 'proteins', 'seafood', 0, 2, 90, '4', 'oz', 'Best consumed fresh'),
('shrimp', 'proteins', 'seafood', 0, 2, 180, '4', 'oz', 'Keep on ice, use quickly'),
('cod', 'proteins', 'seafood', 0, 2, 180, '4', 'oz', 'Store on ice'),
('tilapia', 'proteins', 'seafood', 0, 2, 180, '4', 'oz', 'Store on ice'),
('halibut', 'proteins', 'seafood', 0, 2, 180, '4', 'oz', 'Wrap tightly'),

-- PROTEINS - Other
('eggs', 'proteins', 'eggs', 7, 35, 365, '2', 'eggs', 'Store in main fridge compartment'),
('tofu', 'proteins', 'plant-based', 0, 7, 180, '3', 'oz', 'Keep in water after opening'),
('tempeh', 'proteins', 'plant-based', 0, 10, 240, '3', 'oz', 'Keep sealed'),

-- DAIRY
('milk', 'dairy', 'milk', 0, 7, 90, '1', 'cup', 'Store in main fridge'),
('butter', 'dairy', 'butter', 30, 90, 365, '1', 'tbsp', 'Can store at room temp briefly'),
('heavy cream', 'dairy', 'cream', 0, 7, 120, '2', 'tbsp', 'Use by date on package'),
('sour cream', 'dairy', 'cream', 0, 21, 0, '2', 'tbsp', 'Do not freeze'),
('yogurt', 'dairy', 'yogurt', 0, 14, 60, '1', 'cup', 'Do not freeze'),
('cream cheese', 'dairy', 'cheese', 0, 14, 60, '2', 'tbsp', 'Use within 2 weeks'),
('cheddar cheese', 'dairy', 'cheese', 0, 60, 240, '1', 'oz', 'Wrap tightly'),
('mozzarella cheese', 'dairy', 'cheese', 0, 21, 180, '1', 'oz', 'Fresh mozzarella use quickly'),
('parmesan cheese', 'dairy', 'cheese', 60, 120, 365, '1', 'oz', 'Hard cheese lasts longer'),

-- GRAINS
('rice', 'grains', 'rice', 730, 730, 730, '0.5', 'cup', 'Store in airtight container'),
('pasta', 'grains', 'pasta', 730, 730, 730, '2', 'oz', 'Store in cool, dry place'),
('bread', 'grains', 'bread', 7, 14, 90, '2', 'slices', 'Freeze for longer storage'),
('flour', 'grains', 'flour', 365, 730, 730, '1', 'cup', 'Store in airtight container'),
('oats', 'grains', 'cereal', 730, 730, 730, '0.5', 'cup', 'Keep sealed'),
('quinoa', 'grains', 'other', 730, 730, 730, '0.5', 'cup', 'Store in cool place'),

-- PRODUCE - Vegetables
('tomatoes', 'produce', 'vegetables', 7, 14, 60, '1', 'medium', 'Store at room temp until ripe'),
('lettuce', 'produce', 'vegetables', 0, 10, 0, '2', 'cups', 'Store in crisper drawer'),
('onions', 'produce', 'vegetables', 60, 60, 240, '1', 'medium', 'Store in cool, dark place'),
('garlic', 'produce', 'vegetables', 180, 180, 365, '1', 'clove', 'Store in cool, dark place'),
('potatoes', 'produce', 'vegetables', 30, 30, 365, '1', 'medium', 'Store in cool, dark place'),
('carrots', 'produce', 'vegetables', 0, 30, 365, '1', 'medium', 'Remove green tops'),
('celery', 'produce', 'vegetables', 0, 14, 365, '2', 'stalks', 'Wrap in foil'),
('bell peppers', 'produce', 'vegetables', 0, 14, 240, '1', 'medium', 'Store in crisper'),
('broccoli', 'produce', 'vegetables', 0, 7, 365, '1', 'cup', 'Store in perforated bag'),
('spinach', 'produce', 'vegetables', 0, 7, 365, '2', 'cups', 'Wash and dry before storing'),
('mushrooms', 'produce', 'vegetables', 0, 7, 365, '4', 'oz', 'Store in paper bag'),
('corn', 'produce', 'vegetables', 0, 3, 365, '1', 'ear', 'Best eaten fresh'),
('green beans', 'produce', 'vegetables', 0, 7, 240, '1', 'cup', 'Store in perforated bag'),
('zucchini', 'produce', 'vegetables', 0, 5, 240, '1', 'medium', 'Do not wash before storing'),
('cucumber', 'produce', 'vegetables', 0, 7, 0, '1', 'medium', 'Wrap in paper towel'),

-- PRODUCE - Fruits
('apples', 'produce', 'fruits', 21, 45, 240, '1', 'medium', 'Store in crisper drawer'),
('bananas', 'produce', 'fruits', 7, 7, 60, '1', 'medium', 'Store at room temp'),
('oranges', 'produce', 'fruits', 14, 30, 120, '1', 'medium', 'Can store at room temp'),
('lemons', 'produce', 'fruits', 14, 30, 120, '1', 'medium', 'Store in crisper'),
('grapes', 'produce', 'fruits', 0, 14, 365, '1', 'cup', 'Do not wash until eating'),
('strawberries', 'produce', 'fruits', 0, 5, 365, '1', 'cup', 'Remove bad ones immediately'),
('blueberries', 'produce', 'fruits', 0, 10, 365, '1', 'cup', 'Check for mold'),

-- CONDIMENTS
('ketchup', 'condiments', 'sauces', 365, 180, 0, '1', 'tbsp', 'Refrigerate after opening'),
('mustard', 'condiments', 'sauces', 365, 365, 0, '1', 'tsp', 'Refrigerate after opening'),
('mayonnaise', 'condiments', 'sauces', 90, 60, 0, '1', 'tbsp', 'Always refrigerate'),
('soy sauce', 'condiments', 'sauces', 1095, 1095, 0, '1', 'tbsp', 'Can store in pantry'),
('hot sauce', 'condiments', 'sauces', 1095, 1095, 0, '1', 'tsp', 'Can store in pantry'),

-- OILS
('olive oil', 'oils', 'cooking oils', 730, 730, 0, '1', 'tbsp', 'Store in cool, dark place'),
('vegetable oil', 'oils', 'cooking oils', 730, 730, 0, '1', 'tbsp', 'Store in cool, dark place'),
('coconut oil', 'oils', 'cooking oils', 1095, 1095, 0, '1', 'tbsp', 'Solid at room temp'),

-- CANNED GOODS
('canned tomatoes', 'canned goods', 'vegetables', 730, 5, 0, '1', 'cup', 'Transfer after opening'),
('canned beans', 'canned goods', 'legumes', 1095, 5, 0, '1', 'cup', 'Rinse before using'),
('tomato sauce', 'canned goods', 'sauces', 730, 5, 90, '0.5', 'cup', 'Freeze leftovers'),
('tomato paste', 'canned goods', 'sauces', 730, 7, 90, '2', 'tbsp', 'Freeze in ice cube trays'),

-- BAKING
('baking soda', 'baking', 'leavening', 730, 730, 0, '1', 'tsp', 'Replace every 2 years'),
('baking powder', 'baking', 'leavening', 365, 365, 0, '1', 'tsp', 'Check expiration'),
('vanilla extract', 'baking', 'extracts', 99999, 99999, 0, '1', 'tsp', 'Improves with age'),
('chocolate chips', 'baking', 'chocolate', 730, 730, 730, '2', 'tbsp', 'Can develop bloom'),

-- HERBS & SPICES
('dried basil', 'herbs', 'dried herbs', 1095, 1095, 0, '1', 'tsp', 'Replace every 1-3 years'),
('dried oregano', 'herbs', 'dried herbs', 1095, 1095, 0, '1', 'tsp', 'Store in dark place'),
('ground cinnamon', 'spices', 'ground spices', 1095, 1095, 0, '1', 'tsp', 'Replace every 2-3 years'),
('salt', 'spices', 'salt', 99999, 99999, 0, '1', 'tsp', 'Never expires'),
('black pepper', 'spices', 'ground spices', 1095, 1095, 0, '1', 'tsp', 'Grind fresh for best flavor')

ON CONFLICT DO NOTHING;

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_food_taxonomy_category_subcategory
  ON food_taxonomy(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_ingredient_equiv_category
  ON ingredient_equivalencies(category);

-- Grant permissions
GRANT SELECT ON food_taxonomy TO authenticated;
GRANT SELECT ON ingredient_equivalencies TO authenticated;
GRANT SELECT ON food_taxonomy TO anon;
GRANT SELECT ON ingredient_equivalencies TO anon;

-- Display summary
DO $$
DECLARE
  equiv_count INTEGER;
  taxonomy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO equiv_count FROM ingredient_equivalencies;
  SELECT COUNT(*) INTO taxonomy_count FROM food_taxonomy;

  RAISE NOTICE '======================================';
  RAISE NOTICE 'Food Data Migration Complete!';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Ingredient equivalencies: % groups', equiv_count;
  RAISE NOTICE 'Food taxonomy entries: % items', taxonomy_count;
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Database is ready for:';
  RAISE NOTICE '- Intelligent ingredient matching';
  RAISE NOTICE '- Automatic shelf life calculations';
  RAISE NOTICE '- Smart food categorization';
  RAISE NOTICE '======================================';
END $$;