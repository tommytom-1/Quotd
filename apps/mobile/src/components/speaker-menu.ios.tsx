import { Button, Host, Menu, RNHostView } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityHint,
  accessibilityLabel,
  buttonStyle,
  disabled as isDisabled,
} from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";

import type { SpeakerMenuProps } from "@/components/speaker-menu.types";
import { useApp } from "@/context/app-context";

export function SpeakerMenu({
  children,
  name,
  selected,
  disabled,
  onPress,
  onRename,
  onPhoto,
  onRemovePhoto,
}: SpeakerMenuProps) {
  const { resolvedTheme } = useApp();
  return (
    <Host colorScheme={resolvedTheme} matchContents ignoreSafeArea="all">
      {/* A primary-action menu preserves tap/hold without ContextMenu's lift preview. */}
      <Menu
        onPrimaryAction={onPress}
        modifiers={[
          isDisabled(disabled),
          buttonStyle("plain"),
          accessibilityLabel(name),
          accessibilityHint("Tap to filter. Hold to change name or photo."),
          accessibilityAddTraits(selected ? ["isSelected"] : []),
        ]}
        label={
          <RNHostView matchContents>
            <View
              pointerEvents="none"
              style={{ width: 76, alignItems: "center" }}
            >
              {children}
            </View>
          </RNHostView>
        }
      >
        <Button label="Change name" systemImage="pencil" onPress={onRename} />
        <Button
          label="Change profile photo"
          systemImage="photo"
          onPress={onPhoto}
        />
        {onRemovePhoto ? (
          <Button
            label="Remove photo"
            systemImage="trash"
            role="destructive"
            onPress={onRemovePhoto}
          />
        ) : null}
      </Menu>
    </Host>
  );
}
