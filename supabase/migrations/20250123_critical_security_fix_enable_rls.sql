-- CRITICAL SECURITY FIX: Enable RLS on all tables with policies
-- This migration fixes the security vulnerability where RLS policies exist but RLS is not enabled

-- Tables with existing policies that need RLS enabled
ALTER TABLE IF EXISTS public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.storage_locations ENABLE ROW LEVEL SECURITY;

-- Tables without RLS that need it enabled for security
ALTER TABLE IF EXISTS public.nutritional_balance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meal_type_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_preference_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recipe_cooking_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.theme_night_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ingredient_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ingredient_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dietary_restriction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recipe_category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recipe_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shopping_list_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_billing_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meal_rotation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recipe_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.household_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feature_toggles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.time_based_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.food_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.food_shelf_life ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ml_ingredient_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.household_food_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.household_shelf_life_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.household_ingredient_equivalencies ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for tables that don't have any yet
-- These are conservative policies that only allow authenticated users to see their own household data

-- User AI Usage - users can only see their own usage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_ai_usage' AND policyname = 'Users can view own usage'
  ) THEN
    CREATE POLICY "Users can view own usage" ON public.user_ai_usage
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_ai_usage' AND policyname = 'Users can insert own usage'
  ) THEN
    CREATE POLICY "Users can insert own usage" ON public.user_ai_usage
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Shopping list items - household members only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shopping_list_items' AND policyname = 'Household members can manage shopping items'
  ) THEN
    CREATE POLICY "Household members can manage shopping items" ON public.shopping_list_items
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM shopping_lists sl
          WHERE sl.id = shopping_list_items.shopping_list_id
          AND sl.household_id IN (
            SELECT household_id FROM user_profiles WHERE id = auth.uid()
            UNION
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Recipe ingredients - household members can manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recipe_ingredients' AND policyname = 'Household members can manage recipe ingredients'
  ) THEN
    CREATE POLICY "Household members can manage recipe ingredients" ON public.recipe_ingredients
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM recipes r
          WHERE r.id = recipe_ingredients.recipe_id
          AND r.household_id IN (
            SELECT household_id FROM user_profiles WHERE id = auth.uid()
            UNION
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Household invites - users can see invites for their email or that they sent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'household_invites' AND policyname = 'Users can see their invites'
  ) THEN
    CREATE POLICY "Users can see their invites" ON public.household_invites
      FOR SELECT USING (
        invited_email = auth.jwt()->>'email'
        OR invited_by = auth.uid()
      );
  END IF;
END $$;

-- ML feedback - authenticated users can submit feedback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ml_ingredient_feedback' AND policyname = 'Authenticated users can submit feedback'
  ) THEN
    CREATE POLICY "Authenticated users can submit feedback" ON public.ml_ingredient_feedback
      FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Household ingredient equivalencies - household members only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'household_ingredient_equivalencies' AND policyname = 'Household members can manage equivalencies'
  ) THEN
    CREATE POLICY "Household members can manage equivalencies" ON public.household_ingredient_equivalencies
      FOR ALL USING (
        household_id IN (
          SELECT household_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
          UNION
          SELECT id FROM households WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Admin tables - restrict to admin users only
DO $$
BEGIN
  -- System admins table
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'system_admins' AND policyname = 'Only admins can access'
  ) THEN
    CREATE POLICY "Only admins can access" ON public.system_admins
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM system_admins WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;

  -- Admin activity log
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_activity_log' AND policyname = 'Only admins can view logs'
  ) THEN
    CREATE POLICY "Only admins can view logs" ON public.admin_activity_log
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM system_admins WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;

-- Read-only tables (reference data) - everyone can read, only service role can modify
-- These tables contain shared reference data that all users need to read

-- Food categories and taxonomy tables
DO $$
BEGIN
  -- Food categories
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'food_categories' AND policyname = 'Everyone can read categories'
  ) THEN
    CREATE POLICY "Everyone can read categories" ON public.food_categories
      FOR SELECT USING (true);
  END IF;

  -- Food subcategories
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'food_subcategories' AND policyname = 'Everyone can read subcategories'
  ) THEN
    CREATE POLICY "Everyone can read subcategories" ON public.food_subcategories
      FOR SELECT USING (true);
  END IF;

  -- Food items
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'food_items' AND policyname = 'Everyone can read food items'
  ) THEN
    CREATE POLICY "Everyone can read food items" ON public.food_items
      FOR SELECT USING (true);
  END IF;

  -- Food shelf life
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'food_shelf_life' AND policyname = 'Everyone can read shelf life'
  ) THEN
    CREATE POLICY "Everyone can read shelf life" ON public.food_shelf_life
      FOR SELECT USING (true);
  END IF;

  -- Recipe categories
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recipe_categories' AND policyname = 'Everyone can read recipe categories'
  ) THEN
    CREATE POLICY "Everyone can read recipe categories" ON public.recipe_categories
      FOR SELECT USING (true);
  END IF;

  -- Ingredient categories
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ingredient_categories' AND policyname = 'Everyone can read ingredient categories'
  ) THEN
    CREATE POLICY "Everyone can read ingredient categories" ON public.ingredient_categories
      FOR SELECT USING (true);
  END IF;

  -- Subscription tiers (public info)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscription_tiers' AND policyname = 'Everyone can read subscription tiers'
  ) THEN
    CREATE POLICY "Everyone can read subscription tiers" ON public.subscription_tiers
      FOR SELECT USING (true);
  END IF;

  -- Feature toggles (public info)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'feature_toggles' AND policyname = 'Everyone can read feature toggles'
  ) THEN
    CREATE POLICY "Everyone can read feature toggles" ON public.feature_toggles
      FOR SELECT USING (true);
  END IF;
END $$;

-- Household-specific rules tables
DO $$
BEGIN
  -- Meal type rules (global reference table - everyone can read)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'meal_type_rules' AND policyname = 'Everyone can read meal rules'
  ) THEN
    CREATE POLICY "Everyone can read meal rules" ON public.meal_type_rules
      FOR SELECT USING (true);
  END IF;

  -- Theme night patterns (global reference table - everyone can read)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'theme_night_patterns' AND policyname = 'Everyone can read theme patterns'
  ) THEN
    CREATE POLICY "Everyone can read theme patterns" ON public.theme_night_patterns
      FOR SELECT USING (true);
  END IF;

  -- Nutritional balance rules (global reference table - everyone can read)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nutritional_balance_rules' AND policyname = 'Everyone can read nutrition rules'
  ) THEN
    CREATE POLICY "Everyone can read nutrition rules" ON public.nutritional_balance_rules
      FOR SELECT USING (true);
  END IF;

  -- Family preference patterns (household-specific)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'family_preference_patterns' AND policyname = 'Household members can manage preferences'
  ) THEN
    CREATE POLICY "Household members can manage preferences" ON public.family_preference_patterns
      FOR ALL USING (
        household_id IN (
          SELECT household_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );
  END IF;

  -- Household subscriptions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'household_subscriptions' AND policyname = 'Household members can view subscription'
  ) THEN
    CREATE POLICY "Household members can view subscription" ON public.household_subscriptions
      FOR SELECT USING (
        household_id IN (
          SELECT household_id FROM user_profiles WHERE id = auth.uid()
          UNION
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Note: SECURITY DEFINER views need careful handling to avoid breaking functionality
-- They should be reviewed and potentially recreated without SECURITY DEFINER in a separate migration

-- Note: Security fix applied via migration
-- To verify: Check pg_class.relrowsecurity = true for all public tables

-- Verify RLS is enabled
DO $$
DECLARE
  table_count INTEGER;
  unprotected_tables TEXT[];
BEGIN
  -- Count tables without RLS
  SELECT COUNT(*), array_agg(tablename) INTO table_count, unprotected_tables
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename NOT LIKE '%_view%'
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = pg_tables.tablename
    AND c.relrowsecurity = true
  );

  IF table_count > 0 THEN
    RAISE WARNING 'SECURITY WARNING: % tables still without RLS: %', table_count, unprotected_tables;
  ELSE
    RAISE NOTICE 'SUCCESS: All tables now have RLS enabled';
  END IF;
END $$;