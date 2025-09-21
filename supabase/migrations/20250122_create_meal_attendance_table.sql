-- Create meal attendance table to track who's eating which meals
-- This table allows tracking which family members will attend each meal

-- First ensure the planned_meals table exists (it should already exist)
-- Just check to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'planned_meals') THEN
        RAISE NOTICE 'planned_meals table does not exist. Please ensure meal planning tables are created first.';
    END IF;
END $$;

-- Create meal attendance table if it doesn't exist
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

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_meal_attendance_household ON meal_attendance(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_attendance_date ON meal_attendance(meal_date);
CREATE INDEX IF NOT EXISTS idx_meal_attendance_planned_meal ON meal_attendance(planned_meal_id);

-- Enable RLS on meal_attendance table
ALTER TABLE meal_attendance ENABLE ROW LEVEL SECURITY;

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

-- Grant permissions
GRANT ALL ON meal_attendance TO authenticated;

-- Create a function to get meal attendance with family member details
CREATE OR REPLACE FUNCTION get_meal_attendance_with_members(
    p_household_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE (
    attendance_id UUID,
    meal_date DATE,
    meal_type VARCHAR,
    planned_meal_id UUID,
    attending_member_ids UUID[],
    member_names TEXT[],
    dietary_restrictions TEXT[],
    allergies TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ma.id as attendance_id,
        ma.meal_date,
        ma.meal_type,
        ma.planned_meal_id,
        ma.attending_members as attending_member_ids,
        ARRAY(
            SELECT fm.name
            FROM family_members fm
            WHERE fm.id = ANY(ma.attending_members)
            ORDER BY fm.name
        ) as member_names,
        ARRAY(
            SELECT DISTINCT unnest(fm.dietary_restrictions)
            FROM family_members fm
            WHERE fm.id = ANY(ma.attending_members)
            AND fm.dietary_restrictions IS NOT NULL
        ) as dietary_restrictions,
        ARRAY(
            SELECT DISTINCT unnest(fm.food_allergies)
            FROM family_members fm
            WHERE fm.id = ANY(ma.attending_members)
            AND fm.food_allergies IS NOT NULL
        ) as allergies
    FROM meal_attendance ma
    WHERE ma.household_id = p_household_id
        AND ma.meal_date >= p_start_date
        AND ma.meal_date <= p_end_date
    ORDER BY ma.meal_date,
        CASE
            WHEN ma.meal_type = 'breakfast' THEN 1
            WHEN ma.meal_type = 'lunch' THEN 2
            WHEN ma.meal_type = 'dinner' THEN 3
            ELSE 4
        END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_meal_attendance_with_members(UUID, DATE, DATE) TO authenticated;

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_meal_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS meal_attendance_updated_at_trigger ON meal_attendance;
CREATE TRIGGER meal_attendance_updated_at_trigger
    BEFORE UPDATE ON meal_attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_meal_attendance_updated_at();