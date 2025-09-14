-- Recipe Versioning Migration
-- Run this in Supabase SQL Editor to add recipe versioning and personal customizations

-- Add versioning columns to recipes table
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS parent_recipe_id UUID REFERENCES recipes(id),
ADD COLUMN IF NOT EXISTS version_type VARCHAR(20) DEFAULT 'original' CHECK (version_type IN ('original', 'personal', 'variant')),
ADD COLUMN IF NOT EXISTS version_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS customization_notes TEXT,
ADD COLUMN IF NOT EXISTS is_default_version BOOLEAN DEFAULT false;

-- Create recipe_substitutions table for tracking personal substitutions
CREATE TABLE IF NOT EXISTS recipe_substitutions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    original_ingredient VARCHAR(200) NOT NULL,
    substitute_ingredient VARCHAR(200) NOT NULL,
    substitution_ratio VARCHAR(20) DEFAULT '1:1',
    reason TEXT,
    notes TEXT,
    created_by UUID NOT NULL, -- References auth.users(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to create recipe version with substitutions
CREATE OR REPLACE FUNCTION create_recipe_version(
    p_original_recipe_id UUID,
    p_user_id UUID,
    p_version_name VARCHAR,
    p_substitutions JSONB,
    p_omitted_ingredients TEXT[],
    p_version_type VARCHAR DEFAULT 'personal',
    p_set_as_default BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    new_recipe_id UUID;
    original_recipe RECORD;
    ingredient_record RECORD;
    substitution RECORD;
BEGIN
    -- Get original recipe data
    SELECT * INTO original_recipe
    FROM recipes
    WHERE id = p_original_recipe_id;

    -- Create new recipe version
    INSERT INTO recipes (
        household_id,
        parent_recipe_id,
        category_id,
        title,
        description,
        instructions,
        prep_time_minutes,
        cook_time_minutes,
        total_time_minutes,
        servings,
        difficulty,
        source_type,
        source_url,
        image_url,
        version_type,
        version_name,
        customization_notes,
        is_default_version,
        created_by
    ) VALUES (
        original_recipe.household_id,
        p_original_recipe_id,
        original_recipe.category_id,
        original_recipe.title || original_recipe.name,
        original_recipe.description,
        original_recipe.instructions,
        original_recipe.prep_time_minutes,
        original_recipe.cook_time_minutes,
        original_recipe.total_time_minutes,
        original_recipe.servings,
        original_recipe.difficulty,
        'variant',
        original_recipe.source_url,
        original_recipe.image_url,
        p_version_type,
        p_version_name,
        'Personal version with substitutions: ' || array_to_string(p_omitted_ingredients, ', '),
        p_set_as_default,
        p_user_id
    ) RETURNING id INTO new_recipe_id;

    -- Copy ingredients with substitutions
    FOR ingredient_record IN
        SELECT * FROM recipe_ingredients
        WHERE recipe_id = p_original_recipe_id
        ORDER BY sort_order
    LOOP
        -- Skip omitted ingredients
        IF ingredient_record.ingredient_name = ANY(p_omitted_ingredients) THEN
            CONTINUE;
        END IF;

        -- Check for substitutions
        IF p_substitutions ? ingredient_record.ingredient_name THEN
            -- Insert substituted ingredient
            INSERT INTO recipe_ingredients (
                recipe_id,
                ingredient_name,
                quantity,
                unit,
                preparation,
                sort_order
            ) VALUES (
                new_recipe_id,
                p_substitutions ->> ingredient_record.ingredient_name,
                ingredient_record.quantity,
                ingredient_record.unit,
                ingredient_record.preparation,
                ingredient_record.sort_order
            );

            -- Log the substitution
            INSERT INTO recipe_substitutions (
                recipe_id,
                original_ingredient,
                substitute_ingredient,
                reason,
                created_by
            ) VALUES (
                new_recipe_id,
                ingredient_record.ingredient_name,
                p_substitutions ->> ingredient_record.ingredient_name,
                'Personal substitution preference',
                p_user_id
            );
        ELSE
            -- Insert original ingredient
            INSERT INTO recipe_ingredients (
                recipe_id,
                ingredient_name,
                quantity,
                unit,
                preparation,
                sort_order
            ) VALUES (
                new_recipe_id,
                ingredient_record.ingredient_name,
                ingredient_record.quantity,
                ingredient_record.unit,
                ingredient_record.preparation,
                ingredient_record.sort_order
            );
        END IF;
    END LOOP;

    -- Copy cooking steps
    INSERT INTO recipe_cooking_steps (recipe_id, step_number, instruction, time_minutes)
    SELECT new_recipe_id, step_number, instruction, time_minutes
    FROM recipe_cooking_steps
    WHERE recipe_id = p_original_recipe_id;

    -- If setting as default, update user's default version preference
    IF p_set_as_default THEN
        -- Remove default flag from other versions
        UPDATE recipes
        SET is_default_version = false
        WHERE parent_recipe_id = p_original_recipe_id
          AND created_by = p_user_id;

        -- Set this version as default
        UPDATE recipes
        SET is_default_version = true
        WHERE id = new_recipe_id;
    END IF;

    RETURN new_recipe_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get smart substitutions using AI or manual rules
CREATE OR REPLACE FUNCTION get_smart_substitutions(
    p_ingredient VARCHAR,
    p_category VARCHAR DEFAULT NULL,
    p_recipe_type VARCHAR DEFAULT NULL
)
RETURNS TABLE(
    substitute_name VARCHAR,
    substitution_ratio VARCHAR,
    quality_rating VARCHAR,
    notes TEXT,
    category VARCHAR
) AS $$
BEGIN
    -- This would call the AI API in a real implementation
    -- For now, return common substitutions based on ingredient type

    -- Protein substitutions
    IF LOWER(p_ingredient) LIKE '%ground beef%' OR LOWER(p_ingredient) LIKE '%beef%' THEN
        RETURN QUERY VALUES
            ('ground turkey', '1:1', 'excellent', 'Leaner, may need extra fat', 'protein'),
            ('ground chicken', '1:1', 'good', 'Very lean, add extra seasoning', 'protein'),
            ('ground pork', '1:1', 'good', 'Similar fat content', 'protein'),
            ('plant-based ground', '1:1', 'fair', 'Different texture, pre-seasoned', 'protein');
        RETURN;
    END IF;

    -- Salt substitutions
    IF LOWER(p_ingredient) LIKE '%salt%' THEN
        RETURN QUERY VALUES
            ('sea salt', '1:1', 'excellent', 'Natural minerals, same salinity', 'seasoning'),
            ('kosher salt', '1.25:1', 'excellent', 'Larger crystals, use slightly more', 'seasoning'),
            ('himalayan pink salt', '1:1', 'good', 'Mild flavor difference', 'seasoning');
        RETURN;
    END IF;

    -- Sugar substitutions
    IF LOWER(p_ingredient) LIKE '%sugar%' THEN
        RETURN QUERY VALUES
            ('brown sugar', '1:1', 'good', 'Adds molasses flavor', 'sweetener'),
            ('honey', '0.75:1', 'good', 'Liquid sweetener, reduce other liquids', 'sweetener'),
            ('maple syrup', '0.75:1', 'fair', 'Distinct flavor, reduce liquids', 'sweetener');
        RETURN;
    END IF;

    -- Default - no specific substitutions found
    RETURN QUERY VALUES
        ('check pantry', 'varies', 'unknown', 'Look for similar ingredients', 'general');
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipes_parent ON recipes(parent_recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipes_version_type ON recipes(version_type);
CREATE INDEX IF NOT EXISTS idx_recipes_default_version ON recipes(is_default_version);
CREATE INDEX IF NOT EXISTS idx_recipe_substitutions_recipe ON recipe_substitutions(recipe_id);

-- Disable RLS for new tables
ALTER TABLE recipe_substitutions DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE recipe_substitutions IS 'Personal ingredient substitutions and preferences for recipe versions';
COMMENT ON FUNCTION create_recipe_version IS 'Creates personalized recipe versions with substitutions and omissions';
COMMENT ON FUNCTION get_smart_substitutions IS 'Provides intelligent ingredient substitution suggestions';