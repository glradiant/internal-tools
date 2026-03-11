import { GRID, COLORS } from '../../utils/constants';
import { segmentAngleDeg } from '../../utils/geometry';
import useLayoutStore from '../../store/useLayoutStore';

export default function DoorGlyph({ door, walls, selected }) {
  const labelScale = useLayoutStore((s) => s.getLabelScale());
  const wall = walls.find((w) => w.id === door.wallId);
  if (!wall) return null;

  const pts = wall.points;
  const a = pts[door.segmentIndex];
  const b = pts[(door.segmentIndex + 1) % pts.length];
  const segLen = Math.hypot(b.x - a.x, b.y - a.y);
  if (segLen === 0) return null;

  const dx = (b.x - a.x) / segLen;
  const dy = (b.y - a.y) / segLen;

  // Door center position along segment
  const startX = a.x + door.tStart * (b.x - a.x);
  const startY = a.y + door.tStart * (b.y - a.y);
  const centerX = startX + (door.widthPx / 2) * dx;
  const centerY = startY + (door.widthPx / 2) * dy;
  const angle = segmentAngleDeg(a.x, a.y, b.x, b.y);
  const hw = door.widthPx / 2;

  // Determine inward direction (toward polygon interior)
  let inwardSign = 1;
  if (pts.length >= 3) {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const toCenter = { x: cx - centerX, y: cy - centerY };
    const dot = toCenter.x * (-dy) + toCenter.y * dx;
    inwardSign = dot >= 0 ? 1 : -1;
  }

  const isManDoor = door.doorType === 'man';
  const heightPx = door.heightFt ? door.heightFt * GRID : 0;

  // AIA text convention: normalize angle for text orientation
  const normAngle = ((angle % 360) + 360) % 360;
  const flip = normAngle > 90 && normAngle < 270;

  if (isManDoor) {
    // Man door rendering - standard architectural symbol
    // Door swings 90 degrees from hinge point
    const doorLen = door.widthPx - 4; // Door panel length (slightly less than opening)
    const hingeSide = door.hingeSide || 'left';
    const swingIn = door.swingIn !== undefined ? door.swingIn : true;
    const hingeX = hingeSide === 'left' ? -hw + 2 : hw - 2; // Hinge position
    const swingDir = (swingIn ? inwardSign : -inwardSign) * (hingeSide === 'right' ? -1 : 1);

    return (
      <g
        transform={`translate(${centerX},${centerY}) rotate(${angle})`}
        data-entity-id={door.id}
        data-entity-type="door"
      >
        {selected && (
          <rect
            x={-hw - 4} y={Math.min(-10, -doorLen - 4) * (swingDir > 0 ? 1 : -1) - 4}
            width={door.widthPx + 8}
            height={doorLen + 18}
            rx={3}
            fill="none"
            stroke="#60A5FA"
            strokeWidth={1.5}
            strokeDasharray="4,3"
          />
        )}

        {/* Door jamb lines */}
        <line x1={-hw} y1={-7} x2={-hw} y2={7} stroke={COLORS.wallStroke} strokeWidth={2.5} />
        <line x1={hw} y1={-7} x2={hw} y2={7} stroke={COLORS.wallStroke} strokeWidth={2.5} />

        {/* 90-degree swing arc from hinge */}
        <path
          d={hingeSide === 'left'
            ? `M ${hingeX + doorLen} 0 A ${doorLen} ${doorLen} 0 0 ${swingDir > 0 ? 0 : 1} ${hingeX} ${swingDir > 0 ? -doorLen : doorLen}`
            : `M ${hingeX - doorLen} 0 A ${doorLen} ${doorLen} 0 0 ${swingDir > 0 ? 1 : 0} ${hingeX} ${swingDir > 0 ? -doorLen : doorLen}`
          }
          fill="none"
          stroke={COLORS.wallStroke}
          strokeWidth={0.75}
          strokeDasharray="3,2"
          opacity={0.5}
        />

        {/* Door panel in open position (perpendicular to wall) */}
        <line
          x1={hingeX} y1={0}
          x2={hingeX} y2={swingDir > 0 ? -doorLen : doorLen}
          stroke={COLORS.wallStroke}
          strokeWidth={1.5}
        />

        {/* Small hinge indicator */}
        <circle cx={hingeX} cy={0} r={2} fill={COLORS.wallStroke} />

        {/* Label */}
        {(() => {
          const widthFt = Math.round(door.widthPx / GRID);
          const label = `${widthFt}' MAN DOOR`;
          const maxWidth = door.widthPx * 1.5;
          const charWidth = 4.5 * labelScale;
          const naturalWidth = label.length * charWidth;
          const baseFontSize = 7 * labelScale;
          const fontSize = Math.min(baseFontSize, (maxWidth / naturalWidth) * baseFontSize);
          // Position label just past door swing, with fixed offset plus half font height
          const offset = 8 + fontSize * 0.5;
          const baseY = swingDir > 0 ? -doorLen - offset : doorLen + offset;
          const localY = flip ? -baseY : baseY;

          return (
            <g transform={flip ? `rotate(180, 0, 0)` : undefined}>
              <text
                x={0}
                y={localY + fontSize * 0.35}
                textAnchor="middle"
                fontSize={fontSize}
                fill={COLORS.doorLabel}
                fontFamily="Helvetica, Arial, sans-serif"
                fontWeight="bold"
              >
                {label}
              </text>
            </g>
          );
        })()}
      </g>
    );
  }

  // Overhead door rendering (original)
  return (
    <g
      transform={`translate(${centerX},${centerY}) rotate(${angle})`}
      data-entity-id={door.id}
      data-entity-type="door"
    >
      {selected && (
        <rect
          x={-hw - 4} y={-10}
          width={door.widthPx + 8} height={20}
          rx={3}
          fill="none"
          stroke="#60A5FA"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />
      )}

      {/* Open-door footprint rectangle (if height specified) */}
      {heightPx > 0 && (
        <rect
          x={-hw}
          y={inwardSign > 0 ? 0 : -heightPx}
          width={door.widthPx}
          height={heightPx}
          fill="rgba(255,107,53,0.06)"
          stroke={COLORS.orange}
          strokeWidth={0.75}
          strokeDasharray="4,3"
        />
      )}

      {/* Door jamb lines */}
      <line x1={-hw} y1={-7} x2={-hw} y2={7} stroke={COLORS.wallStroke} strokeWidth={2.5} />
      <line x1={hw} y1={-7} x2={hw} y2={7} stroke={COLORS.wallStroke} strokeWidth={2.5} />
      {/* Sectional door panel lines */}
      {[-1, 0, 1].map((i) => (
        <line
          key={i}
          x1={-hw + 3} y1={i * 2.5}
          x2={hw - 3} y2={i * 2.5}
          stroke={COLORS.wallStroke}
          strokeWidth={0.75}
          opacity={0.4}
        />
      ))}
      {/* OVERHEAD DOOR label — AIA convention: reads from bottom or right */}
      {(() => {
        const widthFt = Math.round(door.widthPx / GRID);
        const label = door.heightFt
          ? `${door.heightFt}' x ${widthFt}' OVERHEAD DOOR`
          : `${widthFt}' OVERHEAD DOOR`;
        const maxWidth = door.widthPx - 6;
        // Scale font with drawing size, but shrink if it would overflow door width
        const baseFontSize = 7 * labelScale;
        const charWidthRatio = 0.62; // character width per font size unit
        const textWidthAtBaseFont = label.length * charWidthRatio * baseFontSize;
        const fontSize = textWidthAtBaseFont > maxWidth
          ? maxWidth / (label.length * charWidthRatio)
          : baseFontSize;
        // Fixed offset from door (12px) plus half font height for proper centering
        const offset = 12 + fontSize * 0.5;
        const baseY = inwardSign > 0 ? offset : -offset;
        const localY = flip ? -baseY : baseY;

        return (
          <g transform={flip ? `rotate(180, 0, 0)` : undefined}>
            <text
              x={0}
              y={localY + fontSize * 0.35}
              textAnchor="middle"
              fontSize={fontSize}
              fill={COLORS.doorLabel}
              fontFamily="Courier, monospace"
              fontWeight={600}
            >
              {label}
            </text>
          </g>
        );
      })()}
    </g>
  );
}
