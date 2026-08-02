// Numik design-system tokens (typed mirror of the CSS variables in globals.css).
//
// INTEGRATION POINT: these values recreate the Numik visual theme (violet accent,
// dark-first surfaces) so the app is theme-compatible today. To adopt the canonical
// export from the existing Numik app/repo, replace the values here AND the matching
// :root block in src/app/globals.css — no component code references raw hex.
export const tokens = {
  accent: {
    rgb: "124 92 255", // #7c5cff — Numik violet
    hover: "#8f72ff",
    deep: "#5b3fd6",
    soft: "rgba(124, 92, 255, 0.12)",
  },
  radius: { sm: "6px", base: "10px", lg: "16px", xl: "22px" },
  state: {
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#38bdf8",
  },
} as const;

// alpha(): compose translucent colors from the accent RGB tri:
//   alpha(0.2) -> "rgb(124 92 255 / 0.2)". Never string-concat a hex suffix.
export function alpha(a: number): string {
  return `rgb(${tokens.accent.rgb} / ${a})`;
}
