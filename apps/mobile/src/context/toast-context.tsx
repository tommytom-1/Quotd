import { X } from "lucide-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/app-context";

export type ToastType = "success" | "info" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((current) => [...current, { id, message, type }].slice(-3));
      setTimeout(() => dismissToast(id), 2600);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { palette } = useApp();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.viewport, { top: insets.top + 10 }]}
    >
      {toasts.map((toast) => {
        let backgroundColor = palette.inverseSurface;
        let color = palette.inverseText;
        if (toast.type === "error") {
          backgroundColor = palette.danger;
        }
        if (toast.type === "info") {
          backgroundColor = palette.surfaceElevated;
          color = palette.text;
        }

        return (
          <View
            key={toast.id}
            style={[
              styles.toast,
              { backgroundColor, borderColor: palette.border },
            ]}
          >
            <Text numberOfLines={2} style={[styles.message, { color }]}>
              {toast.message}
            </Text>
            <Pressable
              accessibilityLabel="Dismiss notification"
              hitSlop={10}
              onPress={() => onDismiss(toast.id)}
            >
              <X color={color} opacity={0.55} size={13} strokeWidth={2.2} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context.showToast;
}

const styles = StyleSheet.create({
  message: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  toast: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    maxWidth: 340,
    paddingHorizontal: 15,
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  viewport: {
    alignItems: "center",
    gap: 8,
    left: 20,
    position: "absolute",
    right: 20,
    zIndex: 100,
  },
});
