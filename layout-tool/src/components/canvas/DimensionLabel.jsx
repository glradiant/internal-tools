import { GRID, COLORS } from '../../utils/constants';
import useLayoutStore from '../../store/useLayoutStore';

// Base values (for ~50ft drawings)
const BASE_GAP = 4;        // gap between wall and start of extension line
const BASE_EXTEND = 20;    // how far extension lines reach from the wall
const BASE_OVERSHOOT = 3;  // extension line past the dimension line
const BASE_ARROW = 3;      // arrowhead size
const BASE_FONT_SIZE = 7;
const BASE_TEXT_PAD = 2;   // padding around text on dimension line
const BASE_STROKE = 0.5;   // line stroke width

export default function DimensionLabel({ ax, ay, bx, by, wallPoints }) {
  const labelScale = useLayoutStore((s) => s.getLabelScale());

  // Scale all visual dimensions
  const GAP = BASE_GAP * labelScale;
  const EXTEND = BASE_EXTEND * labelScale;
  const OVERSHOOT = BASE_OVERSHOOT * labelScale;
  const ARROW = BASE_ARROW * labelScale;
  const FONT_SIZE = BASE_FONT_SIZE * labelScale;
  const TEXT_PAD = BASE_TEXT_PAD * labelScale;
  const strokeWidth = BASE_STROKE * labelScale;
  const segLen = Math.hypot(bx - ax, by - ay);
  if (segLen === 0) return null;
  const ft = Math.round(segLen / GRID);
  if (ft === 0) return null;

  // Unit direction along segment
  const ux = (bx - ax) / segLen;
  const uy = (by - ay) / segLen;

  // Perpendicular — default outward normal (left-hand normal)
  let nx = -uy;
  let ny = ux;

  // If wall points provided, push dimension to the outside (away from centroid)
  if (wallPoints && wallPoints.length >= 3) {
    const cx = wallPoints.reduce((s, p) => s + p.x, 0) / wallPoints.length;
    const cy = wallPoints.reduce((s, p) => s + p.y, 0) / wallPoints.length;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const dot = (cx - mx) * nx + (cy - my) * ny;
    if (dot > 0) {
      nx = -nx;
      ny = -ny;
    }
  }

  // Extension line endpoints
  const extStart = GAP;
  const extEnd = GAP + EXTEND;
  const dimOffset = GAP + EXTEND;

  // Extension line A (from point a)
  const eA1x = ax + nx * extStart;
  const eA1y = ay + ny * extStart;
  const eA2x = ax + nx * (extEnd + OVERSHOOT);
  const eA2y = ay + ny * (extEnd + OVERSHOOT);

  // Extension line B (from point b)
  const eB1x = bx + nx * extStart;
  const eB1y = by + ny * extStart;
  const eB2x = bx + nx * (extEnd + OVERSHOOT);
  const eB2y = by + ny * (extEnd + OVERSHOOT);

  // Dimension line endpoints (at dimOffset from wall)
  const dAx = ax + nx * dimOffset;
  const dAy = ay + ny * dimOffset;
  const dBx = bx + nx * dimOffset;
  const dBy = by + ny * dimOffset;

  // Arrowhead points
  const arrowA = [
    `${dAx},${dAy}`,
    `${dAx + ux * ARROW + nx * ARROW * 0.35},${dAy + uy * ARROW + ny * ARROW * 0.35}`,
    `${dAx + ux * ARROW - nx * ARROW * 0.35},${dAy + uy * ARROW - ny * ARROW * 0.35}`,
  ].join(' ');

  const arrowB = [
    `${dBx},${dBy}`,
    `${dBx - ux * ARROW + nx * ARROW * 0.35},${dBy - uy * ARROW + ny * ARROW * 0.35}`,
    `${dBx - ux * ARROW - nx * ARROW * 0.35},${dBy - uy * ARROW - ny * ARROW * 0.35}`,
  ].join(' ');

  // Text position — center of dimension line, offset perpendicular (above the line)
  const textCX = (dAx + dBx) / 2 + nx * (FONT_SIZE * 0.5 + TEXT_PAD);
  const textCY = (dAy + dBy) / 2 + ny * (FONT_SIZE * 0.5 + TEXT_PAD);

  // AIA text convention: readable from bottom or right
  const angleDeg = Math.atan2(dBy - dAy, dBx - dAx) * 180 / Math.PI;
  const normAngle = ((angleDeg % 360) + 360) % 360;
  const flip = normAngle > 90 && normAngle < 270;
  const textAngle = flip ? angleDeg + 180 : angleDeg;

  const label = `${ft}'`;
  const dimColor = COLORS.dimText;

  // Estimate text width for background rect
  const textW = label.length * FONT_SIZE * 0.65 + TEXT_PAD * 2;
  const textH = FONT_SIZE * 1.2;

  return (
    <g>
      {/* Extension lines */}
      <line
        x1={eA1x} y1={eA1y} x2={eA2x} y2={eA2y}
        stroke={dimColor} strokeWidth={strokeWidth} opacity={0.6}
      />
      <line
        x1={eB1x} y1={eB1y} x2={eB2x} y2={eB2y}
        stroke={dimColor} strokeWidth={strokeWidth} opacity={0.6}
      />

      {/* Dimension line */}
      <line
        x1={dAx} y1={dAy} x2={dBx} y2={dBy}
        stroke={dimColor} strokeWidth={strokeWidth} opacity={0.6}
      />

      {/* Arrowheads */}
      <polygon points={arrowA} fill={dimColor} opacity={0.7} />
      <polygon points={arrowB} fill={dimColor} opacity={0.7} />

      {/* Text group — single transform on <g> for svg2pdf.js compatibility */}
      <g transform={`translate(${textCX},${textCY}) rotate(${textAngle})`}>
        <rect
          x={-textW / 2}
          y={-textH / 2}
          width={textW}
          height={textH}
          fill="white"
        />
        <text
          x={0}
          y={FONT_SIZE * 0.35}
          textAnchor="middle"
          fontSize={FONT_SIZE}
          fill={dimColor}
          fontFamily="Courier, monospace"
          fontWeight={600}
        >
          {label}
        </text>
      </g>
    </g>
  );
}
