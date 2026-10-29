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

const selectClass =
  "h-8 cursor-pointer rounded-md border border-border bg-surface px-2 text-[0.8rem] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AppearanceControls({
  theme,
  font,
  onChange,
  className,
}: {
  theme: ThemeId;
  font: FontId;
  onChange: (next: Partial<{ theme: ThemeId; font: FontId }>) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label className="flex min-w-0 items-center gap-1.5">
        <span
          className="size-2.5 shrink-0 rounded-full border border-border-strong"
          style={{ background: THEME_SWATCHES[theme] }}
          aria-hidden
        />
        <span className="sr-only">Theme</span>
        <select
          aria-label="Theme"
          value={theme}
          onChange={(event) => onChange({ theme: normalizeTheme(event.target.value) })}
          className={cn(selectClass, "max-w-[8.75rem] max-[700px]:max-w-[6.5rem]")}
        >
          {THEMES.map((id) => (
            <option key={id} value={id}>
              {THEME_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 items-center">
        <span className="sr-only">Font</span>
        <select
          aria-label="Font"
          value={font}
          onChange={(event) => onChange({ font: normalizeFont(event.target.value) })}
          className={cn(selectClass, "max-w-[12.5rem] max-[900px]:max-w-[8rem] max-[640px]:max-w-[5.75rem]")}
        >
          {FONTS.map((id) => (
            <option key={id} value={id}>
              {FONT_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
