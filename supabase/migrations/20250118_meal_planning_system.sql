-- Meal Planning System Database Schema

-- Household member profiles (individuals within a household)
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  birth_date DATE,
  age_group VARCHAR(20) CHECK (age_group IN ('infant', 'toddler', 'child', 'teen', 'adult', 'senior')),
  is_primary_meal_planner BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(household_id, name)
);

-- Dietary restrictions and allergies
CREATE TABLE IF NOT EXISTS dietary_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  restriction_type VARCHAR(50) NOT NULL CHECK (restriction_type IN (
    'allergy', 'intolerance', 'preference', 'medical', 'religious', 'ethical'
  )),
  name VARCHAR(100) NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Diet types and nutritional goals
CREATE TABLE IF NOT EXISTS member_diets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  diet_type VARCHAR(50) CHECK (diet_type IN (
    'standard', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo',
    'mediterranean', 'low_carb', 'low_fat', 'diabetic', 'gluten_free',
    'dairy_free', 'halal', 'kosher', 'other'
  )),
  calorie_target INTEGER,
  protein_target INTEGER, -- grams
  carb_target INTEGER, -- grams
  fat_target INTEGER, -- grams
  fiber_target INTEGER, -- grams
  sodium_limit INTEGER, -- mg
  sugar_limit INTEGER, -- grams
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id)
);

-- Food preferences (likes and dislikes)
CREATE TABLE IF NOT EXISTS food_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  preference_type VARCHAR(20) NOT NULL CHECK (preference_type IN ('like', 'dislike', 'favorite')),
  category VARCHAR(50) CHECK (category IN ('ingredient', 'cuisine', 'cooking_method', 'meal_type')),
  value VARCHAR(200) NOT NULL,
  intensity INTEGER DEFAULT 5 CHECK (intensity >= 1 AND intensity <= 10), -- 1=mild, 10=strong
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Household meal planning preferences
CREATE TABLE IF NOT EXISTS household_meal_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  planning_frequency VARCHAR(20) DEFAULT 'weekly' CHECK (planning_frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  budget_per_week DECIMAL(10,2),
  preferred_prep_time_weekday INTEGER DEFAULT 30, -- minutes
  preferred_prep_time_weekend INTEGER DEFAULT 60, -- minutes
  meal_prep_day VARCHAR(10), -- e.g., 'sunday'
  shopping_day VARCHAR(10), -- e.g., 'saturday'
  default_servings INTEGER DEFAULT 4,
  include_leftovers BOOLEAN DEFAULT true,
  leftover_days INTEGER DEFAULT 2,
  cooking_skill_level VARCHAR(20) DEFAULT 'intermediate' CHECK (cooking_skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  kitchen_equipment JSONB, -- array of available equipment
  preferred_stores JSONB, -- array of store preferences
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(household_id)
);

-- Weekly schedule (for planning around activities)
CREATE TABLE IF NOT EXISTS household_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id UUID REFERENCES household_members(id) ON DELETE CASCADE, -- optional, for individual schedules
  day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  time_available INTEGER DEFAULT 30, -- minutes available for prep
  location VARCHAR(50) DEFAULT 'home' CHECK (location IN ('home', 'work', 'school', 'on_the_go', 'restaurant')),
  attendees INTEGER, -- number of people eating
  notes TEXT, -- e.g., "Soccer practice night", "Date night"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_schedule UNIQUE(household_id, member_id, day_of_week, meal_type)
);

-- Meal plans
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name VARCHAR(200),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  total_cost DECIMAL(10,2),
  total_prep_time INTEGER, -- minutes
  shopping_list_generated BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Planned meals (individual meals within a meal plan)
CREATE TABLE IF NOT EXISTS planned_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id),
  custom_meal_name VARCHAR(200), -- for non-recipe meals like "takeout" or "leftovers"
  meal_date DATE NOT NULL,
  meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  servings INTEGER DEFAULT 4,
  for_members UUID[], -- array of member_ids this meal is for
  prep_time INTEGER, -- minutes
  cook_time INTEGER, -- minutes
  estimated_cost DECIMAL(10,2),
  notes TEXT,
  is_leftover_meal BOOLEAN DEFAULT false,
  leftover_from_meal_id UUID REFERENCES planned_meals(id),
  completed BOOLEAN DEFAULT false,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shopping list items generated from meal plans
CREATE TABLE IF NOT EXISTS meal_plan_shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  planned_meal_id UUID REFERENCES planned_meals(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  ingredient_name VARCHAR(200) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50),
  in_pantry BOOLEAN DEFAULT false, -- already have it
  purchased BOOLEAN DEFAULT false,
  store_preference VARCHAR(100),
  estimated_price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meal suggestions and recommendations
CREATE TABLE IF NOT EXISTS meal_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id),
  suggestion_type VARCHAR(50) CHECK (suggestion_type IN (
    'inventory_based', 'quick_meal', 'healthy', 'budget_friendly',
    'leftover_use', 'seasonal', 'trending', 'family_favorite'
  )),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reason TEXT,
  pantry_match_percentage INTEGER,
  additional_ingredients_needed INTEGER,
  estimated_additional_cost DECIMAL(10,2),
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meal history for learning preferences
CREATE TABLE IF NOT EXISTS meal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id),
  meal_name VARCHAR(200),
  served_date DATE NOT NULL,
  meal_type VARCHAR(20) CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  servings INTEGER,
  actual_prep_time INTEGER, -- minutes
  actual_cost DECIMAL(10,2),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  would_make_again BOOLEAN,
  difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
  member_ratings JSONB, -- {member_id: rating}
  feedback TEXT,
  tags JSONB, -- array of tags like "kid_approved", "quick", "company_worthy"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_dietary_restrictions_member ON dietary_restrictions(member_id);
CREATE INDEX IF NOT EXISTS idx_food_preferences_member ON food_preferences(member_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_household ON meal_plans(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_dates ON meal_plans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_planned_meals_plan ON planned_meals(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_planned_meals_date ON planned_meals(meal_date);
CREATE INDEX IF NOT EXISTS idx_meal_history_household ON meal_history(household_id);
CREATE INDEX IF NOT EXISTS idx_meal_history_date ON meal_history(served_date);

-- Row Level Security
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dietary_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_diets ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_meal_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see/edit their household's data)
CREATE POLICY "Users can view own household members" ON household_members
  FOR ALL USING (household_id = auth.uid());

CREATE POLICY "Users can view own dietary restrictions" ON dietary_restrictions
  FOR ALL USING (member_id IN (SELECT id FROM household_members WHERE household_id = auth.uid()));

CREATE POLICY "Users can view own meal plans" ON meal_plans
  FOR ALL USING (household_id = auth.uid());

-- Add similar policies for other tables...