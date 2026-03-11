export const GRID = 20;
export const CANVAS_W = 880;
export const CANVAS_H = 620;

// Scale factor for heater SVGs
// SVGs have dimensions in mm, already converted to px (mm * 3.78)
// This additional scale adjusts the overall size on canvas
// Increase to make heaters larger, decrease to make smaller
export const HEATER_SCALE = 1.0;

export const snap = (v) => Math.round(v / GRID) * GRID;

// Re-export heater catalog from centralized location
export {
  HEATER_MODELS_FROM_SVG as HEATER_MODELS,
  HEATER_CATEGORIES,
  getHeaterModel,
  hasSvgHeaters
} from './heaterCatalog';

// Legacy fallback models (used if no SVGs found)
export const HEATER_MODELS_LEGACY = [
  { id: 'u100',  label: 'U-100',  kbtu: 100, lengthFt: 6 },
  { id: 'u150',  label: 'U-150',  kbtu: 150, lengthFt: 8 },
  { id: 'u200',  label: 'U-200',  kbtu: 200, lengthFt: 10 },
  { id: 'it150', label: 'IT-150', kbtu: 150, lengthFt: 9 },
  { id: 'it200', label: 'IT-200', kbtu: 200, lengthFt: 11 },
];

export const COLORS = {
  navy: '#0F1E30',
  navyMid: '#1B3557',
  orange: '#f37021',
  heaterNormal: '#f37021',
  heaterPreview: '#ff8c5a',
  wallStroke: '#1B3557',
  wallFill: 'rgba(27,53,87,0.04)',
  wallHatch: 'rgba(27,53,87,0.15)',
  gridMinor: 'rgba(200, 210, 220, 0.35)',
  gridMajor: 'rgba(180, 195, 210, 0.5)',
  dimText: '#1B3557',
  dimBorder: '#D4DCE8',
  doorLabel: '#7A9BB5',
};

// Logo embedded as base64 PNG (from GLR Logo Transparent.png)
export { GLR_LOGO_BASE64 } from './logoData';

export const OFFICES = [
  {
    name: 'Ohio Office',
    lines: ['1191 George Washington Blvd', 'Akron, OH 44312', 'P: (330) 942-0396'],
  },
  {
    name: 'Florida Office',
    lines: ['16703 Early Riser Ave #202', "Land O' Lakes, FL 34638", 'P: (813) 946-8533'],
  },
  {
    name: 'Massachusetts Office',
    lines: ['5 Centech Blvd #4', 'Shrewsbury, MA 01545', 'P: (508) 453-1900'],
  },
  {
    name: 'Maryland Office',
    lines: ['26262 Three Notch Rd. #14', 'Mechanicsville, MD 20659', 'P: (301) 327-1745'],
  },
  {
    name: 'Minnesota Office',
    lines: ['7665 Washington Ave S', 'Edina, MN 55439', 'P: (952) 944-0023'],
  },
];

export const TOOLS = [
  { id: 'select', label: 'Select',     icon: '\u2196', hint: 'Select & inspect elements' },
  { id: 'draw',   label: 'Draw Walls', icon: '\u2B21', hint: 'Click points, click origin to close' },
  { id: 'overhead-door', label: 'Overhead Door', icon: '\u2B1C', hint: 'Click wall to set start, click again to set width' },
  { id: 'man-door', label: 'Man Door', icon: '\u25AF', hint: 'Click wall to place door' },
  { id: 'heater', label: 'Heater',     icon: '\u25C9', hint: 'Click canvas to place heater' },
  { id: 'dimension', label: 'Dimension', icon: '\u2194', hint: 'Click two points to add dimension line' },
];
