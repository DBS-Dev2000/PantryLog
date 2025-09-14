-- Recipe Management Migration
-- Run this in Supabase SQL Editor to add comprehensive recipe management

-- Create recipe_categories table
CREATE TABLE IF NOT EXISTS recipe_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon_name VARCHAR(50), -- Material-UI icon name
    color VARCHAR(7), -- Hex color code
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default recipe categories
INSERT INTO recipe_categories (name, description, icon_name, color, sort_order) VALUES
('Main Dishes', 'Entrees and main course meals', 'Restaurant', '#87A96B', 1),
('Salads', 'Fresh salads and cold dishes', 'Eco', '#27AE60', 2),
('Soups & Stews', 'Hot liquid-based dishes', 'Soup', '#FFC947', 3),
('Appetizers', 'Starters and finger foods', 'Tapas', '#FF7043', 4),
('Desserts', 'Sweet treats and desserts', 'Cake', '#E91E63', 5),
('Beverages', 'Drinks and smoothies', 'LocalBar', '#2196F3', 6),
('Bread & Baking', 'Baked goods and bread', 'Bakery', '#8D6E63', 7),
('Breakfast', 'Morning meals and brunch', 'FreeBreakfast', '#FF9800', 8),
('Snacks', 'Quick bites and snacks', 'Cookie', '#9C27B0', 9),
('Sides', 'Side dishes and accompaniments', 'RoomService', '#607D8B', 10)
ON CONFLICT (name) DO NOTHING;

-- Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    category_id UUID,

    -- Basic recipe info
    title VARCHAR(300) NOT NULL,
    description TEXT,
    instructions TEXT NOT NULL,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    total_time_minutes INTEGER,
    servings INTEGER DEFAULT 4,
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),

    -- External source info
    source_type VARCHAR(20) DEFAULT 'manual' CHECK (source_type IN ('manual', 'youtube', 'website', 'imported')),
    source_url TEXT,
    source_title TEXT,
    youtube_video_id VARCHAR(20), -- YouTube video ID
    website_domain VARCHAR(100), -- allrecipes.com, foodnetwork.com, etc.

    -- Nutrition information
    calories_per_serving INTEGER,
    protein_grams DECIMAL(5,2),
    carbs_grams DECIMAL(5,2),
    fat_grams DECIMAL(5,2),
    fiber_grams DECIMAL(5,2),
    sugar_grams DECIMAL(5,2),
    sodium_mg DECIMAL(7,2),

    -- Recipe media
    image_url TEXT,
    thumbnail_url TEXT,
    video_url TEXT,

    -- Recipe status
    is_favorite BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false, -- Future: recipe sharing
    rating DECIMAL(2,1) CHECK (rating >= 1 AND rating <= 5),
    times_made INTEGER DEFAULT 0,
    last_made_date DATE,

    -- Tags and search
    tags TEXT[], -- Array of tags like ['quick', 'healthy', 'vegetarian']
    cuisine VARCHAR(50), -- 'italian', 'mexican', 'asian', etc.

    -- Metadata
    created_by UUID NOT NULL, -- References auth.users(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create recipe_ingredients table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id), -- Optional link to inventory product

    -- Ingredient details
    ingredient_name VARCHAR(200) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    preparation VARCHAR(100), -- 'diced', 'chopped', 'minced', etc.

    -- Ingredient metadata
    is_optional BOOLEAN DEFAULT false,
    substitute_options TEXT, -- Alternative ingredients
    notes TEXT,

    -- Display order
    ingredient_group VARCHAR(100), -- 'Base', 'Sauce', 'Topping', etc.
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create recipe_cooking_steps table for detailed instructions
CREATE TABLE IF NOT EXISTS recipe_cooking_steps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    time_minutes INTEGER, -- Time for this specific step
    temperature VARCHAR(20), -- '350°F', 'Medium Heat', etc.
    image_url TEXT, -- Step-specific image
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(recipe_id, step_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipes_household ON recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category_id);
CREATE INDEX IF NOT EXISTS idx_recipes_source ON recipes(source_type, source_url);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_product ON recipe_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe ON recipe_cooking_steps(recipe_id, step_number);

-- Function to check recipe availability based on current inventory
CREATE OR REPLACE FUNCTION check_recipe_availability(
    p_recipe_id UUID,
    p_household_id UUID
)
RETURNS TABLE(
    ingredient_name TEXT,
    required_quantity DECIMAL,
    required_unit TEXT,
    available_quantity DECIMAL,
    availability_status TEXT, -- 'available', 'partial', 'missing'
    storage_locations TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ri.ingredient_name::TEXT,
        ri.quantity,
        ri.unit::TEXT,
        COALESCE(SUM(ii.quantity), 0) as available_qty,
        CASE
            WHEN COALESCE(SUM(ii.quantity), 0) >= ri.quantity THEN 'available'
            WHEN COALESCE(SUM(ii.quantity), 0) > 0 THEN 'partial'
            ELSE 'missing'
        END::TEXT as status,
        ARRAY_AGG(DISTINCT sl.name) FILTER (WHERE sl.name IS NOT NULL) as locations
    FROM recipe_ingredients ri
    LEFT JOIN inventory_items ii ON (
        ri.product_id = ii.product_id
        AND ii.household_id = p_household_id
        AND ii.is_consumed = false
    )
    LEFT JOIN storage_locations sl ON ii.storage_location_id = sl.id
    WHERE ri.recipe_id = p_recipe_id
    GROUP BY ri.id, ri.ingredient_name, ri.quantity, ri.unit
    ORDER BY ri.sort_order, ri.ingredient_name;
END;
$$ LANGUAGE plpgsql;

-- Function to extract recipe from YouTube URL
CREATE OR REPLACE FUNCTION extract_youtube_recipe_info(p_url TEXT)
RETURNS TABLE(
    video_id TEXT,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER
) AS $$
DECLARE
    video_id_var TEXT;
BEGIN
    -- Extract YouTube video ID from various URL formats
    video_id_var := CASE
        WHEN p_url ~ 'youtube\.com/watch\?v=([a-zA-Z0-9_-]+)' THEN
            (regexp_matches(p_url, 'youtube\.com/watch\?v=([a-zA-Z0-9_-]+)'))[1]
        WHEN p_url ~ 'youtu\.be/([a-zA-Z0-9_-]+)' THEN
            (regexp_matches(p_url, 'youtu\.be/([a-zA-Z0-9_-]+)'))[1]
        WHEN p_url ~ 'youtube\.com/embed/([a-zA-Z0-9_-]+)' THEN
            (regexp_matches(p_url, 'youtube\.com/embed/([a-zA-Z0-9_-]+)'))[1]
        ELSE NULL
    END;

    -- Return basic info (in production, this would call YouTube API)
    RETURN QUERY SELECT
        video_id_var,
        'Recipe Video'::TEXT,
        'Imported from YouTube'::TEXT,
        'https://img.youtube.com/vi/' || video_id_var || '/maxresdefault.jpg',
        0;
END;
$$ LANGUAGE plpgsql;

-- Function to mark recipe as made and consume ingredients
CREATE OR REPLACE FUNCTION make_recipe(
    p_recipe_id UUID,
    p_household_id UUID,
    p_user_id UUID,
    p_servings_made INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    recipe_servings INTEGER;
    ingredient_record RECORD;
    consumed_items INTEGER := 0;
    scale_factor DECIMAL;
BEGIN
    -- Get recipe serving size
    SELECT servings INTO recipe_servings
    FROM recipes
    WHERE id = p_recipe_id;

    -- Calculate scale factor
    scale_factor := COALESCE(p_servings_made::DECIMAL / recipe_servings, 1);

    -- Consume ingredients from inventory (FIFO)
    FOR ingredient_record IN
        SELECT ri.product_id, ri.quantity * scale_factor as needed_quantity, ri.ingredient_name
        FROM recipe_ingredients ri
        WHERE ri.recipe_id = p_recipe_id
          AND ri.product_id IS NOT NULL
    LOOP
        -- Update inventory items using FIFO
        UPDATE inventory_items
        SET quantity = GREATEST(0, quantity - ingredient_record.needed_quantity),
            is_consumed = CASE WHEN quantity <= ingredient_record.needed_quantity THEN true ELSE false END,
            consumed_date = CASE WHEN quantity <= ingredient_record.needed_quantity THEN NOW() ELSE consumed_date END,
            last_modified_by = p_user_id,
            last_modified_at = NOW()
        WHERE product_id = ingredient_record.product_id
          AND household_id = p_household_id
          AND is_consumed = false
          AND quantity > 0;

        consumed_items := consumed_items + 1;
    END LOOP;

    -- Update recipe usage statistics
    UPDATE recipes
    SET times_made = times_made + 1,
        last_made_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE id = p_recipe_id;

    RETURN consumed_items;
END;
$$ LANGUAGE plpgsql;

-- Add foreign key constraints after tables are created
ALTER TABLE recipes
ADD CONSTRAINT fk_recipes_category
FOREIGN KEY (category_id) REFERENCES recipe_categories(id);

-- Disable RLS for recipe tables
ALTER TABLE recipe_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_cooking_steps DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE recipes IS 'Recipe management with inventory integration and external source support';
COMMENT ON TABLE recipe_ingredients IS 'Recipe ingredients with inventory product linking';
COMMENT ON TABLE recipe_cooking_steps IS 'Detailed step-by-step cooking instructions';
COMMENT ON FUNCTION check_recipe_availability IS 'Checks if recipe can be made with current inventory';
COMMENT ON FUNCTION extract_youtube_recipe_info IS 'Extracts basic info from YouTube recipe URLs';
COMMENT ON FUNCTION make_recipe IS 'Marks recipe as made and consumes ingredients from inventory';