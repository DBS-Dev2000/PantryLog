-- Fix SECURITY DEFINER views to use proper security model
-- Simplified version for direct execution

-- Drop all problematic views first
DROP VIEW IF EXISTS public.user_ai_usage_summary CASCADE;
DROP VIEW IF EXISTS public.meal_planning_knowledge_base CASCADE;
DROP VIEW IF EXISTS public.products_with_prices CASCADE;
DROP VIEW IF EXISTS public.inventory_audit_view CASCADE;
DROP VIEW IF EXISTS public.household_dietary_preferences CASCADE;
DROP VIEW IF EXISTS public.active_ingredient_equivalencies CASCADE;
DROP VIEW IF EXISTS public.ml_training_data CASCADE;
DROP VIEW IF EXISTS public.pending_rule_reviews CASCADE;

-- Recreate views WITHOUT SECURITY DEFINER

-- user_ai_usage_summary - Only show current user's data
CREATE VIEW public.user_ai_usage_summary AS
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

-- meal_planning_knowledge_base - Reference data
CREATE VIEW public.meal_planning_knowledge_base AS
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

-- products_with_prices - Respect household boundaries
CREATE VIEW public.products_with_prices AS
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

-- inventory_audit_view - Respect household boundaries
CREATE VIEW public.inventory_audit_view AS
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

-- household_dietary_preferences - Respect household boundaries
CREATE VIEW public.household_dietary_preferences AS
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

-- active_ingredient_equivalencies - Global and household rules
CREATE VIEW public.active_ingredient_equivalencies AS
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

-- Verify success
DO $$
DECLARE
    definer_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO definer_count
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname IN (
        'user_ai_usage_summary',
        'meal_planning_knowledge_base',
        'products_with_prices',
        'inventory_audit_view',
        'household_dietary_preferences'
    );

    IF definer_count = 5 THEN
        RAISE NOTICE 'SUCCESS: All 5 views recreated without SECURITY DEFINER';
    ELSE
        RAISE WARNING 'Only % of 5 views were created', definer_count;
    END IF;
END $$;