-- Subscription Features Migration
-- Run this in Supabase SQL Editor to add feature toggles and subscription management

-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    annual_price DECIMAL(10,2),
    description TEXT,
    max_households INTEGER DEFAULT 1,
    max_storage_locations INTEGER DEFAULT 10,
    max_ai_requests_monthly INTEGER DEFAULT 10,
    max_household_members INTEGER DEFAULT 5,
    features JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert subscription tiers
INSERT INTO subscription_tiers (tier_name, display_name, monthly_price, annual_price, description, max_households, max_storage_locations, max_ai_requests_monthly, max_household_members, features, sort_order) VALUES
('free', 'Free Tier', 0.00, 0.00, 'Basic pantry management for small households', 1, 10, 10, 3, '{
  "basic_inventory": true,
  "barcode_scanning": true,
  "manual_recipes": true,
  "basic_shopping_lists": true,
  "household_sharing": false,
  "ai_recognition": false,
  "recipe_import": false,
  "recipe_photo_scan": false,
  "predictive_shopping": false,
  "multi_item_scan": false,
  "expiration_scanner": false,
  "recipe_ai_substitutions": false,
  "store_connections": false,
  "budget_tracking": false,
  "meal_planning": false,
  "advanced_analytics": false,
  "priority_support": false
}', 1),

('basic', 'Basic Plan', 4.99, 49.99, 'Smart pantry management with AI features', 1, 25, 50, 8, '{
  "basic_inventory": true,
  "barcode_scanning": true,
  "manual_recipes": true,
  "basic_shopping_lists": true,
  "household_sharing": true,
  "ai_recognition": true,
  "recipe_import": true,
  "recipe_photo_scan": true,
  "predictive_shopping": true,
  "multi_item_scan": false,
  "expiration_scanner": false,
  "recipe_ai_substitutions": true,
  "store_connections": false,
  "budget_tracking": false,
  "meal_planning": false,
  "advanced_analytics": false,
  "priority_support": false
}', 2),

('pro', 'Pro Plan', 9.99, 99.99, 'Complete kitchen intelligence with advanced AI', 2, 100, 200, 15, '{
  "basic_inventory": true,
  "barcode_scanning": true,
  "manual_recipes": true,
  "basic_shopping_lists": true,
  "household_sharing": true,
  "ai_recognition": true,
  "recipe_import": true,
  "recipe_photo_scan": true,
  "predictive_shopping": true,
  "multi_item_scan": true,
  "expiration_scanner": true,
  "recipe_ai_substitutions": true,
  "store_connections": true,
  "budget_tracking": true,
  "meal_planning": true,
  "advanced_analytics": false,
  "priority_support": true
}', 3),

('enterprise', 'Enterprise Plan', 19.99, 199.99, 'Advanced analytics and unlimited features', 10, 1000, 1000, 50, '{
  "basic_inventory": true,
  "barcode_scanning": true,
  "manual_recipes": true,
  "basic_shopping_lists": true,
  "household_sharing": true,
  "ai_recognition": true,
  "recipe_import": true,
  "recipe_photo_scan": true,
  "predictive_shopping": true,
  "multi_item_scan": true,
  "expiration_scanner": true,
  "recipe_ai_substitutions": true,
  "store_connections": true,
  "budget_tracking": true,
  "meal_planning": true,
  "advanced_analytics": true,
  "priority_support": true
}', 4)
ON CONFLICT (tier_name) DO NOTHING;

-- Create household_subscriptions table
CREATE TABLE IF NOT EXISTS household_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
    subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'expired', 'trial')),
    trial_end_date TIMESTAMP WITH TIME ZONE,
    subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    auto_renew BOOLEAN DEFAULT true,
    payment_method VARCHAR(50),
    last_payment_date TIMESTAMP WITH TIME ZONE,
    next_payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create feature_toggles table for admin control
CREATE TABLE IF NOT EXISTS feature_toggles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    enabled_by UUID, -- References auth.users(id) - admin who enabled
    enabled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notes TEXT,
    UNIQUE(household_id, feature_name)
);

-- Function to check if household has feature access
CREATE OR REPLACE FUNCTION has_feature_access(
    p_household_id UUID,
    p_feature_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    subscription_tier RECORD;
    feature_toggle RECORD;
    has_subscription_access BOOLEAN := false;
    has_toggle_access BOOLEAN := true;
BEGIN
    -- Get household's subscription tier
    SELECT st.* INTO subscription_tier
    FROM household_subscriptions hs
    JOIN subscription_tiers st ON hs.tier_id = st.id
    WHERE hs.household_id = p_household_id
      AND hs.subscription_status = 'active'
      AND (hs.subscription_end_date IS NULL OR hs.subscription_end_date > NOW())
    ORDER BY st.sort_order DESC
    LIMIT 1;

    -- If no subscription, default to free tier
    IF subscription_tier IS NULL THEN
        SELECT * INTO subscription_tier
        FROM subscription_tiers
        WHERE tier_name = 'free';
    END IF;

    -- Check if feature is included in subscription tier
    has_subscription_access := COALESCE(
        (subscription_tier.features ->> p_feature_name)::BOOLEAN,
        false
    );

    -- Check admin feature toggle (can override subscription)
    SELECT * INTO feature_toggle
    FROM feature_toggles
    WHERE household_id = p_household_id
      AND feature_name = p_feature_name;

    IF feature_toggle IS NOT NULL THEN
        has_toggle_access := feature_toggle.is_enabled;
    END IF;

    -- Feature is accessible if both subscription allows and toggle is enabled
    RETURN has_subscription_access AND has_toggle_access;
END;
$$ LANGUAGE plpgsql;

-- Function to enable/disable features for specific households (admin only)
CREATE OR REPLACE FUNCTION toggle_household_feature(
    p_household_id UUID,
    p_feature_name VARCHAR,
    p_enabled BOOLEAN,
    p_admin_user_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    admin_check BOOLEAN;
BEGIN
    -- Verify admin access
    SELECT is_system_admin(p_admin_user_id) INTO admin_check;

    IF NOT admin_check THEN
        RAISE EXCEPTION 'Only system administrators can toggle household features';
    END IF;

    -- Insert or update feature toggle
    INSERT INTO feature_toggles (household_id, feature_name, is_enabled, enabled_by, notes)
    VALUES (p_household_id, p_feature_name, p_enabled, p_admin_user_id, p_notes)
    ON CONFLICT (household_id, feature_name) DO UPDATE SET
        is_enabled = p_enabled,
        enabled_by = p_admin_user_id,
        enabled_at = NOW(),
        notes = p_notes;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to get household's feature list
CREATE OR REPLACE FUNCTION get_household_features(p_household_id UUID)
RETURNS TABLE(
    feature_name VARCHAR,
    is_available BOOLEAN,
    source VARCHAR -- 'subscription' or 'admin_override'
) AS $$
DECLARE
    subscription_tier RECORD;
    feature_key TEXT;
    feature_value BOOLEAN;
BEGIN
    -- Get household's subscription tier
    SELECT st.* INTO subscription_tier
    FROM household_subscriptions hs
    JOIN subscription_tiers st ON hs.tier_id = st.id
    WHERE hs.household_id = p_household_id
      AND hs.subscription_status = 'active'
    ORDER BY st.sort_order DESC
    LIMIT 1;

    -- Default to free tier if no subscription
    IF subscription_tier IS NULL THEN
        SELECT * INTO subscription_tier
        FROM subscription_tiers
        WHERE tier_name = 'free';
    END IF;

    -- Return all features with availability
    FOR feature_key, feature_value IN
        SELECT * FROM jsonb_each_text(subscription_tier.features)
    LOOP
        RETURN QUERY SELECT
            feature_key::VARCHAR,
            COALESCE(
                (SELECT ft.is_enabled FROM feature_toggles ft
                 WHERE ft.household_id = p_household_id AND ft.feature_name = feature_key),
                feature_value::BOOLEAN
            ),
            CASE
                WHEN EXISTS (SELECT 1 FROM feature_toggles ft
                           WHERE ft.household_id = p_household_id AND ft.feature_name = feature_key)
                THEN 'admin_override'
                ELSE 'subscription'
            END::VARCHAR;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Set all existing households to free tier initially
INSERT INTO household_subscriptions (household_id, tier_id)
SELECT h.id, st.id
FROM households h
CROSS JOIN subscription_tiers st
WHERE st.tier_name = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM household_subscriptions hs
    WHERE hs.household_id = h.id
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_household_subscriptions_household ON household_subscriptions(household_id);
CREATE INDEX IF NOT EXISTS idx_household_subscriptions_status ON household_subscriptions(subscription_status);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_household ON feature_toggles(household_id);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_feature ON feature_toggles(feature_name);

-- Disable RLS for subscription tables
ALTER TABLE subscription_tiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE household_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE feature_toggles DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE subscription_tiers IS 'Subscription plans with feature definitions and pricing';
COMMENT ON TABLE household_subscriptions IS 'Household subscription status and billing information';
COMMENT ON TABLE feature_toggles IS 'Admin-controlled feature toggles for specific households';
COMMENT ON FUNCTION has_feature_access IS 'Checks if household has access to specific feature based on subscription and admin toggles';
COMMENT ON FUNCTION toggle_household_feature IS 'Admin function to enable/disable features for specific households';
COMMENT ON FUNCTION get_household_features IS 'Returns all features available to a household with access source';