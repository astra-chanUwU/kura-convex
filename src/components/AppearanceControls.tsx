import { ThemedSelect } from "@/components/ThemedSelect";
import {
  FONT_LABELS,
  FONTS,
  THEME_LABELS,
  THEME_SWATCHES,
  THEMES,
  normalizeFont,
  normalizeTheme,
  type FontId,
  type ThemeId,
} from "@/lib/appearance";
import { cn } from "@/lib/utils";
import styles from "./ThemedSelect.module.css";

export function AppearanceControls({
  theme,
  font,
  onChange,
  layout = "inline",
  className,
}: {
  theme: ThemeId;
  font: FontId;
  onChange: (next: Partial<{ theme: ThemeId; font: FontId }>) => void;
  layout?: "inline" | "stacked";
  className?: string;
}) {
  const stacked = layout === "stacked";
  const themes = THEMES.map((id) => ({ value: id, label: THEME_LABELS[id], swatch: THEME_SWATCHES[id] }));
  const fonts = FONTS.map((id) => ({ value: id, label: FONT_LABELS[id] }));
  return (
    <div className={cn(stacked ? "grid gap-3" : "flex min-w-0 items-center gap-2", className)}>
      <label className={stacked ? "grid gap-1 text-[0.85rem] text-muted-foreground" : "contents"}>
        {stacked ? "Theme" : <span className="sr-only">Theme</span>}
        <ThemedSelect
          label="Theme"
          value={theme}
          full={stacked}
          className={stacked ? undefined : styles.compact}
          options={themes}
          onChange={(id) => onChange({ theme: normalizeTheme(id) })}
        />
      </label>
      <label className={stacked ? "grid gap-1 text-[0.85rem] text-muted-foreground" : "max-[640px]:hidden"}>
        {stacked ? "Font" : <span className="sr-only">Font</span>}
        <ThemedSelect
          label="Font"
          value={font}
          full={stacked}
          menuAlign={stacked ? "start" : "end"}
          className={stacked ? undefined : styles.compactFont}
          options={fonts}
          onChange={(id) => onChange({ font: normalizeFont(id) })}
        />
      </label>
    </div>
  );
}
