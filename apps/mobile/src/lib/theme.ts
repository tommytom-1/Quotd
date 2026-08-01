export type ResolvedTheme = "light" | "dark";

export interface AppPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  inverseSurface: string;
  inverseText: string;
  overlay: string;
  danger: string;
  dangerSurface: string;
}

export const PALETTES: Record<ResolvedTheme, AppPalette> = {
  light: {
    background: "#F7F7F5",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    surfaceMuted: "#EEEEEB",
    text: "#171717",
    textSecondary: "#666663",
    textMuted: "#777773",
    border: "#E3E3DF",
    inverseSurface: "#171717",
    inverseText: "#FFFFFF",
    overlay: "rgba(0, 0, 0, 0.44)",
    danger: "#E5484D",
    dangerSurface: "#FDEBEC",
  },
  dark: {
    background: "#0A0A0A",
    surface: "#151515",
    surfaceElevated: "#1B1B1B",
    surfaceMuted: "#242424",
    text: "#F7F7F5",
    textSecondary: "#B0B0AA",
    textMuted: "#94948E",
    border: "#2A2A2A",
    inverseSurface: "#F7F7F5",
    inverseText: "#151515",
    overlay: "rgba(0, 0, 0, 0.68)",
    danger: "#FF6369",
    dangerSurface: "#35191B",
  },
};
