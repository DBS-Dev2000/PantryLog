-- Comprehensive food data population
-- This includes ALL ingredient equivalencies from the original system

-- Clear existing data first (for re-runs)
TRUNCATE TABLE ingredient_equivalencies CASCADE;
TRUNCATE TABLE food_taxonomy CASCADE;

-- Insert ALL ingredient equivalencies
INSERT INTO ingredient_equivalencies (primary_name, equivalent_names, category) VALUES
-- Basic seasonings
('salt', ARRAY['sea salt', 'kosher salt', 'table salt', 'iodized salt', 'himalayan pink salt', 'celtic sea salt', 'fleur de sel', 'rock salt', 'fine salt', 'coarse salt', 'mediterranean sea salt', 'gray salt', 'seasoned salt', 'garlic salt', 'onion salt', 'salt flakes', 'seasoning salt'], 'seasonings'),
('pepper', ARRAY['black pepper', 'white pepper', 'peppercorns', 'ground pepper', 'cracked pepper', 'pink peppercorns', 'green peppercorns', 'pepper blend', 'fresh ground pepper', 'fine ground pepper', 'coarse ground pepper', 'whole peppercorns', 'mixed peppercorns'], 'seasonings'),

-- Sugars
('sugar', ARRAY['granulated sugar', 'white sugar', 'cane sugar', 'beet sugar', 'caster sugar', 'superfine sugar', 'powdered sugar', 'confectioners sugar', 'icing sugar', 'turbinado sugar', 'raw sugar', 'demerara sugar', 'sugar in the raw', 'pure cane sugar'], 'baking'),
('brown sugar', ARRAY['light brown sugar', 'dark brown sugar', 'golden brown sugar', 'muscovado sugar', 'soft brown sugar', 'packed brown sugar'], 'baking'),

-- Dairy
('butter', ARRAY['unsalted butter', 'salted butter', 'sweet butter', 'cultured butter', 'european butter', 'irish butter', 'clarified butter', 'ghee', 'butter sticks', 'whipped butter', 'sweet cream butter', 'grass-fed butter', 'organic butter'], 'dairy'),
('milk', ARRAY['whole milk', '2% milk', '1% milk', 'skim milk', 'nonfat milk', 'low fat milk', 'reduced fat milk', 'homogenized milk', 'fresh milk', 'dairy milk', 'cows milk', '2 percent milk', '3.25% milk', 'vitamin d milk'], 'dairy'),
('cream', ARRAY['heavy cream', 'whipping cream', 'heavy whipping cream', 'double cream', 'single cream', 'light cream', 'table cream', 'fresh cream'], 'dairy'),
('sour cream', ARRAY['regular sour cream', 'light sour cream', 'full fat sour cream', 'cultured sour cream'], 'dairy'),
('yogurt', ARRAY['plain yogurt', 'greek yogurt', 'natural yogurt', 'whole milk yogurt', 'full fat yogurt', 'low fat yogurt'], 'dairy'),
('cheese', ARRAY['shredded cheese', 'grated cheese', 'cheese blend', 'mixed cheese'], 'dairy'),
('cheddar', ARRAY['cheddar cheese', 'sharp cheddar', 'mild cheddar', 'medium cheddar', 'extra sharp cheddar', 'white cheddar', 'yellow cheddar', 'aged cheddar'], 'dairy'),
('mozzarella', ARRAY['mozzarella cheese', 'whole milk mozzarella', 'part skim mozzarella', 'fresh mozzarella', 'low moisture mozzarella', 'shredded mozzarella'], 'dairy'),
('parmesan', ARRAY['parmesan cheese', 'parmigiano reggiano', 'grated parmesan', 'shredded parmesan', 'fresh parmesan', 'parmigiano'], 'dairy'),
('eggs', ARRAY['large eggs', 'medium eggs', 'extra large eggs', 'jumbo eggs', 'farm eggs', 'free range eggs', 'organic eggs', 'brown eggs', 'white eggs', 'cage free eggs', 'pasture raised eggs', 'whole eggs', 'fresh eggs', 'grade a eggs', 'farm fresh eggs'], 'dairy'),

-- Oils
('oil', ARRAY['vegetable oil', 'canola oil', 'corn oil', 'sunflower oil', 'safflower oil', 'grapeseed oil', 'cooking oil', 'neutral oil', 'frying oil', 'all-purpose oil'], 'oils'),
('olive oil', ARRAY['extra virgin olive oil', 'virgin olive oil', 'light olive oil', 'pure olive oil', 'evoo', 'cold pressed olive oil', 'first press olive oil', 'extra light olive oil', 'refined olive oil'], 'oils'),
('coconut oil', ARRAY['virgin coconut oil', 'refined coconut oil', 'unrefined coconut oil', 'organic coconut oil', 'cold pressed coconut oil'], 'oils'),
('sesame oil', ARRAY['toasted sesame oil', 'pure sesame oil', 'dark sesame oil', 'light sesame oil'], 'oils'),

-- Vinegars
('vinegar', ARRAY['white vinegar', 'distilled vinegar', 'distilled white vinegar', 'plain vinegar'], 'condiments'),
('apple cider vinegar', ARRAY['acv', 'cider vinegar', 'raw apple cider vinegar', 'unfiltered apple cider vinegar'], 'condiments'),
('balsamic vinegar', ARRAY['balsamic', 'aged balsamic vinegar', 'balsamic glaze', 'white balsamic vinegar'], 'condiments'),
('rice vinegar', ARRAY['rice wine vinegar', 'seasoned rice vinegar', 'unseasoned rice vinegar'], 'condiments'),
('red wine vinegar', ARRAY['red vinegar', 'wine vinegar'], 'condiments'),
('white wine vinegar', ARRAY['white vinegar', 'wine vinegar'], 'condiments'),

-- Flour and grains
('flour', ARRAY['all-purpose flour', 'all purpose flour', 'ap flour', 'plain flour', 'white flour', 'wheat flour', 'unbleached flour', 'bleached flour', 'enriched flour', 'general purpose flour'], 'baking'),
('bread flour', ARRAY['strong flour', 'high gluten flour', 'strong white flour'], 'baking'),
('whole wheat flour', ARRAY['whole grain flour', 'wholemeal flour', 'graham flour', 'whole wheat'], 'baking'),
('self-rising flour', ARRAY['self raising flour', 'sr flour'], 'baking'),
('cake flour', ARRAY['soft flour', 'pastry flour'], 'baking'),

-- Vegetables
('onion', ARRAY['yellow onion', 'white onion', 'red onion', 'sweet onion', 'vidalia onion', 'spanish onion', 'large onion', 'medium onion', 'small onion', 'diced onion', 'chopped onion', 'onions', 'cooking onion', 'brown onion'], 'produce'),
('garlic', ARRAY['garlic cloves', 'minced garlic', 'chopped garlic', 'crushed garlic', 'fresh garlic', 'garlic bulb', 'garlic head', 'peeled garlic', 'whole garlic', 'pressed garlic', 'garlic paste'], 'produce'),
('tomato', ARRAY['tomatoes', 'fresh tomatoes', 'roma tomatoes', 'plum tomatoes', 'cherry tomatoes', 'grape tomatoes', 'beefsteak tomatoes', 'vine tomatoes', 'heirloom tomatoes', 'ripe tomatoes', 'sliced tomatoes', 'diced tomatoes', 'campari tomatoes'], 'produce'),
('bell pepper', ARRAY['bell peppers', 'sweet pepper', 'capsicum', 'red bell pepper', 'green bell pepper', 'yellow bell pepper', 'orange bell pepper', 'colored peppers'], 'produce'),
('carrot', ARRAY['carrots', 'baby carrots', 'carrot sticks', 'shredded carrots', 'julienned carrots', 'diced carrots', 'sliced carrots'], 'produce'),
('celery', ARRAY['celery stalks', 'celery sticks', 'celery ribs', 'diced celery', 'chopped celery', 'celery hearts'], 'produce'),
('potato', ARRAY['potatoes', 'russet potatoes', 'yukon gold potatoes', 'red potatoes', 'white potatoes', 'new potatoes', 'baby potatoes', 'fingerling potatoes'], 'produce'),
('lettuce', ARRAY['salad greens', 'mixed greens', 'romaine lettuce', 'iceberg lettuce', 'green leaf lettuce', 'red leaf lettuce', 'butter lettuce'], 'produce'),
('spinach', ARRAY['fresh spinach', 'baby spinach', 'spinach leaves', 'frozen spinach', 'chopped spinach'], 'produce'),
('broccoli', ARRAY['broccoli florets', 'fresh broccoli', 'broccoli crowns', 'frozen broccoli', 'broccoli heads'], 'produce'),
('cauliflower', ARRAY['cauliflower florets', 'fresh cauliflower', 'cauliflower head', 'frozen cauliflower'], 'produce'),
('mushroom', ARRAY['mushrooms', 'button mushrooms', 'white mushrooms', 'baby bella mushrooms', 'cremini mushrooms', 'portobello mushrooms', 'shiitake mushrooms', 'sliced mushrooms'], 'produce'),
('ginger', ARRAY['fresh ginger', 'ginger root', 'ground ginger', 'ginger paste', 'minced ginger', 'grated ginger'], 'produce'),
('green onion', ARRAY['scallions', 'spring onions', 'green onions', 'salad onions'], 'produce'),
('shallot', ARRAY['shallots', 'french shallots', 'eschalots'], 'produce'),

-- Proteins - Chicken
('chicken', ARRAY['chicken breast', 'chicken breasts', 'chicken thighs', 'chicken legs', 'chicken wings', 'chicken drumsticks', 'boneless chicken', 'skinless chicken', 'chicken tenders', 'chicken cutlets', 'chicken pieces', 'whole chicken', 'rotisserie chicken', 'chicken meat', 'poultry'], 'proteins'),
('chicken breast', ARRAY['boneless skinless chicken breast', 'chicken breasts', 'boneless chicken breast', 'skinless chicken breast', 'chicken cutlets', 'chicken tenders'], 'proteins'),
('chicken thigh', ARRAY['chicken thighs', 'boneless chicken thighs', 'skinless chicken thighs', 'boneless skinless chicken thighs', 'dark meat chicken'], 'proteins'),

-- Proteins - Beef
('beef', ARRAY['ground beef', 'beef steak', 'beef roast', 'stew meat', 'beef chunks', 'beef cubes'], 'proteins'),
('ground beef', ARRAY['beef', 'hamburger', 'minced beef', 'beef mince', 'ground chuck', 'ground sirloin', 'ground round', 'lean ground beef', '80/20 ground beef', '85/15 ground beef', '90/10 ground beef', 'hamburger meat'], 'proteins'),
('steak', ARRAY['beef steak', 'ribeye', 't-bone', 'sirloin', 'new york strip', 'filet mignon', 'porterhouse', 'strip steak', 'tenderloin', 'flank steak', 'skirt steak'], 'proteins'),

-- Proteins - Pork
('pork', ARRAY['pork chops', 'pork loin', 'pork shoulder', 'pork tenderloin', 'pork roast', 'pork meat'], 'proteins'),
('bacon', ARRAY['sliced bacon', 'thick cut bacon', 'center cut bacon', 'smoked bacon', 'crispy bacon', 'bacon strips', 'bacon pieces'], 'proteins'),
('ham', ARRAY['sliced ham', 'diced ham', 'ham steak', 'spiral ham', 'honey ham', 'smoked ham', 'cubed ham'], 'proteins'),
('sausage', ARRAY['ground sausage', 'italian sausage', 'pork sausage', 'breakfast sausage', 'sausage links', 'sausage patties'], 'proteins'),

-- Proteins - Fish & Seafood
('salmon', ARRAY['salmon fillet', 'salmon filet', 'fresh salmon', 'atlantic salmon', 'wild salmon', 'salmon steaks'], 'proteins'),
('tuna', ARRAY['tuna fish', 'canned tuna', 'tuna steaks', 'ahi tuna', 'yellowfin tuna', 'albacore tuna'], 'proteins'),
('shrimp', ARRAY['prawns', 'large shrimp', 'jumbo shrimp', 'medium shrimp', 'small shrimp', 'peeled shrimp', 'deveined shrimp', 'cooked shrimp', 'raw shrimp'], 'proteins'),
('fish', ARRAY['white fish', 'fish fillet', 'fish filet', 'fresh fish', 'frozen fish'], 'proteins'),

-- Rice and Pasta
('rice', ARRAY['white rice', 'long grain rice', 'jasmine rice', 'basmati rice', 'medium grain rice', 'short grain rice', 'converted rice', 'parboiled rice'], 'grains'),
('brown rice', ARRAY['whole grain rice', 'long grain brown rice', 'short grain brown rice', 'brown basmati rice'], 'grains'),
('pasta', ARRAY['spaghetti', 'penne', 'rigatoni', 'fusilli', 'macaroni', 'noodles', 'elbow macaroni', 'rotini', 'farfalle', 'linguine', 'fettuccine', 'angel hair', 'bowtie pasta'], 'grains'),
('spaghetti', ARRAY['pasta', 'long pasta', 'thin spaghetti', 'angel hair', 'spaghettini', 'linguine'], 'grains'),

-- Broths and stocks (EXPLICITLY NOT SOUPS)
('chicken broth', ARRAY['chicken stock', 'chicken bouillon', 'chicken base', 'chicken bone broth'], 'liquids'),
('beef broth', ARRAY['beef stock', 'beef bouillon', 'beef base', 'beef bone broth'], 'liquids'),
('vegetable broth', ARRAY['vegetable stock', 'veggie broth', 'vegetable bouillon', 'veggie stock'], 'liquids'),

-- Herbs
('basil', ARRAY['fresh basil', 'sweet basil', 'italian basil', 'dried basil', 'basil leaves', 'thai basil'], 'herbs'),
('oregano', ARRAY['dried oregano', 'fresh oregano', 'italian oregano', 'greek oregano', 'mexican oregano'], 'herbs'),
('parsley', ARRAY['fresh parsley', 'flat leaf parsley', 'italian parsley', 'curly parsley', 'dried parsley', 'parsley flakes'], 'herbs'),
('cilantro', ARRAY['fresh cilantro', 'coriander leaves', 'chinese parsley', 'coriander'], 'herbs'),
('thyme', ARRAY['fresh thyme', 'dried thyme', 'lemon thyme', 'thyme leaves'], 'herbs'),
('rosemary', ARRAY['fresh rosemary', 'dried rosemary', 'rosemary leaves'], 'herbs'),
('sage', ARRAY['fresh sage', 'dried sage', 'rubbed sage', 'sage leaves'], 'herbs'),
('dill', ARRAY['fresh dill', 'dried dill', 'dill weed'], 'herbs'),
('mint', ARRAY['fresh mint', 'peppermint', 'spearmint', 'mint leaves'], 'herbs'),
('bay leaf', ARRAY['bay leaves', 'dried bay leaves', 'fresh bay leaves'], 'herbs'),
('chives', ARRAY['fresh chives', 'dried chives', 'chive'], 'herbs'),
('tarragon', ARRAY['fresh tarragon', 'dried tarragon'], 'herbs'),

-- Spices
('cinnamon', ARRAY['ground cinnamon', 'cinnamon powder', 'ceylon cinnamon', 'cassia', 'cinnamon sticks'], 'spices'),
('paprika', ARRAY['sweet paprika', 'smoked paprika', 'hot paprika', 'spanish paprika', 'hungarian paprika', 'regular paprika'], 'spices'),
('cumin', ARRAY['ground cumin', 'cumin powder', 'cumin seeds', 'whole cumin'], 'spices'),
('chili powder', ARRAY['chile powder', 'chilli powder', 'red chili powder', 'chipotle powder'], 'spices'),
('cayenne', ARRAY['cayenne pepper', 'ground cayenne', 'red pepper'], 'spices'),
('turmeric', ARRAY['ground turmeric', 'turmeric powder', 'fresh turmeric'], 'spices'),
('curry powder', ARRAY['curry', 'madras curry powder', 'mild curry powder'], 'spices'),
('nutmeg', ARRAY['ground nutmeg', 'whole nutmeg', 'fresh nutmeg'], 'spices'),
('clove', ARRAY['cloves', 'ground cloves', 'whole cloves'], 'spices'),
('allspice', ARRAY['ground allspice', 'whole allspice', 'pimento'], 'spices'),
('garam masala', ARRAY['garam masala spice', 'indian spice blend'], 'spices'),
('italian seasoning', ARRAY['italian herbs', 'italian spice blend', 'italian mix'], 'spices'),
('garlic powder', ARRAY['granulated garlic', 'garlic granules'], 'spices'),
('onion powder', ARRAY['granulated onion', 'onion granules'], 'spices'),

-- Baking
('baking soda', ARRAY['sodium bicarbonate', 'bicarbonate of soda', 'bicarb', 'baking bicarbonate'], 'baking'),
('baking powder', ARRAY['double acting baking powder', 'single acting baking powder', 'raising agent'], 'baking'),
('vanilla', ARRAY['vanilla extract', 'pure vanilla extract', 'vanilla essence', 'vanilla bean', 'vanilla flavoring', 'imitation vanilla'], 'baking'),
('chocolate chips', ARRAY['chocolate morsels', 'chocolate chunks', 'mini chocolate chips', 'semi sweet chocolate chips', 'milk chocolate chips', 'dark chocolate chips'], 'baking'),
('cocoa', ARRAY['cocoa powder', 'unsweetened cocoa', 'dutch process cocoa', 'natural cocoa', 'baking cocoa'], 'baking'),
('cornstarch', ARRAY['corn starch', 'cornflour', 'corn flour'], 'baking'),
('yeast', ARRAY['active dry yeast', 'instant yeast', 'rapid rise yeast', 'bread machine yeast', 'fresh yeast'], 'baking'),
('gelatin', ARRAY['unflavored gelatin', 'gelatin powder', 'knox gelatin'], 'baking'),

-- Nuts & Seeds
('almonds', ARRAY['sliced almonds', 'slivered almonds', 'whole almonds', 'almond slices', 'blanched almonds', 'chopped almonds'], 'nuts'),
('walnuts', ARRAY['walnut pieces', 'walnut halves', 'chopped walnuts', 'english walnuts'], 'nuts'),
('pecans', ARRAY['pecan pieces', 'pecan halves', 'chopped pecans'], 'nuts'),
('cashews', ARRAY['cashew nuts', 'whole cashews', 'cashew pieces', 'roasted cashews'], 'nuts'),
('peanuts', ARRAY['roasted peanuts', 'peanut', 'groundnuts', 'salted peanuts'], 'nuts'),
('pine nuts', ARRAY['pignoli', 'pinon nuts', 'pine kernels'], 'nuts'),
('sesame seeds', ARRAY['sesame', 'white sesame seeds', 'black sesame seeds', 'toasted sesame seeds'], 'seeds'),
('poppy seeds', ARRAY['poppy seed', 'black poppy seeds'], 'seeds'),
('sunflower seeds', ARRAY['sunflower seed', 'hulled sunflower seeds'], 'seeds'),
('chia seeds', ARRAY['chia seed', 'chia'], 'seeds'),
('flax seeds', ARRAY['flaxseed', 'linseed', 'ground flax'], 'seeds'),

-- Condiments & Sauces
('ketchup', ARRAY['catsup', 'tomato ketchup', 'tomato sauce'], 'condiments'),
('mustard', ARRAY['yellow mustard', 'dijon mustard', 'whole grain mustard', 'spicy mustard', 'prepared mustard', 'brown mustard'], 'condiments'),
('mayonnaise', ARRAY['mayo', 'real mayonnaise', 'light mayo', 'miracle whip'], 'condiments'),
('soy sauce', ARRAY['soya sauce', 'shoyu', 'tamari', 'light soy sauce', 'dark soy sauce', 'low sodium soy sauce'], 'condiments'),
('worcestershire sauce', ARRAY['worcestershire', 'lea & perrins'], 'condiments'),
('hot sauce', ARRAY['tabasco', 'frank''s hot sauce', 'sriracha', 'chili sauce', 'cayenne sauce'], 'condiments'),
('bbq sauce', ARRAY['barbecue sauce', 'barbeque sauce', 'grill sauce'], 'condiments'),

-- Common abbreviations
('evoo', ARRAY['extra virgin olive oil', 'olive oil'], 'abbreviations'),
('acv', ARRAY['apple cider vinegar', 'cider vinegar'], 'abbreviations'),
('s&p', ARRAY['salt and pepper', 'salt & pepper'], 'abbreviations')
ON CONFLICT (primary_name) DO UPDATE SET
  equivalent_names = EXCLUDED.equivalent_names,
  category = EXCLUDED.category;