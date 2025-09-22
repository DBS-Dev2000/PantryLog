-- Migration: Create ML feedback and rules system for intelligent ingredient matching
-- Date: January 22, 2025
-- Description: Foundation tables for machine learning feedback, global rules, and household customizations
-- Version 2: Fixed users table references and view syntax

-- ============================================
-- 1. INGREDIENT MATCH FEEDBACK TABLE
-- ============================================
-- Stores user feedback on ingredient matches for ML training
CREATE TABLE IF NOT EXISTS ingredient_match_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Match information
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_ingredient TEXT NOT NULL,
  matched_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  matched_product_name TEXT NOT NULL,

  -- Feedback details
  is_correct BOOLEAN NOT NULL DEFAULT false,
  feedback_type TEXT CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'correction')),
  user_feedback TEXT, -- User's explanation of what's wrong
  confidence_score DECIMAL(3,2), -- Original match confidence (0.00-1.00)
  match_type TEXT, -- 'exact', 'partial', 'category', 'substitute'

  -- Correction information
  correct_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  correct_product_name TEXT,
  mark_as_not_available BOOLEAN DEFAULT false,

  -- Metadata
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT unique_feedback_per_user UNIQUE (recipe_id, recipe_ingredient, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_household ON ingredient_match_feedback(household_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON ingredient_match_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_incorrect ON ingredient_match_feedback(is_correct) WHERE is_correct = false;

-- ============================================
-- 2. GLOBAL INGREDIENT RULES TABLE
-- ============================================
-- Admin-managed ingredient equivalencies and rules
CREATE TABLE IF NOT EXISTS ingredient_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Rule definition
  rule_type TEXT NOT NULL CHECK (rule_type IN ('equivalency', 'exclusion', 'category')),
  ingredient_name TEXT NOT NULL,

  -- Rule data (JSONB for flexibility)
  equivalents JSONB, -- ["sea salt", "kosher salt", "table salt", ...]
  excluded_matches JSONB, -- ["mustard", "soup", ...]
  category_info JSONB, -- {"category": "dairy", "subcategory": "cheese", ...}

  -- Confidence and validation
  confidence_threshold DECIMAL(3,2) DEFAULT 1.0,
  min_word_length INTEGER DEFAULT 4, -- For partial matching

  -- Admin management
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false, -- Can't be deleted if true
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- Source tracking
  source TEXT CHECK (source IN ('system', 'admin', 'ml_generated', 'user_suggested')),
  source_feedback_ids UUID[], -- References to feedback that led to this rule

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,

  -- Ensure unique rules per ingredient and type
  CONSTRAINT unique_ingredient_rule UNIQUE (ingredient_name, rule_type)
);

CREATE INDEX IF NOT EXISTS idx_rules_ingredient ON ingredient_rules(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_rules_active ON ingredient_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rules_approved ON ingredient_rules(approved) WHERE approved = true;

-- ============================================
-- 3. HOUSEHOLD INGREDIENT PREFERENCES TABLE
-- ============================================
-- Household-specific substitutions and dietary preferences
CREATE TABLE IF NOT EXISTS household_ingredient_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

  -- Rule definition
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'substitution',  -- Replace X with Y
    'dietary',       -- Vegan, vegetarian, etc.
    'allergy',       -- Never use X
    'preference',    -- Prefer X over Y
    'exclusion'      -- Never match X with Y
  )),

  -- Substitution rules
  from_ingredient TEXT,
  to_ingredient TEXT,
  applies_to_category TEXT, -- Optional: "all meat", "all dairy", etc.

  -- Rule configuration
  priority INTEGER DEFAULT 100, -- Higher priority overrides lower
  is_active BOOLEAN DEFAULT true,

  -- Additional settings
  dietary_tags TEXT[], -- ['vegan', 'gluten_free', 'halal', 'kosher', ...]
  allergen_exclusions TEXT[], -- ['peanuts', 'tree_nuts', 'shellfish', ...]

  -- Metadata
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique rules per household
  CONSTRAINT unique_household_rule UNIQUE (household_id, rule_type, from_ingredient, to_ingredient)
);

CREATE INDEX IF NOT EXISTS idx_household_rules_household ON household_ingredient_rules(household_id);
CREATE INDEX IF NOT EXISTS idx_household_rules_active ON household_ingredient_rules(is_active) WHERE is_active = true;

-- ============================================
-- 4. INGREDIENT RULE SUGGESTIONS TABLE
-- ============================================
-- ML-generated or user-suggested rules pending admin review
CREATE TABLE IF NOT EXISTS ingredient_rule_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Suggestion details
  suggestion_type TEXT CHECK (suggestion_type IN ('equivalency', 'exclusion', 'correction')),
  ingredient_1 TEXT NOT NULL,
  ingredient_2 TEXT,

  -- Supporting data
  occurrence_count INTEGER DEFAULT 1, -- How many times this was suggested
  confidence_score DECIMAL(3,2), -- ML confidence in this suggestion
  supporting_feedback_ids UUID[], -- References to feedback supporting this

  -- Review status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_info')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- If approved, link to created rule
  created_rule_id UUID REFERENCES ingredient_rules(id) ON DELETE SET NULL,

  -- Metadata
  suggested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON ingredient_rule_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_confidence ON ingredient_rule_suggestions(confidence_score DESC);

-- ============================================
-- 5. INGREDIENT LEARNING METRICS TABLE
-- ============================================
-- Track system performance and learning progress
CREATE TABLE IF NOT EXISTS ingredient_learning_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Metric identification
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'accuracy',
    'false_positive',
    'false_negative',
    'user_correction',
    'new_equivalency',
    'exclusion_added'
  )),

  -- Metrics data
  total_matches INTEGER DEFAULT 0,
  correct_matches INTEGER DEFAULT 0,
  incorrect_matches INTEGER DEFAULT 0,
  accuracy_percentage DECIMAL(5,2),

  -- Category breakdown (JSONB for flexibility)
  category_metrics JSONB, -- {"dairy": 0.95, "proteins": 0.87, ...}
  common_errors JSONB, -- [{"from": "chicken soup", "to": "chicken broth", "count": 15}, ...]

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one metric per type per day
  CONSTRAINT unique_metric_per_day UNIQUE (metric_date, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_metrics_date ON ingredient_learning_metrics(metric_date DESC);

-- ============================================
-- 6. ADMIN USERS TABLE (if not exists)
-- ============================================
-- Create a simple admin tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. VIEWS FOR EASIER QUERYING
-- ============================================

-- View for active global rules with equivalencies
CREATE OR REPLACE VIEW active_ingredient_equivalencies AS
SELECT
  ingredient_name,
  equivalents,
  excluded_matches,
  confidence_threshold
FROM ingredient_rules
WHERE is_active = true
  AND approved = true
  AND rule_type = 'equivalency';

-- View for household preferences with dietary tags
-- Using CTEs to properly handle array aggregation
CREATE OR REPLACE VIEW household_dietary_preferences AS
WITH household_tags AS (
  SELECT
    household_id,
    unnest(dietary_tags) as tag
  FROM household_ingredient_rules
  WHERE is_active = true AND dietary_tags IS NOT NULL
),
household_allergens AS (
  SELECT
    household_id,
    unnest(allergen_exclusions) as allergen
  FROM household_ingredient_rules
  WHERE is_active = true AND allergen_exclusions IS NOT NULL
)
SELECT
  h.id as household_id,
  h.name as household_name,
  COALESCE(array_agg(DISTINCT ht.tag) FILTER (WHERE ht.tag IS NOT NULL), ARRAY[]::text[]) as dietary_tags,
  COALESCE(array_agg(DISTINCT ha.allergen) FILTER (WHERE ha.allergen IS NOT NULL), ARRAY[]::text[]) as allergens,
  COUNT(DISTINCT hir.id) as total_rules
FROM households h
LEFT JOIN household_ingredient_rules hir ON h.id = hir.household_id AND hir.is_active = true
LEFT JOIN household_tags ht ON h.id = ht.household_id
LEFT JOIN household_allergens ha ON h.id = ha.household_id
GROUP BY h.id, h.name;

-- View for pending admin reviews
CREATE OR REPLACE VIEW pending_rule_reviews AS
SELECT
  'suggestion' as review_type,
  id,
  suggestion_type as rule_type,
  ingredient_1,
  ingredient_2,
  occurrence_count,
  confidence_score,
  created_at
FROM ingredient_rule_suggestions
WHERE status = 'pending'
UNION ALL
SELECT
  'rule' as review_type,
  id,
  rule_type,
  ingredient_name as ingredient_1,
  NULL as ingredient_2,
  1 as occurrence_count,
  confidence_threshold as confidence_score,
  created_at
FROM ingredient_rules
WHERE approved = false AND is_active = true
ORDER BY created_at DESC;

-- ============================================
-- 8. HELPER FUNCTIONS
-- ============================================

-- Function to record feedback and trigger learning
CREATE OR REPLACE FUNCTION record_ingredient_feedback(
  p_recipe_id UUID,
  p_recipe_ingredient TEXT,
  p_matched_product_id UUID,
  p_matched_product_name TEXT,
  p_is_correct BOOLEAN,
  p_feedback_type TEXT,
  p_user_feedback TEXT,
  p_correct_product_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_household_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_feedback_id UUID;
BEGIN
  -- Insert or update feedback
  INSERT INTO ingredient_match_feedback (
    recipe_id,
    recipe_ingredient,
    matched_product_id,
    matched_product_name,
    is_correct,
    feedback_type,
    user_feedback,
    correct_product_id,
    user_id,
    household_id
  ) VALUES (
    p_recipe_id,
    p_recipe_ingredient,
    p_matched_product_id,
    p_matched_product_name,
    p_is_correct,
    p_feedback_type,
    p_user_feedback,
    p_correct_product_id,
    p_user_id,
    p_household_id
  )
  ON CONFLICT (recipe_id, recipe_ingredient, user_id)
  DO UPDATE SET
    is_correct = EXCLUDED.is_correct,
    feedback_type = EXCLUDED.feedback_type,
    user_feedback = EXCLUDED.user_feedback,
    correct_product_id = EXCLUDED.correct_product_id,
    created_at = NOW()
  RETURNING id INTO v_feedback_id;

  -- Trigger learning analysis if enough negative feedback
  IF NOT p_is_correct THEN
    PERFORM analyze_feedback_patterns(p_recipe_ingredient, p_matched_product_name);
  END IF;

  RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze patterns and suggest rules
CREATE OR REPLACE FUNCTION analyze_feedback_patterns(
  p_ingredient TEXT,
  p_incorrect_match TEXT
) RETURNS VOID AS $$
DECLARE
  v_error_count INTEGER;
  v_total_count INTEGER;
  v_confidence DECIMAL(3,2);
BEGIN
  -- Count how many times this specific error occurred
  SELECT COUNT(*) INTO v_error_count
  FROM ingredient_match_feedback
  WHERE recipe_ingredient = p_ingredient
    AND matched_product_name = p_incorrect_match
    AND is_correct = false;

  -- Count total feedback for this ingredient
  SELECT COUNT(*) INTO v_total_count
  FROM ingredient_match_feedback
  WHERE recipe_ingredient = p_ingredient;

  -- Calculate confidence that this is a bad match
  IF v_total_count > 0 THEN
    v_confidence := v_error_count::DECIMAL / v_total_count;
  ELSE
    v_confidence := 0;
  END IF;

  -- If error occurs frequently enough, suggest an exclusion rule
  IF v_error_count >= 3 AND v_confidence >= 0.5 THEN
    INSERT INTO ingredient_rule_suggestions (
      suggestion_type,
      ingredient_1,
      ingredient_2,
      occurrence_count,
      confidence_score
    ) VALUES (
      'exclusion',
      p_ingredient,
      p_incorrect_match,
      v_error_count,
      v_confidence
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE ingredient_match_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_ingredient_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_rule_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_learning_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Feedback policies - users can see and create their own
CREATE POLICY "Users can view own feedback" ON ingredient_match_feedback
  FOR SELECT USING (auth.uid() = user_id OR household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create feedback" ON ingredient_match_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback" ON ingredient_match_feedback
  FOR UPDATE USING (auth.uid() = user_id);

-- Household rules - household members can manage
CREATE POLICY "Household members can view rules" ON household_ingredient_rules
  FOR SELECT USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Household admins can manage rules" ON household_ingredient_rules
  FOR ALL USING (household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));

-- Global rules - everyone can read approved, admins can write
CREATE POLICY "Everyone can view approved rules" ON ingredient_rules
  FOR SELECT USING (approved = true AND is_active = true);

CREATE POLICY "Admins can manage all rules" ON ingredient_rules
  FOR ALL USING (EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Suggestions - users can see their own, admins see all
CREATE POLICY "Users can view own suggestions" ON ingredient_rule_suggestions
  FOR SELECT USING (
    suggested_by = auth.uid() OR
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create suggestions" ON ingredient_rule_suggestions
  FOR INSERT WITH CHECK (auth.uid() = suggested_by);

-- Metrics - admins only
CREATE POLICY "Admins can view metrics" ON ingredient_learning_metrics
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Admin users - admins only
CREATE POLICY "Admins can view admin users" ON admin_users
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

CREATE POLICY "Super admins can manage admin users" ON admin_users
  FOR ALL USING (EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid() AND is_super_admin = true
  ));

-- ============================================
-- 10. INITIAL SYSTEM RULES
-- ============================================

-- Insert some default system rules based on our existing equivalencies
INSERT INTO ingredient_rules (ingredient_name, rule_type, equivalents, is_system_default, approved, source)
VALUES
  ('salt', 'equivalency', '["sea salt", "kosher salt", "table salt", "himalayan salt", "pink salt", "rock salt", "fine salt", "coarse salt", "mediterranean sea salt", "celtic salt", "fleur de sel"]'::jsonb, true, true, 'system'),
  ('eggs', 'equivalency', '["egg", "large eggs", "medium eggs", "extra large eggs", "farm eggs", "free range eggs", "organic eggs", "brown eggs", "white eggs"]'::jsonb, true, true, 'system'),
  ('egg whites', 'equivalency', '["eggs", "egg white", "liquid egg whites", "egg albumen"]'::jsonb, true, true, 'system'),
  ('egg yolks', 'equivalency', '["eggs", "egg yolk", "egg yellow"]'::jsonb, true, true, 'system'),
  ('chicken broth', 'equivalency', '["chicken stock", "chicken bouillon", "chicken base", "chicken bone broth"]'::jsonb, true, true, 'system'),
  ('chicken broth', 'exclusion', '["chicken soup", "chicken noodle soup", "cream of chicken soup", "chicken and rice soup"]'::jsonb, true, true, 'system'),
  ('garlic', 'equivalency', '["fresh garlic", "garlic cloves", "garlic bulb", "minced garlic", "chopped garlic"]'::jsonb, true, true, 'system'),
  ('garlic cloves', 'equivalency', '["garlic", "clove of garlic", "fresh garlic"]'::jsonb, true, true, 'system'),
  ('garlic', 'exclusion', '["garlic mustard", "garlic salt", "garlic powder", "garlic bread", "garlic sauce"]'::jsonb, true, true, 'system'),
  ('butter', 'equivalency', '["unsalted butter", "salted butter", "sweet cream butter", "european butter", "irish butter", "cultured butter"]'::jsonb, true, true, 'system'),
  ('milk', 'equivalency', '["whole milk", "2% milk", "1% milk", "skim milk", "fat free milk", "reduced fat milk", "fresh milk"]'::jsonb, true, true, 'system'),
  ('flour', 'equivalency', '["all-purpose flour", "all purpose flour", "plain flour", "white flour", "wheat flour"]'::jsonb, true, true, 'system'),
  ('sugar', 'equivalency', '["granulated sugar", "white sugar", "cane sugar", "beet sugar", "superfine sugar", "caster sugar"]'::jsonb, true, true, 'system'),
  ('brown sugar', 'equivalency', '["light brown sugar", "dark brown sugar", "muscovado sugar", "turbinado sugar", "demerara sugar"]'::jsonb, true, true, 'system'),
  ('chicken', 'equivalency', '["chicken breast", "chicken thighs", "chicken legs", "chicken wings", "whole chicken"]'::jsonb, true, true, 'system'),
  ('chicken breast', 'equivalency', '["chicken", "boneless chicken breast", "skinless chicken breast", "chicken breasts"]'::jsonb, true, true, 'system'),
  ('beef', 'equivalency', '["ground beef", "beef steak", "beef roast", "stew meat"]'::jsonb, true, true, 'system'),
  ('ground beef', 'equivalency', '["beef", "hamburger", "minced beef", "beef mince", "ground chuck", "ground sirloin"]'::jsonb, true, true, 'system')
ON CONFLICT (ingredient_name, rule_type) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE ON ingredient_match_feedback TO authenticated;
GRANT INSERT, UPDATE, DELETE ON household_ingredient_rules TO authenticated;
GRANT INSERT ON ingredient_rule_suggestions TO authenticated;
GRANT SELECT ON active_ingredient_equivalencies TO authenticated;
GRANT SELECT ON household_dietary_preferences TO authenticated;
GRANT SELECT ON pending_rule_reviews TO authenticated;