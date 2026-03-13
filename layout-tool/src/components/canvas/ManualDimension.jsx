import { GRID, COLORS } from '../../utils/constants';
import useLayoutStore from '../../store/useLayoutStore';

/**
 * Renders a manual dimension line between two points.
 */
export default function ManualDimension({
  x1, y1, x2, y2, selected,
  labelText, labelSizeOffset, labelRotation, labelVisible
}) {
  const labelScale = useLayoutStore((s) => s.getLabelScale());

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const distFt = Math.round(dist / GRID * 10) / 10;

  // Angle of the line
  const angle = Math.atan2(dy, dx);
  const angleDeg = (angle * 180) / Math.PI;

  // Midpoint for label
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Offset perpendicular to the line for the dimension line (scaled)
  const offset = 15 * labelScale;
  const perpX = -Math.sin(angle) * offset;
  const perpY = Math.cos(angle) * offset;

  // Dimension line endpoints (offset from actual points)
  const dimX1 = x1 + perpX;
  const dimY1 = y1 + perpY;
  const dimX2 = x2 + perpX;
  const dimY2 = y2 + perpY;

  // Extension lines (scaled)
  const extLen = offset + 5 * labelScale;
  const ext1X = x1 + (-Math.sin(angle) * extLen);
  const ext1Y = y1 + (Math.cos(angle) * extLen);
  const ext2X = x2 + (-Math.sin(angle) * extLen);
  const ext2Y = y2 + (Math.cos(angle) * extLen);

  // Scaled visual parameters with size offset
  const sizeMultiplier = 1 + (labelSizeOffset || 0) * 0.1;
  const fontSize = 9 * labelScale * sizeMultiplier;
  const strokeW = 0.75 * labelScale;
  const dimStrokeW = 1 * labelScale;
  const labelW = 36 * labelScale * sizeMultiplier;
  const labelH = 14 * labelScale * sizeMultiplier;
  const selectRadius = 4 * labelScale;

  // Label position (at midpoint of dimension line)
  const labelX = midX + perpX;
  const labelY = midY + perpY;

  // Use manual rotation if set, otherwise flip text if it would be upside down
  const useManualRotation = labelRotation !== null && labelRotation !== undefined;
  const autoTextAngle = angleDeg >= 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;
  const textAngle = useManualRotation ? labelRotation : autoTextAngle;

  const strokeColor = selected ? '#60A5FA' : '#f37021';

  // Default label text
  const displayText = labelText ?? `${distFt}'`;

  // Check visibility
  const isVisible = labelVisible !== false;

  return (
    <g>
      {/* Extension lines */}
      <line
        x1={x1} y1={y1}
        x2={ext1X} y2={ext1Y}
        stroke={strokeColor}
        strokeWidth={strokeW}
        opacity={0.6}
      />
      <line
        x1={x2} y1={y2}
        x2={ext2X} y2={ext2Y}
        stroke={strokeColor}
        strokeWidth={strokeW}
        opacity={0.6}
      />

      {/* Dimension line */}
      <line
        x1={dimX1} y1={dimY1}
        x2={dimX2} y2={dimY2}
        stroke={strokeColor}
        strokeWidth={dimStrokeW}
        markerStart="url(#dimArrowStart)"
        markerEnd="url(#dimArrowEnd)"
      />

      {/* Hit area for selection */}
      <line
        x1={dimX1} y1={dimY1}
        x2={dimX2} y2={dimY2}
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: 'pointer' }}
      />

      {/* Label (only if visible) */}
      {isVisible && (
        <>
          {/* Label background */}
          <rect
            x={labelX - labelW / 2}
            y={labelY - labelH / 2}
            width={labelW}
            height={labelH}
            fill="white"
            transform={`rotate(${textAngle}, ${labelX}, ${labelY})`}
          />

          {/* Label */}
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontFamily="'DM Mono', monospace"
            fontWeight={600}
            fill={strokeColor}
            transform={`rotate(${textAngle}, ${labelX}, ${labelY})`}
          >
            {displayText}
          </text>
        </>
      )}

      {/* Selection indicator */}
      {selected && (
        <>
          <circle cx={x1} cy={y1} r={selectRadius} fill="#60A5FA" />
          <circle cx={x2} cy={y2} r={selectRadius} fill="#60A5FA" />
        </>
      )}
    </g>
  );
}
