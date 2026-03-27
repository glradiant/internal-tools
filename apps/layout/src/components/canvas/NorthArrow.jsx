import { COLORS } from '../../utils/constants';

export default function NorthArrow({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={20} fill="white" stroke={COLORS.gridMajor} strokeWidth={1} />
      <polygon points="0,-14 4,6 0,2 -4,6" fill={COLORS.navyMid} />
      <polygon points="0,14 4,-6 0,-2 -4,-6" fill="rgba(27,53,87,0.15)" />
      <text
        y={-17}
        textAnchor="middle"
        fontSize={7}
        fill={COLORS.navyMid}
        fontFamily="'DM Mono', monospace"
        fontWeight={700}
      >
        N
      </text>
    </g>
  );
}
