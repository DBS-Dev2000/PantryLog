-- Drop existing tables and dependencies in correct order
DROP TRIGGER IF EXISTS create_default_storage_locations_trigger ON households;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_recipes_updated_at ON recipes;
DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON inventory_items;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_storage_locations_updated_at ON storage_locations;
DROP TRIGGER IF EXISTS update_households_updated_at ON households;

DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS create_default_storage_locations();
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS storage_locations CASCADE;
DROP TABLE IF EXISTS household_members CASCADE;
DROP TABLE IF EXISTS households CASCADE;

-- Create households table
CREATE TABLE households (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create storage_locations table
CREATE TABLE storage_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Pantry', 'Freezer', 'Refrigerator')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create products table
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    upc VARCHAR(50),
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    default_shelf_life_days INTEGER,
    image_url TEXT,
    nutritional_info JSONB,
    is_custom BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create inventory_items table
CREATE TABLE inventory_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    storage_location_id UUID NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20),
    purchase_date DATE NOT NULL,
    expiration_date DATE,
    cost DECIMAL(10,2),
    notes TEXT,
    custom_label VARCHAR(200),
    is_consumed BOOLEAN DEFAULT false,
    consumed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create recipes table
CREATE TABLE recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    instructions TEXT,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    servings INTEGER,
    category VARCHAR(100),
    tags JSONB,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create recipe_ingredients table
CREATE TABLE recipe_ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    ingredient_name VARCHAR(200) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20),
    is_optional BOOLEAN DEFAULT false
);

-- Create household_members table to link users to households
CREATE TABLE household_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- This will reference auth.users
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member', 'guest')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(household_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_products_upc ON products(upc);
CREATE INDEX idx_inventory_items_expiration_date ON inventory_items(expiration_date);
CREATE INDEX idx_inventory_items_fifo ON inventory_items(product_id, purchase_date);
CREATE INDEX idx_inventory_items_household ON inventory_items(household_id);
CREATE INDEX idx_storage_locations_household ON storage_locations(household_id);
CREATE INDEX idx_recipes_household ON recipes(household_id);

-- Enable Row Level Security on all tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Household policies
CREATE POLICY "Users can view their own households" ON households FOR SELECT USING (
    id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert households" ON households FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own households" ON households FOR UPDATE USING (
    id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Household members policies
CREATE POLICY "Users can view household members" ON household_members FOR SELECT USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert household members" ON household_members FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Storage locations policies
CREATE POLICY "Users can view storage locations in their household" ON storage_locations FOR SELECT USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage storage locations in their household" ON storage_locations FOR ALL USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

-- Products policies (products can be shared across households)
CREATE POLICY "Users can view all products" ON products FOR SELECT USING (true);
CREATE POLICY "Users can insert products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own custom products" ON products FOR UPDATE USING (
    created_by = auth.uid() OR NOT is_custom
);

-- Inventory items policies
CREATE POLICY "Users can view inventory items in their household" ON inventory_items FOR SELECT USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage inventory items in their household" ON inventory_items FOR ALL USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

-- Recipes policies
CREATE POLICY "Users can view recipes in their household" ON recipes FOR SELECT USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage recipes in their household" ON recipes FOR ALL USING (
    household_id IN (
        SELECT household_id FROM household_members
        WHERE user_id = auth.uid()
    )
);

-- Recipe ingredients policies
CREATE POLICY "Users can view recipe ingredients for recipes in their household" ON recipe_ingredients FOR SELECT USING (
    recipe_id IN (
        SELECT id FROM recipes
        WHERE household_id IN (
            SELECT household_id FROM household_members
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can manage recipe ingredients for recipes in their household" ON recipe_ingredients FOR ALL USING (
    recipe_id IN (
        SELECT id FROM recipes
        WHERE household_id IN (
            SELECT household_id FROM household_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to auto-update updated_at
CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON households
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_storage_locations_updated_at BEFORE UPDATE ON storage_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default storage locations for a new household
CREATE OR REPLACE FUNCTION create_default_storage_locations()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO storage_locations (household_id, name, type, description) VALUES
        (NEW.id, 'Main Pantry', 'Pantry', 'Primary pantry storage'),
        (NEW.id, 'Main Freezer', 'Freezer', 'Primary freezer storage'),
        (NEW.id, 'Main Refrigerator', 'Refrigerator', 'Primary refrigerator storage');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default storage locations when a household is created
CREATE TRIGGER create_default_storage_locations_trigger
    AFTER INSERT ON households
    FOR EACH ROW EXECUTE FUNCTION create_default_storage_locations();