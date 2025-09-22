# PantryIQ - Smart Kitchen Intelligence Platform

## Project Overview

### Executive Summary
PantryIQ is a comprehensive, AI-powered kitchen management ecosystem that combines traditional preparedness with modern efficiency. The platform features intelligent inventory tracking, AI-powered recipe management, predictive shopping lists, household collaboration, and subscription-based advanced features.

**Current Status:** Production-ready with enterprise-level features and monetization framework

### Platform Evolution
- **Original Concept**: Basic pantry inventory tracking (PFIMS)
- **Current Reality**: Complete kitchen intelligence ecosystem with AI integration
- **Deployment**: Live at https://PantryIQ.prolongedpantry.com
- **Monetization**: Subscription tiers with feature gating ready for commercial deployment

### Business Value & Revenue Model
- **Reduce Food Waste**: AI-powered expiration tracking and consumption pattern analysis
- **Intelligent Shopping**: Predictive shopping lists based on usage patterns
- **Recipe Intelligence**: AI-powered recipe management with substitution suggestions
- **Household Collaboration**: Multi-user sharing with permission management
- **Subscription Revenue**: Four-tier monetization model ($0-$19.99/month)
- **AI Integration**: Advanced features powered by Claude and Gemini APIs

## 🎯 Current Feature Status (January 2025)

### ✅ Production Ready Features
- **Smart Inventory Management**: Hierarchical storage with QR code labeling
- **AI Visual Recognition**: Product identification with Claude/Gemini integration
- **Recipe Management**: Import from YouTube/websites, photo scanning, smart substitutions
- **Shopping Lists**: Multi-list system with household sharing and predictive AI
- **Household Management**: Professional user management with role-based access
- **Admin Dashboard**: Complete platform administration with feature toggles
- **Mobile Optimization**: Touch-friendly interface optimized for kitchen use

### ✅ NEWLY COMPLETED: Meal Planning System (January 22, 2025)
- **AI-Powered Meal Generation**: Smart meal plans based on family preferences and pantry inventory
- **Date Range Selection**: Week-based planning with proper Sunday-Saturday defaults
- **Attendance Management**: Track who's home with "everyone home" toggle or custom selection
- **Guest Management**: Add guests with dietary restrictions tracking
- **Drag-and-Drop Reorganization**: Move meals between days with visual feedback
- **Meal Details Dialog**: Rich information display with recipes, images, and star ratings
- **Recipe Integration**: Direct links to recipes that open in new tabs
- **"Add to My Recipes" Feature**: Import external recipes to personal collection
- **Pantry Scorecards**: Visual tracking of ingredient availability and utilization
- **Option Compliance**: Track adherence to budget/quick meal preferences
- **Mobile-Optimized Scorecards**: Accordion-based display for better readability

### 🔮 Advanced AI Features
- **Predictive Shopping**: Consumption pattern analysis with AI predictions
- **Smart Substitutions**: Context-aware ingredient alternatives
- **Recipe Photo Scanning**: Digitize handwritten recipes and cookbook pages
- **Visual Item Recognition**: Multi-provider AI with feedback learning
- **Ingredient Classification**: Smart matching (salt matches Mediterranean sea salt)
- **Meal Planning Intelligence**: Context-aware meal suggestions based on preferences and inventory

## 🎛️ Enterprise Admin System (September 15, 2025)

### ✅ NEWLY COMPLETED: Comprehensive Admin Dashboard
- **5-Tab Organized Interface**: System Overview, Users & Households, AI Configuration, AI Prompts, System Settings
- **Real-time Data Display**: Correct user counts, household metrics, AI usage statistics
- **Working Action Buttons**: View/Edit dialogs for users and households with full functionality
- **Professional UI/UX**: Enterprise-grade interface suitable for business customers

### ✅ NEWLY COMPLETED: 3-Tier Hierarchical Feature Management
- **System-Level Defaults**: Global enforcement modes and API limits
- **Household-Level Overrides**: Per-household feature toggles with enforcement mode control
- **User-Level Overrides**: Individual user permissions including unlimited AI access
- **Database Integration**: JSONB features column with helper functions and migrations
- **Real-time Persistence**: All feature toggles save and load correctly with visual feedback

### ✅ NEWLY COMPLETED: Frontend Feature Enforcement
- **Dynamic Navigation**: Menu items filtered based on household feature settings
- **Upsell System**: Professional upgrade dialogs with compelling feature descriptions
- **Enforcement Modes**: Both "Show as Upsell" and "Hide from Navigation" implemented
- **Visual Indicators**: Disabled features show with "Upgrade" chips and reduced opacity
- **Performance Optimized**: Caching system for feature permissions (5-minute cache)

### ✅ NEWLY COMPLETED: AI Usage Tracking Integration
- **Fixed User Linking**: AI usage now properly linked to users instead of showing null
- **Race Condition Resolved**: Components get fallback user ID when props undefined
- **Admin Visibility**: AI usage correctly displays in admin dashboard with user attribution

### Project Lifecycle Approach
- **Phase 1**: Core Infrastructure (Waterfall) - Authentication, Database, API Foundation
- **Phase 2**: Feature Development (Agile) - Inventory Management, Barcode Scanning
- **Phase 3**: Enhanced Features (Agile) - Recipe Management, Reports
- **Phase 4**: Optimization (Agile) - Performance, UX improvements

---

## Technical Architecture

### Technology Stack
```
Frontend:
- Web: React with TypeScript
- Mobile: React Native
- State Management: Redux Toolkit
- UI Framework: Material-UI (Web) / React Native Elements (Mobile)

Backend:
- API: .NET Core 8.0 Web API
- Database: Azure SQL Database
- Cache: Azure Redis Cache
- Storage: Azure Blob Storage (for custom label images)
- Authentication: Azure AD B2C

Infrastructure:
- Hosting: Azure App Service
- CDN: Azure CDN
- Monitoring: Application Insights
- CI/CD: Azure DevOps

External Services:
- Barcode API: UPCitemdb or Open Food Facts API
- Push Notifications: Azure Notification Hubs
```

### High-Level Architecture
```
┌─────────────────┐     ┌─────────────────┐
│   Web Client    │     │  Mobile Client  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │  Azure CDN  │
              └──────┬──────┘
                     │
           ┌─────────▼─────────┐
           │  Azure App Service│
           │   (.NET Core API) │
           └─────────┬─────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌───▼───┐  ┌────▼────┐
   │Azure SQL│  │ Redis  │  │  Blob   │
   │Database │  │ Cache  │  │ Storage │
   └─────────┘  └────────┘  └─────────┘
```

---

## Database Design

### Core Tables

```sql
-- Storage Locations
CREATE TABLE StorageLocations (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    HouseholdId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Type NVARCHAR(50) NOT NULL, -- 'Pantry', 'Freezer', 'Refrigerator'
    Description NVARCHAR(500),
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (HouseholdId) REFERENCES Households(Id)
);

-- Products Master
CREATE TABLE Products (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UPC NVARCHAR(50),
    Name NVARCHAR(200) NOT NULL,
    Brand NVARCHAR(100),
    Category NVARCHAR(100),
    DefaultShelfLifeDays INT,
    ImageUrl NVARCHAR(500),
    NutritionalInfo NVARCHAR(MAX), -- JSON
    IsCustom BIT DEFAULT 0,
    CreatedBy UNIQUEIDENTIFIER,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_Products_UPC (UPC)
);

-- Inventory Items
CREATE TABLE InventoryItems (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProductId UNIQUEIDENTIFIER NOT NULL,
    StorageLocationId UNIQUEIDENTIFIER NOT NULL,
    HouseholdId UNIQUEIDENTIFIER NOT NULL,
    Quantity DECIMAL(10,2) NOT NULL,
    Unit NVARCHAR(20), -- 'pieces', 'oz', 'lb', etc.
    PurchaseDate DATE NOT NULL,
    ExpirationDate DATE,
    Cost DECIMAL(10,2),
    Notes NVARCHAR(500),
    CustomLabel NVARCHAR(200),
    IsConsumed BIT DEFAULT 0,
    ConsumedDate DATETIME2,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (ProductId) REFERENCES Products(Id),
    FOREIGN KEY (StorageLocationId) REFERENCES StorageLocations(Id),
    FOREIGN KEY (HouseholdId) REFERENCES Households(Id),
    INDEX IX_InventoryItems_ExpirationDate (ExpirationDate),
    INDEX IX_InventoryItems_FIFO (ProductId, PurchaseDate)
);

-- Recipes
CREATE TABLE Recipes (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    HouseholdId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX),
    Instructions NVARCHAR(MAX),
    PrepTimeMinutes INT,
    CookTimeMinutes INT,
    Servings INT,
    Category NVARCHAR(100),
    Tags NVARCHAR(500), -- JSON array
    CreatedBy UNIQUEIDENTIFIER,
    CreatedDate DATETIME2 DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (HouseholdId) REFERENCES Households(Id)
);

-- Recipe Ingredients
CREATE TABLE RecipeIngredients (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecipeId UNIQUEIDENTIFIER NOT NULL,
    ProductId UNIQUEIDENTIFIER,
    IngredientName NVARCHAR(200) NOT NULL,
    Quantity DECIMAL(10,2) NOT NULL,
    Unit NVARCHAR(20),
    IsOptional BIT DEFAULT 0,
    FOREIGN KEY (RecipeId) REFERENCES Recipes(Id),
    FOREIGN KEY (ProductId) REFERENCES Products(Id)
);
```

---

## User Stories

### Epic 1: User Management & Authentication

#### US-001: User Registration
**As a** new user  
**I want to** create an account and set up my household  
**So that** I can start managing my inventory

**Acceptance Criteria:**
```gherkin
Given I am on the registration page
When I provide valid email, password, and household name
Then my account should be created
And I should be logged in automatically
And a new household should be created with me as admin
```

**Implementation Notes:**
```csharp
// API Endpoint
[HttpPost("api/auth/register")]
public async Task<IActionResult> Register(RegisterDto model)
{
    // 1. Validate model
    // 2. Create Azure AD B2C user
    // 3. Create household record
    // 4. Assign user as household admin
    // 5. Return JWT token
}
```

---

### Epic 2: Inventory Management

#### US-002: Add Product via Barcode
**As a** household member  
**I want to** scan a product barcode  
**So that** I can quickly add items to my inventory

**Acceptance Criteria:**
```gherkin
Given I have camera permission granted
When I scan a valid UPC barcode
Then the product information should be retrieved
And I should be able to specify quantity and storage location
And the item should be added to my inventory with current date as purchase date
```

**Implementation Notes:**
```csharp
[HttpPost("api/inventory/add-by-barcode")]
public async Task<IActionResult> AddByBarcode(AddByBarcodeDto model)
{
    // 1. Check Products table for UPC
    // 2. If not found, call external barcode API
    // 3. Cache product information
    // 4. Create inventory item
    // 5. Return created item with product details
    
    var product = await _productService.GetOrCreateByUPC(model.UPC);
    var inventoryItem = new InventoryItem
    {
        ProductId = product.Id,
        StorageLocationId = model.LocationId,
        Quantity = model.Quantity,
        PurchaseDate = DateTime.UtcNow,
        ExpirationDate = CalculateExpiration(product, model.CustomExpiration)
    };
}
```

#### US-003: Create Custom Product
**As a** household member  
**I want to** create custom products for homemade items  
**So that** I can track pre-made meals and bulk items

**Acceptance Criteria:**
```gherkin
Given I am on the add custom product screen
When I enter product name, category, and optional expiration period
Then a custom product should be created
And I should be able to print or save a custom label
And the product should be available for inventory tracking
```

---

### Epic 3: FIFO Management

#### US-004: FIFO Product Retrieval
**As a** household member  
**I want to** see which item to use first when selecting a product  
**So that** I can maintain freshness and reduce waste

**Acceptance Criteria:**
```gherkin
Given I have multiple items of the same product in inventory
When I search for or select that product
Then items should be displayed sorted by purchase date (oldest first)
And expiration dates should be clearly visible
And the recommended item to use should be highlighted
```

**SQL Query for FIFO:**
```sql
CREATE PROCEDURE GetProductInventoryFIFO
    @ProductId UNIQUEIDENTIFIER,
    @HouseholdId UNIQUEIDENTIFIER
AS
BEGIN
    SELECT 
        ii.*,
        sl.Name as LocationName,
        sl.Type as LocationType,
        DATEDIFF(day, GETUTCDATE(), ii.ExpirationDate) as DaysUntilExpiration
    FROM InventoryItems ii
    INNER JOIN StorageLocations sl ON ii.StorageLocationId = sl.Id
    WHERE ii.ProductId = @ProductId 
        AND ii.HouseholdId = @HouseholdId
        AND ii.IsConsumed = 0
    ORDER BY 
        ii.PurchaseDate ASC,  -- FIFO: Oldest first
        ii.ExpirationDate ASC -- Secondary sort by expiration
END
```

---

### Epic 4: Recipe Management

#### US-005: Recipe Availability Check
**As a** household member  
**I want to** see which recipes I can make with current inventory  
**So that** I can plan meals efficiently

**Acceptance Criteria:**
```gherkin
Given I have recipes saved in the system
When I view the recipes list
Then each recipe should show availability status:
  - "Can Make Now" (all ingredients available)
  - "Missing X items" (partial ingredients)
  - Highlight which ingredients I have/don't have
And recipes should be sortable by availability
```

---

### Epic 5: Reporting & Notifications

#### US-006: Expiration Report
**As a** household member  
**I want to** see items approaching expiration  
**So that** I can use them before they spoil

**Acceptance Criteria:**
```gherkin
Given I have items with expiration dates
When I run the expiration report
Then I should see items grouped by:
  - Expired (past date)
  - Expiring within 3 days
  - Expiring within 1 week
  - Expiring within 1 month
And each item should show its location
```

**Report Service Implementation:**
```csharp
public class ExpirationReportService
{
    public async Task<ExpirationReportDto> GenerateReport(Guid householdId)
    {
        var today = DateTime.UtcNow.Date;
        var items = await _context.InventoryItems
            .Include(i => i.Product)
            .Include(i => i.StorageLocation)
            .Where(i => i.HouseholdId == householdId 
                     && !i.IsConsumed
                     && i.ExpirationDate.HasValue)
            .OrderBy(i => i.ExpirationDate)
            .ToListAsync();

        return new ExpirationReportDto
        {
            Expired = items.Where(i => i.ExpirationDate < today),
            ExpiringIn3Days = items.Where(i => i.ExpirationDate >= today 
                                            && i.ExpirationDate <= today.AddDays(3)),
            ExpiringIn7Days = items.Where(i => i.ExpirationDate > today.AddDays(3) 
                                            && i.ExpirationDate <= today.AddDays(7)),
            ExpiringIn30Days = items.Where(i => i.ExpirationDate > today.AddDays(7) 
                                             && i.ExpirationDate <= today.AddDays(30))
        };
    }
}
```

---

## API Structure

### Core Controllers

```csharp
// InventoryController.cs
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InventoryController : ControllerBase
{
    [HttpGet("items")]
    public async Task<IActionResult> GetItems([FromQuery] InventoryFilterDto filter);
    
    [HttpPost("items")]
    public async Task<IActionResult> AddItem(AddInventoryItemDto model);
    
    [HttpPut("items/{id}")]
    public async Task<IActionResult> UpdateItem(Guid id, UpdateInventoryItemDto model);
    
    [HttpPost("items/{id}/consume")]
    public async Task<IActionResult> ConsumeItem(Guid id, ConsumeItemDto model);
    
    [HttpGet("items/expiring")]
    public async Task<IActionResult> GetExpiringItems([FromQuery] int daysAhead = 7);
    
    [HttpGet("items/search")]
    public async Task<IActionResult> SearchItems([FromQuery] string query);
}

// ProductController.cs
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductController : ControllerBase
{
    [HttpGet("barcode/{upc}")]
    public async Task<IActionResult> GetByBarcode(string upc);
    
    [HttpPost("custom")]
    public async Task<IActionResult> CreateCustomProduct(CreateCustomProductDto model);
    
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories();
}

// RecipeController.cs
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RecipeController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetRecipes([FromQuery] RecipeFilterDto filter);
    
    [HttpPost]
    public async Task<IActionResult> CreateRecipe(CreateRecipeDto model);
    
    [HttpGet("{id}/availability")]
    public async Task<IActionResult> CheckAvailability(Guid id);
    
    [HttpPost("{id}/cook")]
    public async Task<IActionResult> CookRecipe(Guid id);
}
```

---

## Security Considerations

### Authentication & Authorization
- **Azure AD B2C** for user authentication
- **JWT tokens** with 1-hour expiration
- **Refresh tokens** with 30-day expiration
- **Role-based access**: Admin, Member, Guest

### Data Security
```csharp
// Implement row-level security
public class SecureInventoryService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    
    private Guid GetCurrentHouseholdId()
    {
        var claim = _httpContextAccessor.HttpContext.User
            .FindFirst("householdId");
        return Guid.Parse(claim.Value);
    }
    
    public async Task<IQueryable<InventoryItem>> GetSecureQuery()
    {
        var householdId = GetCurrentHouseholdId();
        return _context.InventoryItems
            .Where(i => i.HouseholdId == householdId);
    }
}
```

### API Security
- **Rate limiting**: 100 requests per minute per user
- **CORS configuration**: Restrict to known domains
- **Input validation**: FluentValidation on all DTOs
- **SQL injection prevention**: Parameterized queries only

---

## Deployment Strategy

### Environment Configuration

```json
// appsettings.Production.json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=tcp:{server}.database.windows.net,1433;Database=PFIMS;",
    "RedisCache": "{cache-name}.redis.cache.windows.net:6380,ssl=true"
  },
  "AzureAdB2C": {
    "Instance": "https://{tenant}.b2clogin.com",
    "ClientId": "{client-id}",
    "Domain": "{tenant}.onmicrosoft.com"
  },
  "ExternalApis": {
    "BarcodeApi": {
      "BaseUrl": "https://api.upcitemdb.com",
      "ApiKey": "{api-key}"
    }
  }
}
```

### CI/CD Pipeline (Azure DevOps)

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - develop

stages:
  - stage: Build
    jobs:
      - job: BuildAPI
        steps:
          - task: DotNetCoreCLI@2
            inputs:
              command: 'build'
              projects: '**/*.csproj'
          
          - task: DotNetCoreCLI@2
            inputs:
              command: 'test'
              projects: '**/*Tests.csproj'
          
          - task: DotNetCoreCLI@2
            inputs:
              command: 'publish'
              publishWebProjects: true

  - stage: DeployDev
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/develop'))
    jobs:
      - deployment: DeployToDev
        environment: 'Development'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: 'Azure-Dev'
                    appName: 'pfims-api-dev'

  - stage: DeployProd
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployToProd
        environment: 'Production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: 'Azure-Prod'
                    appName: 'pfims-api'
```

---

## Sprint Planning

### Sprint 1 (Weeks 1-2): Foundation
- Set up Azure infrastructure
- Implement authentication with Azure AD B2C
- Create database schema
- Build basic API structure
- **Deliverable**: Working authentication and API foundation

### Sprint 2 (Weeks 3-4): Core Inventory
- Storage location management
- Product creation (manual entry)
- Basic inventory CRUD operations
- **Deliverable**: Basic inventory management

### Sprint 3 (Weeks 5-6): Barcode & Search
- Integrate barcode scanning (mobile)
- External barcode API integration
- Product search and filtering
- **Deliverable**: Barcode scanning functionality

### Sprint 4 (Weeks 7-8): FIFO & Expiration
- FIFO retrieval logic
- Expiration tracking
- Expiration reports
- Basic notifications
- **Deliverable**: FIFO system and expiration management

### Sprint 5 (Weeks 9-10): Recipe Management
- Recipe CRUD operations
- Ingredient matching
- Availability checking
- **Deliverable**: Recipe management system

### Sprint 6 (Weeks 11-12): Polish & Deploy
- UI/UX improvements
- Performance optimization
- User acceptance testing
- Production deployment
- **Deliverable**: Production-ready application

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| Barcode API limitations | Medium | High | Implement fallback to manual entry; Cache successful lookups |
| Multi-user sync conflicts | Medium | Medium | Implement optimistic concurrency with conflict resolution |
| Mobile camera compatibility | Low | High | Test on multiple devices; Provide manual UPC entry |
| Azure service costs | Medium | Medium | Implement caching; Monitor usage with alerts |
| Data migration complexity | Low | Medium | Create migration scripts; Test thoroughly in staging |

---

## Success Metrics

### Technical KPIs
- API response time < 200ms (p95)
- Mobile app load time < 3 seconds
- Barcode scan success rate > 85%
- System uptime > 99.5%

### Business KPIs
- User adoption rate (target: 80% of household members)
- Food waste reduction (target: 30% reduction)
- Active daily users (target: 60% DAU/MAU)
- Recipe usage rate (target: 3 recipes/week/household)

---

## Team Guidance for Offshore Developers

### Code Standards
```csharp
// ALWAYS include XML documentation
/// <summary>
/// Retrieves inventory items using FIFO ordering
/// </summary>
/// <param name="productId">Product identifier</param>
/// <returns>Ordered list of inventory items</returns>
public async Task<IEnumerable<InventoryItemDto>> GetItemsFIFO(Guid productId)
{
    // ALWAYS use meaningful variable names
    var currentHouseholdId = GetCurrentHouseholdId();
    
    // ALWAYS handle exceptions
    try
    {
        // ALWAYS use async/await properly
        var items = await _repository.GetItemsByProduct(productId, currentHouseholdId);
        
        // ALWAYS validate business logic
        if (!items.Any())
        {
            _logger.LogInformation($"No items found for product {productId}");
            return Enumerable.Empty<InventoryItemDto>();
        }
        
        // ALWAYS use LINQ efficiently
        return items
            .OrderBy(i => i.PurchaseDate)
            .ThenBy(i => i.ExpirationDate)
            .Select(i => _mapper.Map<InventoryItemDto>(i));
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, $"Error retrieving items for product {productId}");
        throw;
    }
}
```

### Daily Standup Template
```
Yesterday: [Completed US-XXX implementation]
Today: [Working on US-YYY, expect to complete by EOD]
Blockers: [Any impediments or questions]
Questions: [Technical clarifications needed]
```

### Code Review Checklist
- [ ] Follows SOLID principles
- [ ] Includes unit tests (minimum 80% coverage)
- [ ] Has XML documentation
- [ ] Handles errors appropriately
- [ ] Uses async/await correctly
- [ ] Includes logging statements
- [ ] Validates input data
- [ ] Updates API documentation

---

## Next Steps

1. **Immediate Actions**:
   - Review and approve technical architecture
   - Set up Azure subscription and resources
   - Create development team accounts
   - Initialize Git repository with branch protection

2. **Week 1 Tasks**:
   - Create Azure AD B2C tenant
   - Set up database project
   - Create initial API project structure
   - Configure CI/CD pipeline

3. **Clarification Needed**:
   - Preferred label maker model/format for custom labels?
   - Specific nutritional information to track?
   - Integration with shopping list apps?
   - Preferred notification methods (push, email, SMS)?
   - Budget constraints for Azure services?

---

## Appendix

### Sample DTOs

```csharp
public class AddInventoryItemDto
{
    [Required]
    public Guid ProductId { get; set; }
    
    [Required]
    public Guid StorageLocationId { get; set; }
    
    [Required]
    [Range(0.01, 10000)]
    public decimal Quantity { get; set; }
    
    [MaxLength(20)]
    public string Unit { get; set; }
    
    public DateTime? ExpirationDate { get; set; }
    
    [Range(0, 10000)]
    public decimal? Cost { get; set; }
    
    [MaxLength(500)]
    public string Notes { get; set; }
}

public class RecipeAvailabilityDto
{
    public Guid RecipeId { get; set; }
    public string RecipeName { get; set; }
    public bool CanMakeNow { get; set; }
    public List<IngredientAvailabilityDto> Ingredients { get; set; }
    public int MissingIngredientsCount { get; set; }
    public decimal AvailabilityPercentage { get; set; }
}
```

### Error Response Format

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product with specified UPC was not found",
    "details": {
      "upc": "123456789012",
      "timestamp": "2024-01-15T10:30:00Z",
      "traceId": "abc123def456"
    }
  }
}
```

---

## 📋 Current Development Todos (January 22, 2025)

### 🔴 CRITICAL SECURITY ISSUES
**Priority**: URGENT - Must be addressed immediately

1. **ROTATE API KEYS**: API keys exposed in .env.local file need immediate rotation
2. **FIX AUTHORIZATION**: meal-planner API uses service role key bypassing RLS - needs proper user validation
3. **SECURE ENDPOINTS**: Implement proper authentication checks on all API routes

### ✅ COMPLETED IN THIS SESSION (January 22, 2025)
- Fixed meal planner date handling with proper week calculations
- Implemented attendance and guest management features
- Added drag-and-drop functionality for meal reorganization
- Created meal details dialog with recipe integration
- Fixed recipe grid layout issues (multiple iterations to resolve)
- Resolved database VARCHAR constraints blocking barcode scanning
- Added pantry scorecards with ingredient availability tracking
- Implemented mobile-friendly accordion displays
- Fixed "September 14th" date generation bug

### 🏗️ NEXT SPRINT: Meal Planner Enhancement
**Priority**: High - Complete remaining meal planning features

1. **Meal History Integration**: Track and display previously cooked meals
2. **Shopping List Generation**: Create shopping lists from meal plans
3. **Nutritional Information**: Display nutrition facts for meals
4. **Recipe Scaling**: Adjust recipes for different serving sizes
5. **Ingredient Substitutions**: Suggest alternatives for missing items
6. **Meal Plan Templates**: Save and reuse favorite meal plans
7. **Family Preferences**: Track and learn from meal ratings
8. **Leftovers Tracking**: Manage and suggest leftover usage

### 🎯 FUTURE ENHANCEMENTS
- **Subscription tier integration**: Connect feature tiers to actual payment plans
- **Advanced analytics implementation**: Build the reporting features that can be toggled
- **White-label customization**: Enterprise branding and configuration options
- **API rate limiting**: Implement the API usage controls defined in admin settings
- **Mobile app feature parity**: Ensure all admin controls work in mobile interface
- **Recipe image handling**: Better fallback mechanisms for missing images
- **Performance optimization**: Index optimization for search queries
- **Touch device testing**: Verify drag-and-drop on tablets and phones

---

## Technical Notes from Session

### Database Migration Strategy
When changing column types with dependent views:
1. Drop all dependent views CASCADE
2. Alter column types to TEXT for flexibility
3. Recreate views with correct column mappings
4. Always use conditional checks for column existence

### Grid Layout Solution
After extensive testing with MUI Grid components:
- Grid2 component not available in current MUI version
- Use `Grid size={{ xs: 12, sm: 6, md: 4 }}` syntax for responsive layouts
- Container width adjustments may be needed for proper rendering

### Date Handling Best Practices
- Use date-fns for all date manipulations
- Never mutate date objects directly
- Use `startOfWeek` with `weekStartsOn: 0` for Sunday start
- Proper date generation without mutation prevents indexing errors

---

**Document Version**: 2.1
**Last Updated**: January 22, 2025 (Meal Planner Implementation & Database Fixes)
**Author**: Product Owner / Senior Developer
**Status**: Production Ready with Meal Planning System
**Next Review**: After security issues are addressed
**URL**: https://PantryIQ.prolongedpantry.com