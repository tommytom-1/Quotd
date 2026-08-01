import { UserRound } from "lucide-react-native";
import { Image, StyleSheet, View } from "react-native";

import { useApp } from "@/context/app-context";

export function ProfileAvatar({
  uri,
  size = 40,
}: {
  uri: string | null;
  size?: number;
}) {
  const { palette } = useApp();

  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor: palette.surfaceMuted,
          borderColor: palette.border,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <UserRound
          color={palette.textMuted}
          size={size * 0.44}
          strokeWidth={1.55}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    height: "100%",
    resizeMode: "cover",
    width: "100%",
  },
});
