// Dynamically load all SVG files from heater_svgs folder
// Vite's import.meta.glob enables us to import all matching files

// Import heater specs for configurations
import elxSpecs from '../data/elxSpecs.json';
import hl3Specs from '../data/hl3Specs.json';
import ld3Specs from '../data/ld3Specs.json';

// Map series names to their specs
const seriesSpecs = {
  ELX: elxSpecs,
  HL3: hl3Specs,
  LD3: ld3Specs,
};

// Helper to determine if a series is electric
const isSeriesElectric = (seriesName) => {
  const specs = seriesSpecs[seriesName];
  return specs?.fuelType === 'electric';
};

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
// Structure: heater_svgs/HL3_Series_Drawings/Straight/20ft/HL3-20.svg
// Creates nested tree: Series -> Type -> Length -> Models (BTU variants from specs)
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

    // Skip builder parts folder - handled by builderPartsCatalog.js
    if (normalizedPath.startsWith('LS3_Builder_Parts/')) continue;

    const fileName = parts[parts.length - 1];
    const fileNameWithoutExt = fileName.replace('.svg', '');

    // Extract dimensions from SVG for proper scaling
    const dimensions = extractSvgDimensions(svgContent);

    // Check if this is an ELX electric heater - handle specially
    const elxMatch = fileNameWithoutExt.match(/^ELX-(\d+)-(\d)$/);
    if (elxMatch) {
      processElxHeater(elxMatch, svgContent, path, dimensions, nestedTree, flatCategories);
      continue;
    }

    // Check if this is a gas tube heater (HL3, LD3, etc.)
    // New naming: HL3-20.svg (straight) or HL3-20U.svg (U-bend)
    const gasMatch = fileNameWithoutExt.match(/^([A-Z]+\d)-(\d+)(U)?$/i);
    if (gasMatch && parts.length >= 4) {
      processGasHeater(gasMatch, parts, svgContent, path, dimensions, nestedTree, flatCategories);
      continue;
    }

    // Fallback: unknown format - skip or handle generically
    console.warn(`Unknown heater format: ${fileNameWithoutExt}`);
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

/**
 * Process ELX electric heater - generates models from specs for each voltage/lamp type
 */
function processElxHeater(match, svgContent, path, dimensions, nestedTree, flatCategories) {
  const lengthIn = match[1]; // "24", "33", "46"
  const lampCount = match[2]; // "1", "2", "3"
  const lampCountLabel = lampCount === '1' ? '1-Lamp' : lampCount === '2' ? '2-Lamp' : '3-Lamp';

  // Build ELX nested tree: ELX -> Length -> LampCount -> Voltage -> Models
  if (!nestedTree['ELX']) {
    nestedTree['ELX'] = { id: 'ELX', label: 'ELX', children: {} };
  }
  const lengthLabel = `${lengthIn}"`;
  if (!nestedTree['ELX'].children[lengthLabel]) {
    nestedTree['ELX'].children[lengthLabel] = {
      id: `ELX__${lengthIn}`,
      label: lengthLabel,
      children: {}
    };
  }

  if (!nestedTree['ELX'].children[lengthLabel].children[lampCountLabel]) {
    nestedTree['ELX'].children[lengthLabel].children[lampCountLabel] = {
      id: `ELX__${lengthIn}__${lampCount}`,
      label: lampCountLabel,
      children: {}
    };
  }

  // Generate models from ELX specs
  const lengthSpecs = elxSpecs.ELX[lengthIn];
  const lampSpecs = lengthSpecs?.[lampCount];

  if (lampSpecs) {
    for (const [voltage, lampTypes] of Object.entries(lampSpecs)) {
      const categoryId = `ELX__${lengthIn}__${lampCount}__${voltage}`.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Add voltage level to nested tree
      if (!nestedTree['ELX'].children[lengthLabel].children[lampCountLabel].children[voltage]) {
        nestedTree['ELX'].children[lengthLabel].children[lampCountLabel].children[voltage] = {
          id: categoryId,
          label: voltage,
          models: []
        };
      }

      // Flat category for backwards compatibility
      if (!flatCategories[categoryId]) {
        flatCategories[categoryId] = {
          id: categoryId,
          label: `ELX ${lengthIn}" ${lampCountLabel} ${voltage}`,
          models: []
        };
      }

      for (const [lampType, specs] of Object.entries(lampTypes)) {
        const modelId = `ELX__${lengthIn}__${lampCount}__${voltage}__${lampType}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const wattsFormatted = specs.watts.toLocaleString();
        // Full label includes: ELX, length, voltage, wave type, watts
        const label = `ELX ${lengthIn}" ${voltage} ${lampType} ${wattsFormatted}W`;

        const model = {
          id: modelId,
          label: label,
          categoryId: categoryId,
          svgContent: svgContent,
          svgPath: path,
          dimensions: dimensions,
          // Electric heater specs
          voltage: voltage,
          lampType: lampType,
          lampTypeFull: elxSpecs.lampTypes[lampType],
          watts: specs.watts,
          btu: specs.btu,
          amps: specs.amps,
          // For compatibility with gas heater fields
          kbtu: Math.round(specs.btu / 1000),
          lengthFt: 0, // Not applicable for electric
          lengthIn: parseInt(lengthIn, 10),
          lampCount: parseInt(lampCount, 10),
          isElectric: true,
        };

        nestedTree['ELX'].children[lengthLabel].children[lampCountLabel].children[voltage].models.push(model);
        flatCategories[categoryId].models.push(model);
      }
    }
  }
}

/**
 * Process gas tube heater (HL3, LD3, etc.) - generates models from specs for each BTU rating
 * SVG naming: HL3-20.svg (straight) or HL3-20U.svg (U-bend)
 */
function processGasHeater(match, parts, svgContent, path, dimensions, nestedTree, flatCategories) {
  const seriesName = match[1].toUpperCase(); // "HL3", "LD3"
  const lengthFt = parseInt(match[2], 10); // 20, 30, 40, etc.
  const isUBend = !!match[3]; // true if "U" suffix present

  const seriesFolder = parts[0]; // "HL3_Series_Drawings"
  const typeName = parts[1]; // "Straight" or "U-Bend"
  const lengthName = parts[2]; // "20ft", "30ft", etc.

  // Get specs for this series
  const specs = seriesSpecs[seriesName];
  if (!specs || !specs.models) {
    console.warn(`No specs found for series: ${seriesName}`);
    return;
  }

  // Get available BTU ratings for this length
  const lengthSpecs = specs.models[String(lengthFt)];
  if (!lengthSpecs) {
    console.warn(`No specs found for ${seriesName} ${lengthFt}ft`);
    return;
  }

  // Build nested tree structure: Series -> Type -> Length -> Models
  if (!nestedTree[seriesName]) {
    nestedTree[seriesName] = { id: seriesName, label: seriesName, children: {} };
  }
  if (!nestedTree[seriesName].children[typeName]) {
    nestedTree[seriesName].children[typeName] = {
      id: `${seriesName}__${typeName}`,
      label: typeName,
      children: {}
    };
  }

  const categoryId = `${seriesFolder}__${typeName}__${lengthName}`;
  if (!nestedTree[seriesName].children[typeName].children[lengthName]) {
    nestedTree[seriesName].children[typeName].children[lengthName] = {
      id: categoryId,
      label: lengthName,
      models: []
    };
  }

  // Flat category for backwards compatibility
  if (!flatCategories[categoryId]) {
    flatCategories[categoryId] = {
      id: categoryId,
      label: `${seriesName} ${typeName} ${lengthName}`,
      models: []
    };
  }

  // Generate one model per BTU rating from specs
  for (const [btuKey, btuSpecs] of Object.entries(lengthSpecs)) {
    // Skip non-BTU properties (like straightLengthFtIn, uTubeLengthFtIn)
    if (isNaN(parseInt(btuKey, 10))) continue;

    const kbtu = parseInt(btuKey, 10);
    const uSuffix = isUBend ? 'U' : '';
    const modelId = `${seriesName}__${lengthFt}${uSuffix}__${kbtu}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const label = `${seriesName} ${lengthFt}'${uSuffix} ${kbtu}kBTU`;

    const model = {
      id: modelId,
      label: label,
      categoryId: categoryId,
      svgContent: svgContent,
      svgPath: path,
      dimensions: dimensions,
      // Gas heater specs
      kbtu: kbtu,
      kbtuHigh: btuSpecs.kbtuHigh || kbtu,
      kbtuLow: btuSpecs.kbtuLow,
      lengthFt: lengthFt,
      isUBend: isUBend,
      isElectric: false,
      // Additional specs from the specs file
      weightStandard: btuSpecs.weightStandard,
      weightStainless: btuSpecs.weightStainless,
      mountingHeightMin: btuSpecs.mountingHeightMin,
      mountingHeightMax: btuSpecs.mountingHeightMax,
      combustionChamber: btuSpecs.combustionChamber,
      radiantEmitter: btuSpecs.radiantEmitter,
    };

    nestedTree[seriesName].children[typeName].children[lengthName].models.push(model);
    flatCategories[categoryId].models.push(model);
  }
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
    models: HEATER_MODELS_FROM_SVG.map(m => ({ id: m.id, label: m.label, kbtu: m.kbtu }))
  });
}
