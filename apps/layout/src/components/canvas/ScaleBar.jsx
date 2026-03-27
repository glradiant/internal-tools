import { GRID, COLORS } from '../../utils/constants';

export default function ScaleBar({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={0} y={-4} width={GRID * 10} height={4} fill={COLORS.navyMid} />
      <rect x={GRID * 10} y={-4} width={GRID * 10} height={4} fill="rgba(27,53,87,0.3)" />
      <text x={0} y={8} fontSize={7} fill={COLORS.doorLabel} fontFamily="'DM Mono', monospace">0</text>
      <text x={GRID * 10} y={8} textAnchor="middle" fontSize={7} fill={COLORS.doorLabel} fontFamily="'DM Mono', monospace">10&prime;</text>
      <text x={GRID * 20} y={8} textAnchor="end" fontSize={7} fill={COLORS.doorLabel} fontFamily="'DM Mono', monospace">20&prime;</text>
    </g>
  );
}
