-- Create ML feedback tables for improving ingredient matching

CREATE TABLE IF NOT EXISTS ml_ingredient_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL,
    user_id UUID NOT NULL,
    recipe_id UUID NOT NULL,
    recipe_ingredient TEXT NOT NULL,
    matched_product TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    feedback_reason TEXT,
    correct_product_id UUID,
    correct_product_name TEXT,
    match_type TEXT,
    match_confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for ML training queries
CREATE INDEX IF NOT EXISTS idx_ml_feedback_incorrect ON ml_ingredient_feedback(is_correct) WHERE is_correct = false;
CREATE INDEX IF NOT EXISTS idx_ml_feedback_ingredient ON ml_ingredient_feedback(recipe_ingredient);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_product ON ml_ingredient_feedback(matched_product);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_created ON ml_ingredient_feedback(created_at DESC);

-- Create view for ML training data
CREATE OR REPLACE VIEW ml_training_data AS
SELECT
    recipe_ingredient,
    matched_product,
    COUNT(*) as feedback_count,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
    SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) as incorrect_count,
    ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*), 2) as accuracy_percentage,
    array_agg(DISTINCT feedback_reason) FILTER (WHERE feedback_reason IS NOT NULL) as feedback_reasons,
    array_agg(DISTINCT correct_product_name) FILTER (WHERE correct_product_name IS NOT NULL) as suggested_corrections
FROM ml_ingredient_feedback
GROUP BY recipe_ingredient, matched_product
HAVING COUNT(*) >= 2 -- Only show patterns with at least 2 feedbacks
ORDER BY incorrect_count DESC, feedback_count DESC;