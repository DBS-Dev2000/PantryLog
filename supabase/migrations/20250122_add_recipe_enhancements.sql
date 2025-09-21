-- Add recipe enhancements: ratings, comments, and improved image handling

DO $$
BEGIN
    -- Add columns to recipes table if they don't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipes') THEN
        -- Add source_url column for imported recipes
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'recipes'
                      AND column_name = 'source_url') THEN
            ALTER TABLE recipes ADD COLUMN source_url TEXT;
        END IF;

        -- Add average_rating column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'recipes'
                      AND column_name = 'average_rating') THEN
            ALTER TABLE recipes ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0;
        END IF;

        -- Add total_ratings column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'recipes'
                      AND column_name = 'total_ratings') THEN
            ALTER TABLE recipes ADD COLUMN total_ratings INTEGER DEFAULT 0;
        END IF;
    END IF;
END $$;

-- Create recipe_ratings table
CREATE TABLE IF NOT EXISTS recipe_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(recipe_id, family_member_id)
);

-- Create recipe_comments table
CREATE TABLE IF NOT EXISTS recipe_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe_id ON recipe_ratings(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_member_id ON recipe_ratings(family_member_id);
CREATE INDEX IF NOT EXISTS idx_recipe_comments_recipe_id ON recipe_comments(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_comments_member_id ON recipe_comments(family_member_id);
CREATE INDEX IF NOT EXISTS idx_recipe_comments_created_at ON recipe_comments(created_at DESC);

-- Enable RLS on new tables
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for recipe_ratings
CREATE POLICY "Users can view ratings in their household"
    ON recipe_ratings FOR SELECT
    USING (
        household_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM family_members
            WHERE family_members.household_id = recipe_ratings.household_id
            AND family_members.household_id = auth.uid()::uuid
        )
    );

CREATE POLICY "Users can insert ratings for their household"
    ON recipe_ratings FOR INSERT
    WITH CHECK (
        household_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM family_members
            WHERE family_members.household_id = recipe_ratings.household_id
            AND family_members.household_id = auth.uid()::uuid
        )
    );

CREATE POLICY "Users can update ratings in their household"
    ON recipe_ratings FOR UPDATE
    USING (
        household_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM family_members
            WHERE family_members.household_id = recipe_ratings.household_id
            AND family_members.household_id = auth.uid()::uuid
        )
    );

CREATE POLICY "Users can delete ratings in their household"
    ON recipe_ratings FOR DELETE
    USING (
        household_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM family_members
            WHERE family_members.household_id = recipe_ratings.household_id
            AND family_members.household_id = auth.uid()::uuid
        )
    );

-- Create RLS policies for recipe_comments
CREATE POLICY "Users can view comments in their household"
    ON recipe_comments FOR SELECT
    USING (
        household_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM family_members
            WHERE family_members.household_id = recipe_comments.household_id
            AND family_members.household_id = auth.uid()::uuid
        )
    );

CREATE POLICY "Users can insert comments for their household"
    ON recipe_comments FOR INSERT
    WITH CHECK (
        household_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM family_members
            WHERE family_members.household_id = recipe_comments.household_id
            AND family_members.household_id = auth.uid()::uuid
        )
    );

CREATE POLICY "Users can update comments in their household"
    ON recipe_comments FOR UPDATE
    USING (
        household_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM family_members
            WHERE family_members.household_id = recipe_comments.household_id
            AND family_members.household_id = auth.uid()::uuid
        )
    );

CREATE POLICY "Users can delete comments in their household"
    ON recipe_comments FOR DELETE
    USING (
        household_id = auth.uid()::uuid OR
        EXISTS (
            SELECT 1 FROM family_members
            WHERE family_members.household_id = recipe_comments.household_id
            AND family_members.household_id = auth.uid()::uuid
        )
    );

-- Function to update recipe average rating
CREATE OR REPLACE FUNCTION update_recipe_rating()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the recipes table with new average rating and total count
    UPDATE recipes
    SET
        average_rating = (
            SELECT ROUND(AVG(rating::numeric), 2)
            FROM recipe_ratings
            WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
        ),
        total_ratings = (
            SELECT COUNT(*)
            FROM recipe_ratings
            WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update recipe ratings
DROP TRIGGER IF EXISTS trigger_update_recipe_rating_insert ON recipe_ratings;
CREATE TRIGGER trigger_update_recipe_rating_insert
    AFTER INSERT ON recipe_ratings
    FOR EACH ROW EXECUTE FUNCTION update_recipe_rating();

DROP TRIGGER IF EXISTS trigger_update_recipe_rating_update ON recipe_ratings;
CREATE TRIGGER trigger_update_recipe_rating_update
    AFTER UPDATE ON recipe_ratings
    FOR EACH ROW EXECUTE FUNCTION update_recipe_rating();

DROP TRIGGER IF EXISTS trigger_update_recipe_rating_delete ON recipe_ratings;
CREATE TRIGGER trigger_update_recipe_rating_delete
    AFTER DELETE ON recipe_ratings
    FOR EACH ROW EXECUTE FUNCTION update_recipe_rating();