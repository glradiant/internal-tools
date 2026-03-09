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

    const categoryFolder = parts[0];
    const fileName = parts[parts.length - 1];
    const fileNameWithoutExt = fileName.replace('.svg', '');

    // Create a nice label from filename (replace underscores with spaces, clean up)
    const label = fileNameWithoutExt
      .replace(/_/g, ' ')
      .replace(/-/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();

    // Create category if it doesn't exist
    if (!categories[categoryFolder]) {
      categories[categoryFolder] = {
        id: categoryFolder,
        label: categoryFolder.replace(/_/g, ' '),
        models: []
      };
    }

    // Extract dimensions from SVG for proper scaling
    const dimensions = extractSvgDimensions(svgContent);

    // Create unique ID from category and filename
    const modelId = `${categoryFolder}__${fileNameWithoutExt}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Add model to category
    categories[categoryFolder].models.push({
      id: modelId,
      label: label,
      categoryId: categoryFolder,
      svgContent: svgContent,
      svgPath: path,
      dimensions: dimensions,
      // Extract metadata from filename
      kbtu: extractKbtu(fileNameWithoutExt),
      lengthFt: extractLengthFt(fileNameWithoutExt, dimensions),
    });
  }

  // Sort models within each category
  for (const category of Object.values(categories)) {
    category.models.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }

  return categories;
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

// Try to extract BTU from filename (e.g., "100" from "U-100")
function extractKbtu(fileName) {
  const match = fileName.match(/(\d+)\s*(?:kbtu|btu)?/i);
  if (match) {
    const num = parseInt(match[1], 10);
    // If it looks like a BTU value (>= 50), return it
    if (num >= 50 && num <= 500) return num;
  }
  return 100; // Default
}

// Try to extract length from filename (e.g., "10" from "10_ft")
function extractLengthFt(fileName, dimensions) {
  // Look for patterns like "10_ft", "10ft", "10'", "20 ft", "10 ft"
  const match = fileName.match(/(\d+)\s*(?:ft|'|_ft)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Also check for "X ft" pattern with space
  const spaceMatch = fileName.match(/(\d+)\s+ft/i);
  if (spaceMatch) {
    return parseInt(spaceMatch[1], 10);
  }

  // Fallback: estimate from aspect ratio (assuming ~1ft = 20px in standard view)
  if (dimensions.aspectRatio > 1) {
    // Wide SVG, estimate length - use a reasonable default
    return Math.min(Math.max(Math.round(dimensions.aspectRatio * 2), 5), 70);
  }

  return 10; // Default length
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
