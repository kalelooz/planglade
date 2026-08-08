"use client";

import { useCallback } from "react";
import { useTheme } from "next-themes";

import { useStore, type Settings } from "@/lib/store";

export type ThemePreference = Settings["theme"];

const THEME_STORAGE_KEY = "theme";
const themePreferences = new Set<ThemePreference>(["light", "dark", "system"]);
let localSelectionVersion = 0;

export function readExplicitLocalThemePreference(
  storage: Pick<Storage, "getItem"> | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): ThemePreference | null {
  const value = storage?.getItem(THEME_STORAGE_KEY);
  return value && themePreferences.has(value as ThemePreference)
    ? (value as ThemePreference)
    : null;
}

export function getLocalThemeSelectionVersion() {
  return localSelectionVersion;
}

export function shouldInitializeThemeFromServer(
  requestSelectionVersion: number,
  currentSelectionVersion: number,
  localTheme: ThemePreference | null
) {
  return requestSelectionVersion === currentSelectionVersion && localTheme === null;
}

export function canInitializeThemeFromServer(requestSelectionVersion: number) {
  return shouldInitializeThemeFromServer(
    requestSelectionVersion,
    localSelectionVersion,
    readExplicitLocalThemePreference()
  );
}

export function resolveHydratedTheme(
  localTheme: ThemePreference | null,
  storedTheme: ThemePreference
) {
  return localTheme ?? storedTheme;
}

export function useThemePreference() {
  const theme = useStore((state) => state.settings.theme);
  const updateSettings = useStore((state) => state.updateSettings);
  const { setTheme } = useTheme();

  const applyTheme = useCallback((nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    updateSettings({ theme: nextTheme });
  }, [setTheme, updateSettings]);

  const selectTheme = useCallback((nextTheme: ThemePreference) => {
    localSelectionVersion += 1;
    applyTheme(nextTheme);
  }, [applyTheme]);

  return { theme, selectTheme, initializeTheme: applyTheme };
}
