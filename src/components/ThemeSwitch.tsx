import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { id: "light", label: "Switch to light theme", icon: Sun },
  { id: "system", label: "Use system theme", icon: Monitor },
  { id: "dark", label: "Switch to dark theme", icon: Moon },
] as const;

export function ThemeSwitch({
  value,
  onChange,
}: {
  value: "light" | "dark" | "system";
  onChange: (value: "light" | "dark" | "system") => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border-strong bg-surface p-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              "grid size-7 cursor-pointer place-items-center rounded-sm",
              selected ? "bg-surface-soft text-accent" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
