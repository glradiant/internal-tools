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

// Parse folder structure and create nested catalog tree
// Structure: heater_svgs/HL3_Series_Drawings/Straight/20ft/HL3-20-65.svg
// Creates nested tree: Series -> Type -> Length -> Models
function buildHeaterCatalog() {
  const flatCategories = {}; // Flat lookup for backwards compatibility
  const nestedTree = {}; // Nested tree structure for UI

  for (const [path, svgContent] of Object.entries(svgModules)) {
    // Normalize path - remove leading ../.. or /heater_svgs/
    let normalizedPath = path;
    if (path.startsWith('../../../heater_svgs/')) {
      normalizedPath = path.replace('../../../heater_svgs/', '');
    } else if (path.startsWith('/heater_svgs/')) {
      normalizedPath = path.replace('/heater_svgs/', '');
    }

    const parts = normalizedPath.split('/');
    if (parts.length < 2) continue;

    const fileName = parts[parts.length - 1];
    const fileNameWithoutExt = fileName.replace('.svg', '');

    // Extract dimensions from SVG for proper scaling
    const dimensions = extractSvgDimensions(svgContent);
    const label = formatHeaterLabel(fileNameWithoutExt);

    // Build nested tree and flat category
    let categoryId, seriesName, typeName, lengthName;

    if (parts.length >= 4) {
      // Nested structure: Series/Type/Length/file.svg
      const seriesFolder = parts[0]; // "HL3_Series_Drawings"
      typeName = parts[1]; // "Straight" or "U-Bend"
      lengthName = parts[2]; // "20ft", "30ft", etc.
      seriesName = seriesFolder.split('_')[0]; // "HL3"
      categoryId = `${seriesFolder}__${typeName}__${lengthName}`;

      // Build nested tree
      if (!nestedTree[seriesName]) {
        nestedTree[seriesName] = { id: seriesName, label: seriesName, children: {} };
      }
      if (!nestedTree[seriesName].children[typeName]) {
        nestedTree[seriesName].children[typeName] = { id: `${seriesName}__${typeName}`, label: typeName, children: {} };
      }
      if (!nestedTree[seriesName].children[typeName].children[lengthName]) {
        nestedTree[seriesName].children[typeName].children[lengthName] = {
          id: categoryId,
          label: lengthName,
          models: []
        };
      }
    } else {
      // Flat structure fallback
      categoryId = parts[0];
      seriesName = parts[0].replace(/_/g, ' ');

      if (!nestedTree[seriesName]) {
        nestedTree[seriesName] = { id: seriesName, label: seriesName, models: [] };
      }
    }

    // Create model object
    const modelId = `${categoryId}__${fileNameWithoutExt}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const model = {
      id: modelId,
      label: label,
      categoryId: categoryId,
      svgContent: svgContent,
      svgPath: path,
      dimensions: dimensions,
      kbtu: extractKbtu(fileNameWithoutExt),
      lengthFt: extractLengthFt(fileNameWithoutExt, dimensions),
    };

    // Add to nested tree
    if (parts.length >= 4) {
      nestedTree[seriesName].children[typeName].children[lengthName].models.push(model);
    } else {
      nestedTree[seriesName].models = nestedTree[seriesName].models || [];
      nestedTree[seriesName].models.push(model);
    }

    // Add to flat categories for backwards compatibility
    if (!flatCategories[categoryId]) {
      flatCategories[categoryId] = {
        id: categoryId,
        label: parts.length >= 4 ? `${seriesName} ${typeName} ${lengthName}` : seriesName,
        models: []
      };
    }
    flatCategories[categoryId].models.push(model);
  }

  // Sort models within each leaf node
  const sortModels = (node) => {
    if (node.models) {
      node.models.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }
    if (node.children) {
      Object.values(node.children).forEach(sortModels);
    }
  };
  Object.values(nestedTree).forEach(sortModels);

  return { flatCategories, nestedTree };
}

// Build catalog on module load
const { flatCategories, nestedTree } = buildHeaterCatalog();

// Export nested tree for UI
export const HEATER_TREE = nestedTree;

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

// Flat categories for backwards compatibility
export const HEATER_CATEGORIES = flatCategories;

// Flatten to array for backwards compatibility
export const HEATER_MODELS_FROM_SVG = Object.values(flatCategories)
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
