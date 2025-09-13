-- Add hierarchical storage support
-- Add parent_id to support nested storage locations (pantry -> shelf -> section)
ALTER TABLE storage_locations
ADD COLUMN parent_id UUID REFERENCES storage_locations(id) ON DELETE CASCADE,
ADD COLUMN level INTEGER DEFAULT 0 CHECK (level >= 0 AND level <= 2),
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Update the type constraint to include more specific types
ALTER TABLE storage_locations
DROP CONSTRAINT IF EXISTS storage_locations_type_check;

ALTER TABLE storage_locations
ADD CONSTRAINT storage_locations_type_check
CHECK (type IN ('Pantry', 'Freezer', 'Refrigerator', 'Shelf', 'Section', 'Drawer', 'Compartment'));

-- Create index for hierarchical queries
CREATE INDEX idx_storage_locations_parent_id ON storage_locations(parent_id);
CREATE INDEX idx_storage_locations_household_level ON storage_locations(household_id, level);

-- Add some example configuration data
COMMENT ON TABLE storage_locations IS 'Hierarchical storage locations: Level 0=Main (Pantry/Freezer), Level 1=Shelf/Section, Level 2=Sub-section';

-- Function to get full location path
CREATE OR REPLACE FUNCTION get_storage_location_path(location_id UUID)
RETURNS TEXT AS $$
DECLARE
    path TEXT := '';
    current_location RECORD;
    location_cursor CURSOR(loc_id UUID) FOR
        WITH RECURSIVE location_hierarchy AS (
            -- Base case: start with the given location
            SELECT id, name, parent_id, level, type
            FROM storage_locations
            WHERE id = loc_id

            UNION ALL

            -- Recursive case: get parent locations
            SELECT sl.id, sl.name, sl.parent_id, sl.level, sl.type
            FROM storage_locations sl
            INNER JOIN location_hierarchy lh ON sl.id = lh.parent_id
        )
        SELECT name, type, level
        FROM location_hierarchy
        ORDER BY level ASC;
BEGIN
    FOR current_location IN location_cursor(location_id) LOOP
        IF path = '' THEN
            path := current_location.name;
        ELSE
            path := current_location.name || ' > ' || path;
        END IF;
    END LOOP;

    RETURN path;
END;
$$ LANGUAGE plpgsql;