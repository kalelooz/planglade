"use client";

import { useEffect, useRef } from "react";

import { useHasHydrated, useStore } from "@/lib/store";
import {
  readExplicitLocalThemePreference,
  resolveHydratedTheme,
  useThemePreference,
} from "@/lib/theme-preference";

export function AppSettingsBridge() {
  const hydrated = useHasHydrated();
  const settings = useStore((s) => s.settings);
  const initializedTheme = useRef(false);
  const { initializeTheme } = useThemePreference();

  useEffect(() => {
    if (!hydrated || initializedTheme.current) return;
    initializedTheme.current = true;

    const localTheme = readExplicitLocalThemePreference();
    const initialTheme = resolveHydratedTheme(localTheme, settings.theme);

    // A clean light-first device needs no stored override; explicit local and
    // hydrated non-default preferences are synchronized into both theme systems.
    if (localTheme || initialTheme !== "light") {
      initializeTheme(initialTheme);
    }
  }, [hydrated, initializeTheme, settings.theme]);

  useEffect(() => {
    if (!hydrated || typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--primary", settings.accent);
    root.style.setProperty("--ring", settings.accent);
    root.style.setProperty("--accent", settings.accent);
    root.dataset.density = settings.density;
  }, [hydrated, settings.accent, settings.density]);

  return null;
}
