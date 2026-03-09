import { GRID, COLORS } from '../../utils/constants';
import useLayoutStore from '../../store/useLayoutStore';

/**
 * Draws an infinite-feel grid that fills the given visible bounds.
 * Props: viewX, viewY, viewW, viewH — the visible area in SVG coords.
 */
export default function GridLayer({ viewX, viewY, viewW, viewH }) {
  const gridDivisionFt = useLayoutStore((s) => s.gridDivisionFt);
  const lines = [];

  // Grid step in pixels (based on feet per division)
  const step = GRID * gridDivisionFt;

  // Extend bounds a bit to avoid popping at edges
  const pad = step * 2;
  const left = Math.floor((viewX - pad) / step) * step;
  const top = Math.floor((viewY - pad) / step) * step;
  const right = Math.ceil((viewX + viewW + pad) / step) * step;
  const bottom = Math.ceil((viewY + viewH + pad) / step) * step;

  // Minor grid lines
  for (let x = left; x <= right; x += step) {
    lines.push(
      <line key={`v${x}`} x1={x} y1={top} x2={x} y2={bottom}
        stroke={COLORS.gridMinor} strokeWidth={0.5} />
    );
  }
  for (let y = top; y <= bottom; y += step) {
    lines.push(
      <line key={`h${y}`} x1={left} y1={y} x2={right} y2={y}
        stroke={COLORS.gridMinor} strokeWidth={0.5} />
    );
  }

  // Major grid lines every 5 divisions
  const majorStep = step * 5;
  const majorLeft = Math.floor((viewX - pad) / majorStep) * majorStep;
  const majorTop = Math.floor((viewY - pad) / majorStep) * majorStep;

  for (let x = majorLeft; x <= right; x += majorStep) {
    lines.push(
      <line key={`mv${x}`} x1={x} y1={top} x2={x} y2={bottom}
        stroke={COLORS.gridMajor} strokeWidth={0.8} />
    );
  }
  for (let y = majorTop; y <= bottom; y += majorStep) {
    lines.push(
      <line key={`mh${y}`} x1={left} y1={y} x2={right} y2={y}
        stroke={COLORS.gridMajor} strokeWidth={0.8} />
    );
  }

  return <g>{lines}</g>;
}
