import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_FONT,
  DEFAULT_THEME,
  normalizeFont,
  normalizeTheme,
  type FontId,
  type ThemeId,
} from "@/lib/appearance";

export function applyAppearance(theme: ThemeId, font: FontId) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.font = font;
  try {
    localStorage.setItem("kura-theme", theme);
    localStorage.setItem("kura-font", font);
  } catch {
    // Private mode still keeps the in-page appearance.
  }
}

function storedAppearance(): { theme: ThemeId; font: FontId } {
  try {
    return {
      theme: normalizeTheme(localStorage.getItem("kura-theme")),
      font: normalizeFont(localStorage.getItem("kura-font")),
    };
  } catch {
    return { theme: DEFAULT_THEME, font: DEFAULT_FONT };
  }
}

/**
 * Anonymous choices stay in localStorage. A signed-in account follows the
 * saved preference until the viewer picks again, which is written back.
 */
export function useAppearance(
  serverTheme: unknown,
  serverFont: unknown,
  signedIn: boolean,
  persist: (theme: ThemeId, font: FontId) => void,
) {
  const [stored] = useState(storedAppearance);
  const [override, setOverride] = useState<{ theme: ThemeId; font: FontId } | null>(null);
  const theme = normalizeTheme(serverTheme);
  const font = normalizeFont(serverFont);
  const serverKey = `${theme}:${font}`;
  const [seenServer, setSeenServer] = useState(serverKey);
  const appearance = override ?? (signedIn ? { theme, font } : stored);

  useEffect(() => {
    applyAppearance(appearance.theme, appearance.font);
  }, [appearance.theme, appearance.font]);

  useEffect(() => {
    if (!signedIn || seenServer === serverKey) return;
    setSeenServer(serverKey);
    setOverride(null);
  }, [signedIn, seenServer, serverKey]);

  const change = useCallback(
    (next: Partial<{ theme: ThemeId; font: FontId }>) => {
      const base = override ?? (signedIn ? { theme, font } : stored);
      const value = { ...base, ...next };
      setOverride(value);
      if (signedIn) persist(value.theme, value.font);
    },
    [override, signedIn, persist, theme, font, stored],
  );

  return { ...appearance, change };
}
