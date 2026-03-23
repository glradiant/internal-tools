/**
 * Builder Parts Catalog
 * Loads SVG parts for the custom heater builder from heater_svgs/LS3_Builder_Parts/
 */

import defaultConnections from '../data/builderPartsDefaults.json';

// Load all builder part SVGs
const svgModulesRoot = import.meta.glob('/heater_svgs/LS3_Builder_Parts/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const svgModulesRelative = import.meta.glob('../../../heater_svgs/LS3_Builder_Parts/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const svgModules = { ...svgModulesRoot, ...svgModulesRelative };

// Parse viewBox and dimensions from SVG content
function extractDimensions(svgContent) {
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

  const parseMm = (str) => {
    if (!str) return null;
    const num = parseFloat(str);
    if (str.includes('mm')) return num;
    return num;
  };

  return {
    viewBox,
    widthMm: parseMm(widthMatch?.[1]),
    heightMm: parseMm(heightMatch?.[1]),
    aspectRatio: viewBox.width / viewBox.height,
  };
}

// Skip reference/assembly files and variants we don't need
const SKIP_FILES = [
  'LS3_10ft_Assy.svg',
  'Burner_Box_Alt.svg',
  'REP_SS_90.svg',
  'RUP_SS_180.svg',
  '10ft_Tube_RR.svg',
];

function buildPartsCatalog() {
  const parts = [];

  // Load any saved calibration overrides from localStorage
  let calibrationOverrides = {};
  try {
    const stored = localStorage.getItem('builderPartAnchors');
    if (stored) calibrationOverrides = JSON.parse(stored);
  } catch {
    // ignore parse errors
  }

  for (const [path, svgContent] of Object.entries(svgModules)) {
    // Extract filename
    const fileName = path.split('/').pop();
    if (SKIP_FILES.includes(fileName)) continue;

    const dimensions = extractDimensions(svgContent);
    const defaults = defaultConnections[fileName];
    if (!defaults) {
      console.warn(`No default connections for builder part: ${fileName}`);
      continue;
    }

    // Use calibration overrides if available, otherwise use defaults
    const overrides = calibrationOverrides[fileName];
    const inlet = overrides?.inlet ?? defaults.inlet;
    const outlet = overrides?.outlet ?? defaults.outlet;

    const partId = fileName.replace('.svg', '').toLowerCase().replace(/[^a-z0-9]/g, '_');

    parts.push({
      partId,
      fileName,
      label: defaults.label,
      type: defaults.type,
      lengthFt: defaults.lengthFt,
      svgContent,
      svgPath: path,
      dimensions,
      inlet,
      outlet,
      isStainless: fileName.includes('_SS'),
      isReverseReturn: fileName.includes('_RR'),
    });
  }

  // Sort: burner first, then tubes, then turns
  const typeOrder = { burner: 0, tube: 1, turn90: 2, turn180: 3 };
  parts.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));

  return parts;
}

export const BUILDER_PARTS = buildPartsCatalog();

export function getBuilderPart(partId) {
  return BUILDER_PARTS.find((p) => p.partId === partId);
}

export function getBuilderPartsByType(type) {
  return BUILDER_PARTS.filter((p) => p.type === type);
}

if (import.meta.env.DEV) {
  console.log('Builder Parts Catalog:', BUILDER_PARTS.map((p) => ({ id: p.partId, label: p.label, type: p.type })));
}
