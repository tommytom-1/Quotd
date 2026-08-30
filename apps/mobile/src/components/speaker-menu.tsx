import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { SpeakerMenuProps } from "@/components/speaker-menu.types";
import { useApp } from "@/context/app-context";

// iOS uses SwiftUI's native context menu. Other platforms anchor this menu to the avatar.
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
  const { palette } = useApp();
  const { width, height } = useWindowDimensions();
  const anchor = useRef<View>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const open = () =>
    anchor.current?.measureInWindow((x, y, _width, anchorHeight) => {
      setPosition({
        left: Math.max(12, Math.min(x, width - 252)),
        top: Math.max(12, Math.min(y + anchorHeight + 8, height - 200)),
      });
    });
  const perform = (action: () => void) => {
    setPosition(null);
    action();
  };
  return (
    <>
      <Pressable
        ref={anchor}
        accessibilityLabel={name}
        accessibilityHint="Tap to filter. Hold to change name or photo."
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityActions={[
          { name: "manage", label: "Change name or profile photo" },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "manage") {
            open();
          }
        }}
        disabled={disabled}
        onPress={onPress}
        onLongPress={open}
        style={styles.trigger}
      >
        {children}
      </Pressable>
      <Modal
        transparent
        visible={position !== null}
        onRequestClose={() => setPosition(null)}
        animationType="fade"
      >
        <Pressable
          accessibilityLabel="Dismiss person menu"
          style={StyleSheet.absoluteFill}
          onPress={() => setPosition(null)}
        />
        <View
          style={[
            styles.menu,
            position,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => perform(onRename)}
            style={styles.item}
          >
            <Text style={{ color: palette.text }}>Change name</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => perform(onPhoto)}
            style={styles.item}
          >
            <Text style={{ color: palette.text }}>Change profile photo</Text>
          </Pressable>
          {onRemovePhoto ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => perform(onRemovePhoto)}
              style={styles.item}
            >
              <Text style={{ color: palette.danger }}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 76, alignItems: "center" },
  menu: {
    position: "absolute",
    width: 240,
    borderRadius: 14,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  item: { paddingHorizontal: 14, paddingVertical: 15 },
});
