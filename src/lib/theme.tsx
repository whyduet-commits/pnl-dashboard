"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

export interface ThemeTokens {
  bgBase:    string;
  bgSurface: string;
  bgCard:    string;
  border:    string;
  borderEm:  string;
  textPri:   string;
  textMuted: string;
  textHint:  string;
  yellow:    string;
  green:     string;
  up:        string;
  dn:        string;
  gridLine:  string;
}

export const DARK: ThemeTokens = {
  bgBase:    "#0a0a0a",
  bgSurface: "#111111",
  bgCard:    "#161616",
  border:    "rgba(255,255,255,0.07)",
  borderEm:  "rgba(255,255,255,0.12)",
  textPri:   "#ffffff",
  textMuted: "rgba(255,255,255,0.4)",
  textHint:  "rgba(255,255,255,0.22)",
  yellow:    "#F5C418",
  green:     "#c8f04a",
  up:        "#c8f04a",
  dn:        "#ef4444",
  gridLine:  "rgba(255,255,255,0.04)",
};

export const LIGHT: ThemeTokens = {
  bgBase:    "#F5F4F0",
  bgSurface: "#ffffff",
  bgCard:    "#ffffff",
  border:    "#e8e8e8",
  borderEm:  "#d0d0d0",
  textPri:   "#1C1C1C",
  textMuted: "#888888",
  textHint:  "#aaaaaa",
  yellow:    "#1C1C1C",
  green:     "#555555",
  up:        "#e24b4a",
  dn:        "#aaaaaa",
  gridLine:  "#f0f0f0",
};

interface ThemeCtx {
  theme: Theme;
  T: ThemeTokens;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark", T: DARK, toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

useEffect(() => {
  const saved = localStorage.getItem("pnl-theme") as Theme | null;
  if (saved === "light" || saved === "dark") setTheme(saved);
}, []);

  const toggle = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("pnl-theme", next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, T: theme === "dark" ? DARK : LIGHT, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
