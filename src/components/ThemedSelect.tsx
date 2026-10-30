import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import styles from "./ThemedSelect.module.css";

export type ThemedOption = {
  value: string;
  label: string;
  swatch?: string;
};

export function ThemedSelect({
  label,
  value,
  options,
  onChange,
  full,
  menuAlign = "start",
  className,
}: {
  label: string;
  value: string;
  options: ThemedOption[];
  onChange: (value: string) => void;
  full?: boolean;
  menuAlign?: "start" | "end";
  className?: string;
}) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options.find((option) => option.value === value) ?? options[0];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const typeState = useRef({ buf: "", timer: 0 });

  useEffect(() => () => window.clearTimeout(typeState.current.timer), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function openList() {
    setActive(selectedIndex);
    typeState.current.buf = "";
    setOpen(true);
  }

  function select(next: string) {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function typeahead(ch: string) {
    const state = typeState.current;
    window.clearTimeout(state.timer);
    state.buf = (state.buf + ch).toLowerCase();
    state.timer = window.setTimeout(() => {
      state.buf = "";
    }, 500);
    const index = options.findIndex((option) => option.label.toLowerCase().startsWith(state.buf));
    if (index < 0) return;
    if (open) setActive(index);
    else {
      const match = options[index];
      if (match) select(match.value);
    }
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        if (!open) openList();
        else if (options[active]) select(options[active].value);
        break;
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else if (options.length > 0) setActive((index) => (index + 1) % options.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else if (options.length > 0) setActive((index) => (index - 1 + options.length) % options.length);
        break;
      case "Home":
        if (open && options.length > 0) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open && options.length > 0) {
          event.preventDefault();
          setActive(options.length - 1);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        if (open) setOpen(false);
        break;
      default:
        if (event.key.length === 1) typeahead(event.key);
        break;
    }
  }

  return (
    <div
      ref={wrapRef}
      className={cn(styles.wrap, full && styles.full, className)}
      onBlur={(event) => {
        if (open && (!event.relatedTarget || !wrapRef.current?.contains(event.relatedTarget as Node))) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKeyDown}
      >
        {selected?.swatch ? (
          <span className={styles.swatch} style={{ "--swatch": selected.swatch } as CSSProperties} aria-hidden />
        ) : null}
        <span className={styles.label}>{selected?.label ?? ""}</span>
        <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="m6 9.5 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <ul id={listId} role="listbox" aria-label={label} className={cn(styles.menu, menuAlign === "end" && styles.menuEnd)}>
          {options.map((option, index) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                tabIndex={-1}
                className={cn(styles.option, index === active && styles.active)}
                onClick={() => select(option.value)}
                onMouseEnter={() => setActive(index)}
              >
                {option.swatch ? (
                  <span className={styles.swatch} style={{ "--swatch": option.swatch } as CSSProperties} aria-hidden />
                ) : null}
                <span className={styles.optionLabel}>{option.label}</span>
                <svg className={styles.check} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m5 12.5 5 5 9-11" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
