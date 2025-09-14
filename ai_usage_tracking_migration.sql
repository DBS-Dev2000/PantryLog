-- AI Usage Tracking Migration
-- Run this in Supabase SQL Editor to add AI usage tracking and billing

-- Create user_ai_usage table for tracking AI consumption
CREATE TABLE IF NOT EXISTS user_ai_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- References auth.users(id)
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

    -- API Details
    api_provider VARCHAR(20) NOT NULL CHECK (api_provider IN ('claude', 'openai', 'gemini')),
    model_name VARCHAR(50) NOT NULL, -- e.g., 'claude-3-5-sonnet-20241022'
    api_endpoint VARCHAR(100) NOT NULL, -- e.g., '/api/analyze-item', '/api/process-receipt'

    -- Usage Metrics
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    image_count INTEGER DEFAULT 0, -- For vision API calls

    -- Cost Calculation
    input_cost DECIMAL(10,6) NOT NULL DEFAULT 0, -- Cost for input tokens
    output_cost DECIMAL(10,6) NOT NULL DEFAULT 0, -- Cost for output tokens
    image_cost DECIMAL(10,6) DEFAULT 0, -- Cost for image processing
    total_cost DECIMAL(10,6) NOT NULL DEFAULT 0, -- Total cost for this request

    -- Request Details
    request_type VARCHAR(50), -- 'item_recognition', 'receipt_processing', 'barcode_identification'
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    processing_time_ms INTEGER,

    -- Timestamps
    request_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user_billing_limits table for usage caps
CREATE TABLE IF NOT EXISTS user_billing_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE, -- References auth.users(id)

    -- Monthly Limits
    monthly_limit_dollars DECIMAL(10,2) DEFAULT 5.00, -- Default $5/month limit
    current_month_usage DECIMAL(10,2) DEFAULT 0,
    current_month_requests INTEGER DEFAULT 0,

    -- Daily Limits
    daily_limit_dollars DECIMAL(10,2) DEFAULT 1.00, -- Default $1/day limit
    current_day_usage DECIMAL(10,2) DEFAULT 0,
    current_day_requests INTEGER DEFAULT 0,

    -- Billing Status
    billing_enabled BOOLEAN DEFAULT true,
    free_tier_requests INTEGER DEFAULT 10, -- Free requests per month
    free_tier_used INTEGER DEFAULT 0,

    -- Plan Information
    subscription_plan VARCHAR(20) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'pro', 'unlimited')),

    -- Reset Tracking
    last_daily_reset DATE DEFAULT CURRENT_DATE,
    last_monthly_reset DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON user_ai_usage(user_id, request_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_household_date ON user_ai_usage(household_id, request_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_api_provider ON user_ai_usage(api_provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_request_type ON user_ai_usage(request_type);

-- Function to check if user can make AI request
CREATE OR REPLACE FUNCTION can_user_make_ai_request(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_limits RECORD;
    current_date DATE := CURRENT_DATE;
    current_month DATE := DATE_TRUNC('month', CURRENT_DATE);
BEGIN
    -- Get user limits
    SELECT * INTO user_limits
    FROM user_billing_limits
    WHERE user_id = p_user_id;

    -- If no limits record, create default one
    IF user_limits IS NULL THEN
        INSERT INTO user_billing_limits (user_id)
        VALUES (p_user_id);
        RETURN true;
    END IF;

    -- Check if billing is disabled
    IF NOT user_limits.billing_enabled THEN
        RETURN true;
    END IF;

    -- Reset daily usage if needed
    IF user_limits.last_daily_reset < current_date THEN
        UPDATE user_billing_limits
        SET current_day_usage = 0,
            current_day_requests = 0,
            last_daily_reset = current_date
        WHERE user_id = p_user_id;
        user_limits.current_day_usage := 0;
        user_limits.current_day_requests := 0;
    END IF;

    -- Reset monthly usage if needed
    IF user_limits.last_monthly_reset < current_month THEN
        UPDATE user_billing_limits
        SET current_month_usage = 0,
            current_month_requests = 0,
            free_tier_used = 0,
            last_monthly_reset = current_month
        WHERE user_id = p_user_id;
        user_limits.current_month_usage := 0;
        user_limits.current_month_requests := 0;
        user_limits.free_tier_used := 0;
    END IF;

    -- Check free tier first
    IF user_limits.free_tier_used < user_limits.free_tier_requests THEN
        RETURN true;
    END IF;

    -- Check daily limits
    IF user_limits.current_day_usage >= user_limits.daily_limit_dollars THEN
        RETURN false;
    END IF;

    -- Check monthly limits
    IF user_limits.current_month_usage >= user_limits.monthly_limit_dollars THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to log AI usage and update billing
CREATE OR REPLACE FUNCTION log_ai_usage(
    p_user_id UUID,
    p_household_id UUID,
    p_api_provider VARCHAR,
    p_model_name VARCHAR,
    p_api_endpoint VARCHAR,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_image_count INTEGER,
    p_total_cost DECIMAL,
    p_request_type VARCHAR,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL,
    p_processing_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    input_cost DECIMAL;
    output_cost DECIMAL;
    image_cost DECIMAL;
BEGIN
    -- Calculate costs (example rates for Claude 3.5 Sonnet)
    input_cost := p_input_tokens * 0.000003; -- $3 per million input tokens
    output_cost := p_output_tokens * 0.000015; -- $15 per million output tokens
    image_cost := p_image_count * 0.0048; -- $4.80 per 1000 images

    -- Log the usage
    INSERT INTO user_ai_usage (
        user_id,
        household_id,
        api_provider,
        model_name,
        api_endpoint,
        input_tokens,
        output_tokens,
        total_tokens,
        image_count,
        input_cost,
        output_cost,
        image_cost,
        total_cost,
        request_type,
        success,
        error_message,
        processing_time_ms
    ) VALUES (
        p_user_id,
        p_household_id,
        p_api_provider,
        p_model_name,
        p_api_endpoint,
        p_input_tokens,
        p_output_tokens,
        p_input_tokens + p_output_tokens,
        p_image_count,
        input_cost,
        output_cost,
        image_cost,
        input_cost + output_cost + image_cost,
        p_request_type,
        p_success,
        p_error_message,
        p_processing_time_ms
    );

    -- Update user billing limits
    INSERT INTO user_billing_limits (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update usage counters
    UPDATE user_billing_limits
    SET current_day_usage = current_day_usage + (input_cost + output_cost + image_cost),
        current_month_usage = current_month_usage + (input_cost + output_cost + image_cost),
        current_day_requests = current_day_requests + 1,
        current_month_requests = current_month_requests + 1,
        free_tier_used = CASE
            WHEN free_tier_used < free_tier_requests THEN free_tier_used + 1
            ELSE free_tier_used
        END,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for user usage summary
CREATE OR REPLACE VIEW user_ai_usage_summary AS
SELECT
    ual.user_id,
    ual.household_id,

    -- Today's usage
    COALESCE(SUM(CASE WHEN DATE(ual.request_date) = CURRENT_DATE THEN ual.total_cost END), 0) as today_cost,
    COALESCE(COUNT(CASE WHEN DATE(ual.request_date) = CURRENT_DATE THEN 1 END), 0) as today_requests,

    -- This month's usage
    COALESCE(SUM(CASE WHEN DATE_TRUNC('month', ual.request_date) = DATE_TRUNC('month', CURRENT_DATE) THEN ual.total_cost END), 0) as month_cost,
    COALESCE(COUNT(CASE WHEN DATE_TRUNC('month', ual.request_date) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END), 0) as month_requests,

    -- All time usage
    COALESCE(SUM(ual.total_cost), 0) as total_cost,
    COALESCE(COUNT(*), 0) as total_requests,

    -- Limits
    ubl.monthly_limit_dollars,
    ubl.daily_limit_dollars,
    ubl.free_tier_requests,
    ubl.free_tier_used,
    ubl.subscription_plan

FROM user_ai_usage ual
RIGHT JOIN user_billing_limits ubl ON ual.user_id = ubl.user_id
GROUP BY ual.user_id, ual.household_id, ubl.monthly_limit_dollars, ubl.daily_limit_dollars,
         ubl.free_tier_requests, ubl.free_tier_used, ubl.subscription_plan;

-- Insert default billing limits for existing users
INSERT INTO user_billing_limits (user_id)
SELECT DISTINCT h.id
FROM households h
WHERE NOT EXISTS (
    SELECT 1 FROM user_billing_limits ubl WHERE ubl.user_id = h.id
);

-- Disable RLS for usage tracking tables
ALTER TABLE user_ai_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_billing_limits DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE user_ai_usage IS 'Detailed tracking of AI API usage for billing and analytics';
COMMENT ON TABLE user_billing_limits IS 'User-specific AI usage limits and billing configuration';
COMMENT ON FUNCTION can_user_make_ai_request(UUID) IS 'Checks if user can make AI request within their limits';
COMMENT ON FUNCTION log_ai_usage IS 'Logs AI usage and updates billing counters with cost calculation';