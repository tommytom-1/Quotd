import type { ReactNode } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

/**
 * Draws what it holds flat, as one picture, so that whatever tilts it turns
 * the picture rather than each layer. iOS then blends the tilted edges
 * instead of stepping them: React Native only smooths the edges of a view
 * that is itself rotated, never those of the views inside it.
 *
 * Only edges inside the picture are blended, not the picture's own, so it
 * keeps a transparent `margin` around its content, large enough to hold any
 * shadow. A negative margin of the same size leaves the layout as it was.
 */
export function SmoothEdges({
  children,
  margin,
  style,
}: {
  children: ReactNode;
  margin: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      // Holds no style of its own that would keep React Native from merging
      // it into its parent, which would drop the picture.
      collapsable={false}
      shouldRasterizeIOS
      style={[{ margin: -margin, padding: margin }, style]}
    >
      {children}
    </View>
  );
}
