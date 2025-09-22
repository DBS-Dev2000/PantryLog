const { createClient } = require('@supabase/supabase-js');
const foodTaxonomy = require('../data/food-taxonomy.json');
const foodShelfLife = require('../data/food-shelf-life.json');
const { ingredientEquivalencies } = require('../utils/ingredientMatcher');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateData() {
  console.log('Starting food data migration...');

  try {
    // 1. Migrate food taxonomy
    console.log('Migrating food taxonomy...');
    for (const [categoryName, categoryData] of Object.entries(foodTaxonomy.taxonomy)) {
      // Insert category
      const { data: category, error: catError } = await supabase
        .from('food_categories')
        .upsert({ name: categoryName })
        .select()
        .single();

      if (catError) {
        console.error(`Error inserting category ${categoryName}:`, catError);
        continue;
      }

      // Process subcategories
      for (const [subcategoryName, subcategoryData] of Object.entries(categoryData)) {
        if (typeof subcategoryData !== 'object') continue;

        // Insert subcategory
        const { data: subcategory, error: subError } = await supabase
          .from('food_subcategories')
          .upsert({
            category_id: category.id,
            name: subcategoryName
          })
          .select()
          .single();

        if (subError) {
          console.error(`Error inserting subcategory ${subcategoryName}:`, subError);
          continue;
        }

        // Insert food items
        const items = subcategoryData.items || subcategoryData.cuts || [];
        for (const itemName of items) {
          const { error: itemError } = await supabase
            .from('food_items')
            .upsert({
              subcategory_id: subcategory.id,
              name: itemName,
              recipe_matches: subcategoryData.recipeMatches || null,
              substitutions: subcategoryData.substitutions || null,
              portion_size_oz: subcategoryData.portionManagement?.standardPortion || null,
              leftover_days: subcategoryData.leftoverUses?.storageLife || null
            });

          if (itemError) {
            console.error(`Error inserting item ${itemName}:`, itemError);
          }
        }
      }
    }

    // 2. Migrate ingredient equivalencies
    console.log('Migrating ingredient equivalencies...');
    for (const [primaryName, equivalents] of Object.entries(ingredientEquivalencies)) {
      const { error } = await supabase
        .from('ingredient_equivalencies')
        .upsert({
          primary_name: primaryName,
          equivalent_names: equivalents
        });

      if (error) {
        console.error(`Error inserting equivalency ${primaryName}:`, error);
      }
    }

    // 3. Migrate shelf life data
    console.log('Migrating shelf life data...');

    // Process specific items
    if (foodShelfLife.specificItems) {
      for (const [itemName, shelfData] of Object.entries(foodShelfLife.specificItems)) {
        const { error } = await supabase
          .from('food_shelf_life')
          .upsert({
            food_name: itemName,
            pantry_days: shelfData.pantry || null,
            refrigerator_days: shelfData.refrigerator || null,
            freezer_days: shelfData.freezer || null,
            notes: shelfData.notes || null
          });

        if (error) {
          console.error(`Error inserting shelf life for ${itemName}:`, error);
        }
      }
    }

    // Process categories
    if (foodShelfLife.categories) {
      for (const [categoryName, categoryShelfData] of Object.entries(foodShelfLife.categories)) {
        // Process items within categories
        if (categoryShelfData.items) {
          for (const [itemName, shelfData] of Object.entries(categoryShelfData.items)) {
            const { error } = await supabase
              .from('food_shelf_life')
              .upsert({
                food_name: itemName,
                category: categoryName,
                pantry_days: shelfData.pantry || null,
                refrigerator_days: shelfData.refrigerator || null,
                freezer_days: shelfData.freezer || null,
                notes: shelfData.notes || null
              });

            if (error) {
              console.error(`Error inserting shelf life for ${itemName}:`, error);
            }
          }
        }

        // Process default category shelf life
        if (categoryShelfData.default) {
          const { error } = await supabase
            .from('food_shelf_life')
            .upsert({
              food_name: `${categoryName} (default)`,
              category: categoryName,
              pantry_days: categoryShelfData.default.pantry || null,
              refrigerator_days: categoryShelfData.default.refrigerator || null,
              freezer_days: categoryShelfData.default.freezer || null
            });

          if (error) {
            console.error(`Error inserting default shelf life for ${categoryName}:`, error);
          }
        }
      }
    }

    // 4. Refresh materialized view
    console.log('Refreshing materialized view...');
    const { error: viewError } = await supabase.rpc('refresh_materialized_view', {
      view_name: 'ingredient_search_view'
    });

    if (viewError) {
      console.error('Error refreshing materialized view:', viewError);
    }

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateData();
}

module.exports = { migrateData };