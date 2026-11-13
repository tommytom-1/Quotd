// @react-native-masked-view/masked-view@0.3.2 (the latest release) still types
// its component against ReactNative.NativeMethods, which React Native 0.88
// removed. That makes the shipped default export unusable as a JSX component.
// Re-declare it against the current host-instance types until upstream catches
// up — the runtime component is unchanged.
declare module "@react-native-masked-view/masked-view" {
  import type { ComponentType, ReactElement, Ref } from "react";
  import type { HostInstance, ViewProps } from "react-native";

  export interface MaskedViewProps extends ViewProps {
    maskElement: ReactElement;
    androidRenderingMode?: "software" | "hardware";
    ref?: Ref<HostInstance>;
  }

  const MaskedView: ComponentType<MaskedViewProps>;
  export default MaskedView;
}
