-- Create storage buckets for recipe images and other media

-- Insert bucket configuration if it doesn't exist
DO $$
BEGIN
    -- Check if the recipe-images bucket exists
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'recipe-images'
    ) THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'recipe-images',
            'recipe-images',
            true, -- Public bucket for recipe images
            5242880, -- 5MB limit
            ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        );
    END IF;

    -- Check if the item-images bucket exists
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'item-images'
    ) THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'item-images',
            'item-images',
            true, -- Public bucket for inventory item images
            5242880, -- 5MB limit
            ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        );
    END IF;
END $$;

-- Create storage policies for recipe-images bucket
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Allow authenticated users to upload recipe images" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public to view recipe images" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to update their own recipe images" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to delete their own recipe images" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN
        -- Policies don't exist, continue
        NULL;
END $$;

-- Policy: Allow authenticated users to upload recipe images
CREATE POLICY "Allow authenticated users to upload recipe images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'recipe-images' AND
    auth.role() = 'authenticated'
);

-- Policy: Allow public to view recipe images
CREATE POLICY "Allow public to view recipe images"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-images');

-- Policy: Allow users to update their own recipe images
CREATE POLICY "Allow users to update their own recipe images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'recipe-images' AND
    auth.role() = 'authenticated'
)
WITH CHECK (
    bucket_id = 'recipe-images' AND
    auth.role() = 'authenticated'
);

-- Policy: Allow users to delete their own recipe images
CREATE POLICY "Allow users to delete their own recipe images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'recipe-images' AND
    auth.role() = 'authenticated'
);

-- Create similar policies for item-images bucket
CREATE POLICY "Allow authenticated users to upload item images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'item-images' AND
    auth.role() = 'authenticated'
);

CREATE POLICY "Allow public to view item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-images');

CREATE POLICY "Allow users to update their own item images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'item-images' AND
    auth.role() = 'authenticated'
)
WITH CHECK (
    bucket_id = 'item-images' AND
    auth.role() = 'authenticated'
);

CREATE POLICY "Allow users to delete their own item images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'item-images' AND
    auth.role() = 'authenticated'
);