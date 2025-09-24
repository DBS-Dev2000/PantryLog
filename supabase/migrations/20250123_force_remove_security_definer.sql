-- FORCE REMOVE SECURITY DEFINER from all views
-- This migration explicitly creates views with security_invoker = true

-- First, drop ALL the problematic views
DROP VIEW IF EXISTS public.user_ai_usage_summary CASCADE;
DROP VIEW IF EXISTS public.meal_planning_knowledge_base CASCADE;
DROP VIEW IF EXISTS public.products_with_prices CASCADE;
DROP VIEW IF EXISTS public.inventory_audit_view CASCADE;
DROP VIEW IF EXISTS public.household_dietary_preferences CASCADE;
DROP VIEW IF EXISTS public.active_ingredient_equivalencies CASCADE;

-- Wait a moment to ensure drops are complete
DO $$ BEGIN PERFORM pg_sleep(0.1); END $$;

-- Now recreate with EXPLICIT security_invoker = true

-- 1. user_ai_usage_summary
CREATE OR REPLACE VIEW public.user_ai_usage_summary
WITH (security_invoker = true) AS
SELECT
    user_id,
    DATE_TRUNC('day', created_at) as usage_date,
    COUNT(*) as request_count,
    SUM(total_tokens) as total_tokens,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(total_cost) as total_cost,
    MAX(created_at) as last_usage
FROM user_ai_usage
WHERE user_id = auth.uid()
GROUP BY user_id, DATE_TRUNC('day', created_at);

-- 2. meal_planning_knowledge_base
CREATE OR REPLACE VIEW public.meal_planning_knowledge_base
WITH (security_invoker = true) AS
SELECT
    'meal_type_rules' as source_table,
    meal_type,
    rule_category,
    rule_name,
    rule_description,
    priority
FROM meal_type_rules
UNION ALL
SELECT
    'theme_night_patterns' as source_table,
    CASE day_of_week
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END as meal_type,
    'theme' as rule_category,
    theme_name as rule_name,
    theme_description as rule_description,
    1 as priority
FROM theme_night_patterns;

-- 3. products_with_prices
CREATE OR REPLACE VIEW public.products_with_prices
WITH (security_invoker = true) AS
SELECT DISTINCT
    p.id,
    p.name,
    p.brand,
    p.category,
    p.upc,
    ii.cost as last_price,
    ii.purchase_date as price_date,
    ii.household_id
FROM products p
JOIN inventory_items ii ON p.id = ii.product_id
WHERE ii.household_id IN (
    SELECT household_id FROM user_profiles WHERE id = auth.uid()
    UNION
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM households WHERE id = auth.uid()
);

-- 4. inventory_audit_view
CREATE OR REPLACE VIEW public.inventory_audit_view
WITH (security_invoker = true) AS
SELECT
    ial.*,
    p.name as product_name,
    ii.storage_location_id,
    sl.name as location_name
FROM inventory_audit_log ial
LEFT JOIN inventory_items ii ON ial.inventory_item_id = ii.id
LEFT JOIN products p ON ii.product_id = p.id
LEFT JOIN storage_locations sl ON ii.storage_location_id = sl.id
WHERE ial.household_id IN (
    SELECT household_id FROM user_profiles WHERE id = auth.uid()
    UNION
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM households WHERE id = auth.uid()
);

-- 5. household_dietary_preferences
CREATE OR REPLACE VIEW public.household_dietary_preferences
WITH (security_invoker = true) AS
SELECT
    h.id as household_id,
    h.name as household_name,
    array_agg(DISTINCT prefs.value) as all_dietary_restrictions
FROM households h
LEFT JOIN user_profiles up ON up.household_id = h.id
LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(up.dietary_restrictions, '[]'::jsonb)) as prefs(value) ON true
WHERE h.id IN (
    SELECT household_id FROM user_profiles WHERE id = auth.uid()
    UNION
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM households WHERE id = auth.uid()
)
GROUP BY h.id, h.name;

-- 6. active_ingredient_equivalencies
CREATE OR REPLACE VIEW public.active_ingredient_equivalencies
WITH (security_invoker = true) AS
SELECT
    'global' as source_type,
    id,
    primary_name as ingredient_name,
    equivalent_names as equivalent_names,
    category,
    notes,
    1.0 as confidence_score,
    '1:1' as substitution_ratio,
    true as is_active
FROM ingredient_equivalencies
UNION ALL
SELECT
    'household' as source_type,
    id,
    ingredient_name,
    ARRAY[equivalent_name] as equivalent_names,
    NULL as category,
    notes,
    confidence_score,
    substitution_ratio,
    is_active
FROM household_ingredient_equivalencies
WHERE household_id IN (
    SELECT household_id FROM user_profiles WHERE id = auth.uid()
    UNION
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM households WHERE id = auth.uid()
)
AND is_active = true;

-- Grant permissions
GRANT SELECT ON public.user_ai_usage_summary TO authenticated;
GRANT SELECT ON public.meal_planning_knowledge_base TO authenticated;
GRANT SELECT ON public.products_with_prices TO authenticated;
GRANT SELECT ON public.inventory_audit_view TO authenticated;
GRANT SELECT ON public.household_dietary_preferences TO authenticated;
GRANT SELECT ON public.active_ingredient_equivalencies TO authenticated;

-- VERIFICATION: Check if any views still have SECURITY DEFINER
DO $$
DECLARE
    bad_views TEXT[];
    view_count INTEGER;
BEGIN
    -- Find any remaining SECURITY DEFINER views
    SELECT
        array_agg(c.relname),
        COUNT(*)
    INTO bad_views, view_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND c.relname IN (
        'user_ai_usage_summary',
        'meal_planning_knowledge_base',
        'products_with_prices',
        'inventory_audit_view',
        'household_dietary_preferences',
        'active_ingredient_equivalencies'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_views v
        WHERE v.schemaname = 'public'
        AND v.viewname = c.relname
        AND v.definition LIKE '%SECURITY DEFINER%'
    );

    IF view_count > 0 THEN
        RAISE WARNING 'STILL HAVE SECURITY DEFINER VIEWS: %', bad_views;
        RAISE EXCEPTION 'Failed to remove SECURITY DEFINER from % views', view_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All views now use security_invoker (user permissions)';
    END IF;
END $$;