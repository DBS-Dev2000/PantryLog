# Changelog

All notable changes to PantryIQ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.3.0] - 2025-01-23

### 🔒 Security
- **CRITICAL FIX**: Enabled Row Level Security (RLS) on 48+ tables that had policies but RLS disabled
- **CRITICAL FIX**: Removed SECURITY DEFINER from 6 views that were bypassing user permissions
- Fixed cross-household data exposure vulnerability
- Implemented proper household isolation across all database views
- Added explicit `security_invoker = true` to all views for proper permission enforcement

### 🛠️ Database Changes
- Created migration `20250123_critical_security_fix_enable_rls.sql` to enable RLS
- Created migration `20250123_force_remove_security_definer.sql` to fix views
- Fixed column references in `ml_ingredient_feedback` views
- Updated `ingredient_match_feedback` table references

### 📚 Documentation
- Added comprehensive security update documentation
- Created migration runner script for easier deployment
- Updated deployment instructions with security fixes

### 🔧 Technical Improvements
- Added `scripts/run-migrations.js` for automated migration management
- Fixed JSONB array handling in `household_dietary_preferences` view
- Corrected column mappings in security views

## [2.2.0] - 2025-01-22

### ✨ Features
- **Intelligent Food Management System**: Automatic shelf life calculation with 500+ food database
- **Smart Categorization**: Hierarchical food taxonomy with confidence scoring
- **Intelligent Ingredient Matching**: Multi-tier matching system with equivalency database
- **ML Feedback System**: User corrections improve matching accuracy
- **Meal Planning Enhancements**: Attendance tracking, guest management, drag-and-drop

### 🎨 UI/UX Improvements
- Mobile-optimized meal planner scorecards
- Color-coded recipe shopping buttons (green=stock, yellow=low, blue=need)
- Accordion-based displays for better mobile readability
- Fixed recipe grid layout issues

### 🐛 Bug Fixes
- Fixed meal planner date handling with proper week calculations
- Resolved "September 14th" date generation bug
- Fixed database VARCHAR constraints blocking barcode scanning
- Corrected false matches in ingredient matching (garlic/mustard, soup/broth)

## [2.1.0] - 2025-01-21

### ✨ Features
- Complete meal planning system with AI-powered suggestions
- Recipe import from YouTube and websites
- Photo scanning for handwritten recipes
- Smart shopping list generation from meal plans
- Multi-list shopping system with household sharing

### 💼 Enterprise Features
- 4-tier subscription model ($0-$19.99/month)
- Comprehensive admin dashboard
- Feature toggle system
- AI usage tracking and limits
- Household management with role-based access

### 🚀 Performance
- Moved food data to database for better performance
- Implemented caching for feature permissions (5-minute cache)
- Optimized ingredient matching algorithms

## [2.0.0] - 2025-01-15

### 🎉 Major Release
- Rebranded from PFIMS to PantryIQ
- Launch of complete kitchen intelligence ecosystem
- Production deployment at https://PantryIQ.prolongedpantry.com

### ✨ Core Features
- Smart inventory management with hierarchical storage
- AI visual recognition for products
- Barcode scanning integration
- FIFO tracking and expiration alerts
- Household collaboration features

### 🏗️ Infrastructure
- Supabase backend with PostgreSQL
- Next.js 13+ with App Router
- Material-UI component library
- Redux Toolkit state management

## [1.0.0] - 2024-12-01

### 🚀 Initial Release
- Basic pantry inventory tracking
- User authentication
- Household management
- Storage location management
- Product database with UPC support

---

## Version History Summary

- **v2.3.0**: Critical security fixes for RLS and SECURITY DEFINER vulnerabilities
- **v2.2.0**: Intelligent food management and ingredient matching
- **v2.1.0**: Meal planning and enterprise features
- **v2.0.0**: Major rebrand and production launch
- **v1.0.0**: Initial release with basic inventory management

## Security Notices

### January 23, 2025
⚠️ **Critical Security Update Required**: All deployments prior to v2.3.0 must apply security migrations immediately to fix RLS vulnerabilities. See `docs/SECURITY_UPDATES.md` for details.

---

For detailed migration instructions and security fixes, please refer to:
- [Security Updates Documentation](docs/SECURITY_UPDATES.md)
- [Migration Guide](docs/MIGRATION.md)
- [API Documentation](docs/API.md)