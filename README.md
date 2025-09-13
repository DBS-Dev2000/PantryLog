# PantryLog - Smart Kitchen Inventory Management

A comprehensive inventory management system for tracking food items across pantries, freezers, and refrigerators. Built with Next.js, TypeScript, and Supabase.

## Features

- **Multi-location Inventory**: Track items across pantries, freezers, and refrigerators
- **Barcode Scanning**: Quick item entry via barcode scanning
- **FIFO Management**: First-in-first-out rotation to minimize waste
- **Expiration Tracking**: Monitor items approaching expiration
- **Recipe Integration**: Match recipes to available ingredients
- **Household Management**: Multi-user support for families

## Tech Stack

- **Frontend**: Next.js 13+ with App Router, TypeScript, Material-UI
- **Backend**: Supabase (PostgreSQL + Authentication)
- **State Management**: Redux Toolkit
- **Hosting**: Designed for Vercel deployment
- **Database**: Supabase PostgreSQL with Row Level Security

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a new Supabase project
   - Copy `.env.local.example` to `.env.local`
   - Add your Supabase URL and keys to `.env.local`

3. **Run database migrations:**
   ```bash
   # If using Supabase CLI locally
   supabase start
   supabase db reset

   # Or apply the migration manually in Supabase dashboard
   # Use the SQL in supabase/migrations/001_initial_schema.sql
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open http://localhost:3000**

### Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_PROJECT_ID=your_supabase_project_id

# Optional: For barcode API integration
BARCODE_API_KEY=your_barcode_api_key
BARCODE_API_URL=https://api.upcitemdb.com
```

## Database Schema

The system uses the following core tables:

- **households**: Household/family units
- **household_members**: User-household relationships
- **storage_locations**: Pantry, freezer, refrigerator locations
- **products**: Product master data (with UPC/barcode support)
- **inventory_items**: Current inventory with FIFO tracking
- **recipes** & **recipe_ingredients**: Recipe management

## Key Features Implementation

### FIFO Tracking
Items are automatically sorted by purchase date to ensure oldest items are used first:

```sql
SELECT * FROM inventory_items
WHERE product_id = ? AND household_id = ? AND is_consumed = false
ORDER BY purchase_date ASC, expiration_date ASC
```

### Row Level Security
All data is protected by Supabase RLS policies ensuring users only access their household data.

### Barcode Integration
Ready for integration with UPC databases for automatic product information retrieval.

## Project Structure

```
src/
├── app/                 # Next.js app router
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configurations
├── store/              # Redux store and slices
└── types/              # TypeScript type definitions

supabase/
├── config.toml         # Local Supabase configuration
└── migrations/         # Database schema migrations
```

## Deployment

### Vercel Deployment

1. **Connect to Vercel:**
   ```bash
   npx vercel --prod
   ```

2. **Set environment variables in Vercel dashboard**

3. **Update Supabase settings:**
   - Add your Vercel domain to Supabase Auth settings
   - Update redirect URLs

### Database Setup in Production

1. Apply migrations in Supabase dashboard
2. Set up Row Level Security policies
3. Configure authentication settings

## Development Roadmap

### Phase 1: Core Features ✅
- User authentication and household management
- Basic inventory CRUD operations
- Storage location management
- Database schema and security

### Phase 2: Enhanced Inventory
- Barcode scanning integration
- Product search and filtering
- FIFO recommendations
- Expiration alerts

### Phase 3: Recipe Management
- Recipe CRUD operations
- Ingredient availability checking
- Meal planning integration

### Phase 4: Advanced Features
- Mobile app (React Native)
- Reporting and analytics
- Shopping list integration
- Bulk operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with appropriate tests
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or issues:
1. Check the existing issues on GitHub
2. Create a new issue with detailed description
3. Include steps to reproduce any bugs

---

Built with ❤️ for efficient kitchen management