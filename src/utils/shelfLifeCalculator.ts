import { addDays } from 'date-fns';
import foodShelfLife from '@/data/food-shelf-life.json';

export type StorageLocation = 'pantry' | 'refrigerator' | 'freezer';

interface ShelfLifeData {
  pantry?: number;
  refrigerator?: number;
  freezer?: number;
  notes?: string;
}

/**
 * Calculate expiration date based on purchase date and shelf life
 */
export function calculateExpirationDate(
  purchaseDate: Date | string,
  shelfLifeDays: number | null | undefined,
  storageLocation?: StorageLocation
): Date | null {
  if (!shelfLifeDays || shelfLifeDays <= 0) {
    return null;
  }

  const purchase = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;
  return addDays(purchase, shelfLifeDays);
}

/**
 * Get default shelf life for a product based on category and storage location
 */
export function getDefaultShelfLife(
  productName: string,
  category: string | null | undefined,
  storageLocation: StorageLocation = 'refrigerator'
): number | null {
  if (!productName && !category) {
    return foodShelfLife.defaultRules.unknownProduct[storageLocation] || 7;
  }

  const name = productName?.toLowerCase() || '';
  const cat = category?.toLowerCase() || '';

  // Try to find specific product match
  const shelfLifeData = findShelfLifeData(name, cat);

  if (shelfLifeData && typeof shelfLifeData[storageLocation] === 'number') {
    return shelfLifeData[storageLocation] as number;
  }

  // Fallback to category defaults
  return getCategoryDefault(cat, storageLocation);
}

/**
 * Find shelf life data for a specific product
 */
function findShelfLifeData(productName: string, category: string): ShelfLifeData | null {
  // Check each main category
  for (const [mainCat, mainData] of Object.entries(foodShelfLife.categories)) {
    if (typeof mainData === 'object' && mainData !== null) {
      // Search within subcategories
      const found = searchInCategory(mainData, productName, category);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Recursively search for product in category structure
 */
function searchInCategory(categoryData: any, productName: string, category: string): ShelfLifeData | null {
  for (const [key, value] of Object.entries(categoryData)) {
    if (typeof value === 'object' && value !== null) {
      // Check if this matches our product
      if (productName.includes(key.toLowerCase()) || key.toLowerCase().includes(productName)) {
        if (hasShelfLifeData(value)) {
          return value as ShelfLifeData;
        }
      }

      // Recursively search deeper
      const found = searchInCategory(value, productName, category);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Check if object has shelf life data
 */
function hasShelfLifeData(obj: any): boolean {
  return obj && (
    typeof obj.pantry === 'number' ||
    typeof obj.refrigerator === 'number' ||
    typeof obj.freezer === 'number'
  );
}

/**
 * Get category-based default shelf life
 */
function getCategoryDefault(category: string, storageLocation: StorageLocation): number {
  const categoryMap: Record<string, Partial<Record<StorageLocation, number>>> = {
    // Produce
    'produce': { pantry: 7, refrigerator: 7, freezer: 240 },
    'fruits': { pantry: 5, refrigerator: 7, freezer: 240 },
    'vegetables': { pantry: 7, refrigerator: 10, freezer: 240 },
    'fresh': { pantry: 3, refrigerator: 7, freezer: 180 },

    // Meat & Seafood
    'meat': { pantry: 0, refrigerator: 3, freezer: 180 },
    'beef': { pantry: 0, refrigerator: 5, freezer: 180 },
    'pork': { pantry: 0, refrigerator: 5, freezer: 180 },
    'poultry': { pantry: 0, refrigerator: 2, freezer: 365 },
    'chicken': { pantry: 0, refrigerator: 2, freezer: 365 },
    'seafood': { pantry: 0, refrigerator: 2, freezer: 90 },
    'fish': { pantry: 0, refrigerator: 2, freezer: 180 },

    // Dairy
    'dairy': { pantry: 0, refrigerator: 7, freezer: 90 },
    'milk': { pantry: 0, refrigerator: 7, freezer: 90 },
    'cheese': { pantry: 0, refrigerator: 30, freezer: 240 },
    'yogurt': { pantry: 0, refrigerator: 14, freezer: 60 },

    // Grains & Baked
    'grains': { pantry: 730, refrigerator: 730, freezer: 730 },
    'bread': { pantry: 7, refrigerator: 14, freezer: 90 },
    'bakery': { pantry: 7, refrigerator: 14, freezer: 90 },
    'pasta': { pantry: 730, refrigerator: 730, freezer: 730 },
    'rice': { pantry: 1460, refrigerator: 1460, freezer: 1460 },

    // Canned & Packaged
    'canned': { pantry: 730, refrigerator: 730, freezer: 730 },
    'packaged': { pantry: 365, refrigerator: 365, freezer: 365 },
    'dry goods': { pantry: 365, refrigerator: 365, freezer: 365 },

    // Condiments
    'condiments': { pantry: 365, refrigerator: 180, freezer: 0 },
    'sauces': { pantry: 365, refrigerator: 180, freezer: 180 },

    // Beverages
    'beverages': { pantry: 270, refrigerator: 10, freezer: 0 },
    'drinks': { pantry: 270, refrigerator: 10, freezer: 0 },

    // Snacks
    'snacks': { pantry: 90, refrigerator: 90, freezer: 180 },
    'chips': { pantry: 90, refrigerator: 0, freezer: 0 },
    'cookies': { pantry: 240, refrigerator: 240, freezer: 365 },

    // Frozen
    'frozen': { pantry: 0, refrigerator: 2, freezer: 240 },

    // Leftovers/Prepared
    'prepared': { pantry: 0, refrigerator: 4, freezer: 90 },
    'leftovers': { pantry: 0, refrigerator: 4, freezer: 90 },
    'cooked': { pantry: 0, refrigerator: 4, freezer: 90 }
  };

  // Check for category match
  for (const [key, values] of Object.entries(categoryMap)) {
    if (category.includes(key) || key.includes(category)) {
      return values[storageLocation] || foodShelfLife.defaultRules.unknownProduct[storageLocation];
    }
  }

  // Default fallback
  return foodShelfLife.defaultRules.unknownProduct[storageLocation];
}

/**
 * Get storage recommendation for a product
 */
export function getStorageRecommendation(
  productName: string,
  category: string | null | undefined
): StorageLocation {
  const name = productName?.toLowerCase() || '';
  const cat = category?.toLowerCase() || '';

  // Meat, seafood, dairy should always be refrigerated or frozen
  if (['meat', 'seafood', 'fish', 'poultry', 'dairy', 'milk', 'cheese'].some(term =>
    cat.includes(term) || name.includes(term)
  )) {
    return 'refrigerator';
  }

  // Fresh produce typically refrigerated
  if (['fresh', 'produce', 'vegetable', 'fruit', 'salad'].some(term =>
    cat.includes(term) || name.includes(term)
  )) {
    return 'refrigerator';
  }

  // Frozen items
  if (['frozen', 'ice cream'].some(term =>
    cat.includes(term) || name.includes(term)
  )) {
    return 'freezer';
  }

  // Canned, dry goods, grains typically pantry
  if (['canned', 'dry', 'grain', 'cereal', 'pasta', 'rice', 'snack', 'chip', 'cracker'].some(term =>
    cat.includes(term) || name.includes(term)
  )) {
    return 'pantry';
  }

  // Default to refrigerator for safety
  return 'refrigerator';
}

/**
 * Suggest expiration date based on product info and storage location
 */
export function suggestExpirationDate(
  productName: string,
  category: string | null | undefined,
  purchaseDate: Date | string,
  storageLocation?: StorageLocation,
  defaultShelfLifeDays?: number | null
): Date | null {
  const purchase = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;

  // Use provided shelf life first
  if (defaultShelfLifeDays && defaultShelfLifeDays > 0) {
    return addDays(purchase, defaultShelfLifeDays);
  }

  // Determine storage location if not provided
  const location = storageLocation || getStorageRecommendation(productName, category);

  // Get default shelf life for the product
  const shelfLife = getDefaultShelfLife(productName, category, location);

  if (shelfLife) {
    return addDays(purchase, shelfLife);
  }

  // Fallback to 7 days
  return addDays(purchase, 7);
}

/**
 * Format storage location for display
 */
export function formatStorageLocation(location: StorageLocation): string {
  const locationMap: Record<StorageLocation, string> = {
    pantry: 'Pantry',
    refrigerator: 'Refrigerator',
    freezer: 'Freezer'
  };

  return locationMap[location] || location;
}

/**
 * Get all storage options with shelf life for a product
 */
export function getStorageOptions(
  productName: string,
  category: string | null | undefined
): Array<{ location: StorageLocation; days: number; recommended: boolean }> {
  const options: Array<{ location: StorageLocation; days: number; recommended: boolean }> = [];
  const recommendedLocation = getStorageRecommendation(productName, category);

  const locations: StorageLocation[] = ['pantry', 'refrigerator', 'freezer'];

  for (const location of locations) {
    const days = getDefaultShelfLife(productName, category, location);
    if (days && days > 0) {
      options.push({
        location,
        days,
        recommended: location === recommendedLocation
      });
    }
  }

  // Sort by recommendation first, then by shelf life
  options.sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return b.days - a.days;
  });

  return options;
}