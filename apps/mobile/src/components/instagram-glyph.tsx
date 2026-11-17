import Svg, { Circle, Rect } from "react-native-svg";

/** Instagram's camera glyph, drawn to match the app's line icons. */
export function InstagramGlyph({
  color,
  size,
  strokeWidth,
}: {
  color: string;
  size: number;
  strokeWidth: number;
}) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <Rect
        height={18}
        rx={5}
        stroke={color}
        strokeWidth={strokeWidth}
        width={18}
        x={3}
        y={3}
      />
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={17.2} cy={6.8} fill={color} r={1.1} />
    </Svg>
  );
}
