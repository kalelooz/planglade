"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { useHasHydrated, useStore } from "@/lib/store";

export function AppSettingsBridge() {
  const hydrated = useHasHydrated();
  const settings = useStore((s) => s.settings);
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!hydrated) return;
    setTheme(settings.theme);
  }, [hydrated, settings.theme, setTheme]);

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
