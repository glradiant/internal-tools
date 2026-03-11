// Dynamically load all SVG files from heater_svgs folder
// Vite's import.meta.glob enables us to import all matching files

// Try multiple path patterns to handle different project structures
const svgModulesRoot = import.meta.glob('/heater_svgs/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true
});

const svgModulesRelative = import.meta.glob('../../../heater_svgs/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true
});

// Merge both sources
const svgModules = { ...svgModulesRoot, ...svgModulesRelative };

// Parse folder structure and create catalog
// New structure: heater_svgs/HL3_Series_Drawings/Straight/20ft/HL3-20-65.svg
//                heater_svgs/HL3_Series_Drawings/U-Bend/30ft/HL3-30U-100.svg
function buildHeaterCatalog() {
  const categories = {};

  for (const [path, svgContent] of Object.entries(svgModules)) {
    // Normalize path - remove leading ../.. or /heater_svgs/
    let normalizedPath = path;
    if (path.startsWith('../../../heater_svgs/')) {
      normalizedPath = path.replace('../../../heater_svgs/', '');
    } else if (path.startsWith('/heater_svgs/')) {
      normalizedPath = path.replace('/heater_svgs/', '');
    }

    const parts = normalizedPath.split('/');

    if (parts.length < 2) continue; // Skip files not in a subfolder

    const fileName = parts[parts.length - 1];
    const fileNameWithoutExt = fileName.replace('.svg', '');

    // Determine category from folder structure
    // New structure: Series/Type/Length/file.svg (e.g., HL3_Series_Drawings/Straight/20ft/HL3-20-65.svg)
    // Old structure: Series/file.svg (e.g., HL3_Series_Drawings/HL3-20-65.svg)
    let categoryId, categoryLabel;
    if (parts.length >= 4) {
      // New nested structure: use Type/Length as category (e.g., "Straight/20ft")
      const heaterType = parts[1]; // "Straight" or "U-Bend"
      const lengthFolder = parts[2]; // "20ft", "30ft", etc.
      categoryId = `${parts[0]}__${heaterType}__${lengthFolder}`;
      categoryLabel = `${heaterType} ${lengthFolder}`;
    } else {
      // Fallback for flat structure
      categoryId = parts[0];
      categoryLabel = parts[0].replace(/_/g, ' ');
    }

    // Extract dimensions from SVG for proper scaling
    const dimensions = extractSvgDimensions(svgContent);

    // Create formatted label from filename
    const label = formatHeaterLabel(fileNameWithoutExt);

    // Create category if it doesn't exist
    if (!categories[categoryId]) {
      categories[categoryId] = {
        id: categoryId,
        label: categoryLabel,
        models: []
      };
    }

    // Create unique ID from full path
    const modelId = `${categoryId}__${fileNameWithoutExt}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Add model to category
    categories[categoryId].models.push({
      id: modelId,
      label: label,
      categoryId: categoryId,
      svgContent: svgContent,
      svgPath: path,
      dimensions: dimensions,
      // Extract metadata from filename
      kbtu: extractKbtu(fileNameWithoutExt),
      lengthFt: extractLengthFt(fileNameWithoutExt, dimensions),
    });
  }

  // Sort categories by label, then sort models within each category
  const sortedCategories = {};
  const sortedKeys = Object.keys(categories).sort((a, b) => {
    return categories[a].label.localeCompare(categories[b].label, undefined, { numeric: true });
  });

  for (const key of sortedKeys) {
    sortedCategories[key] = categories[key];
    sortedCategories[key].models.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }

  return sortedCategories;
}

// Extract viewBox and dimensions from SVG content
function extractSvgDimensions(svgContent) {
  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
  const widthMatch = svgContent.match(/width=["']([^"']+)["']/);
  const heightMatch = svgContent.match(/height=["']([^"']+)["']/);

  let viewBox = { x: 0, y: 0, width: 100, height: 100 };
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    if (parts.length >= 4) {
      viewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }

  // Parse width/height (could be mm, px, etc)
  const parseSize = (str) => {
    if (!str) return null;
    const num = parseFloat(str);
    if (str.includes('mm')) return num * 3.78; // mm to px approx
    return num;
  };

  return {
    viewBox,
    width: parseSize(widthMatch?.[1]),
    height: parseSize(heightMatch?.[1]),
    aspectRatio: viewBox.width / viewBox.height
  };
}

// Format heater label for display
// Converts "HL3-20-65" to "HL3 20' 65kBTU"
// Converts "HL3-20U-65" to "HL3 20'U 65kBTU"
function formatHeaterLabel(fileName) {
  // New naming convention: HL3-20-65, HL3-30U-125, etc.
  const newFormatMatch = fileName.match(/^([A-Z]+\d*)-(\d+)(U)?-(\d+)$/i);
  if (newFormatMatch) {
    const series = newFormatMatch[1].toUpperCase();
    const length = newFormatMatch[2];
    const isUtube = newFormatMatch[3] ? 'U' : '';
    const btu = newFormatMatch[4];
    return `${series} ${length}'${isUtube} ${btu}kBTU`;
  }

  // Legacy: clean up filename for display
  return fileName
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Try to extract BTU from filename
// Handles new naming convention: HL3-20-65, HL3-30U-100, etc.
// Format: SERIES-LENGTH[U]-BTU where U indicates U-tube
function extractKbtu(fileName) {
  // New naming convention: HL3-20-65, HL3-30U-125, etc.
  // Pattern: series prefix, then length, optional U, then BTU at the end
  const newFormatMatch = fileName.match(/^[A-Z]+\d*-\d+U?-(\d+)$/i);
  if (newFormatMatch) {
    return parseInt(newFormatMatch[1], 10);
  }

  // Legacy: use the last number in the filename as BTU
  const allNumbers = fileName.match(/\d+/g);
  if (allNumbers && allNumbers.length > 0) {
    return parseInt(allNumbers[allNumbers.length - 1], 10);
  }

  return 0; // Default - no BTU found
}

// Try to extract length from filename
// Handles new naming convention: HL3-20-65, HL3-30U-100, etc.
// Format: SERIES-LENGTH[U]-BTU where LENGTH is in feet
function extractLengthFt(fileName, dimensions) {
  // New naming convention: HL3-20-65, HL3-30U-125, etc.
  // Pattern: series prefix, then length (with optional U suffix), then BTU
  const newFormatMatch = fileName.match(/^[A-Z]+\d*-(\d+)U?-\d+$/i);
  if (newFormatMatch) {
    return parseInt(newFormatMatch[1], 10);
  }

  // Legacy: Look for patterns like "10_ft", "10ft", "10'", "20 ft", "10 ft"
  const match = fileName.match(/(\d+)\s*(?:ft|'|_ft)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Also check for "X ft" pattern with space
  const spaceMatch = fileName.match(/(\d+)\s+ft/i);
  if (spaceMatch) {
    return parseInt(spaceMatch[1], 10);
  }

  // Fallback: estimate from aspect ratio
  if (dimensions.aspectRatio > 1) {
    return Math.round(dimensions.aspectRatio * 2);
  }

  return 0; // Default - no length found
}

// Build the catalog on module load
export const HEATER_CATEGORIES = buildHeaterCatalog();

// Flatten to array for backwards compatibility
export const HEATER_MODELS_FROM_SVG = Object.values(HEATER_CATEGORIES)
  .flatMap(cat => cat.models);

// Get model by ID
export function getHeaterModel(modelId) {
  return HEATER_MODELS_FROM_SVG.find(m => m.id === modelId);
}

// Get category by ID
export function getHeaterCategory(categoryId) {
  return HEATER_CATEGORIES[categoryId];
}

// Get all category IDs
export function getHeaterCategoryIds() {
  return Object.keys(HEATER_CATEGORIES);
}

// Check if catalog has any models
export function hasSvgHeaters() {
  return HEATER_MODELS_FROM_SVG.length > 0;
}

// Debug: log catalog contents
if (import.meta.env.DEV) {
  console.log('Heater Catalog loaded:', {
    categories: Object.keys(HEATER_CATEGORIES),
    totalModels: HEATER_MODELS_FROM_SVG.length,
    models: HEATER_MODELS_FROM_SVG.map(m => ({ id: m.id, label: m.label, lengthFt: m.lengthFt }))
  });
}
