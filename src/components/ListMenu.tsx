import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ThemedSelect } from "@/components/ThemedSelect";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { errorText } from "@/lib/errors";

const visibilityOptions = [
  { value: "private", label: "Private" },
  { value: "public", label: "Public" },
];

const triggerClass =
  "pointer-events-auto shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface px-2 py-1 align-middle text-[0.8rem] text-foreground";

let dismissStatus: (() => void) | null = null;
let closeOpenMenu: (() => void) | null = null;

function showStatus(setText: (value: string) => void, text: string) {
  dismissStatus?.();
  setText(text);
  const timer = window.setTimeout(() => {
    setText("");
    dismissStatus = null;
  }, 2500);
  dismissStatus = () => {
    window.clearTimeout(timer);
    setText("");
    dismissStatus = null;
  };
}

function claimMenu(closeThis: () => void) {
  if (closeOpenMenu && closeOpenMenu !== closeThis) closeOpenMenu();
  closeOpenMenu = closeThis;
}

function releaseMenu(closeThis: () => void) {
  if (closeOpenMenu === closeThis) closeOpenMenu = null;
}

export function ListMenu({ postId }: { postId: Id<"posts"> }) {
  const session = authClient.useSession();
  const signedIn = Boolean(session.data?.user);
  const lists = useQuery(api.lists.mine, signedIn ? {} : "skip");
  const create = useMutation(api.lists.create);
  const add = useMutation(api.lists.add);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<null | "add" | "create">(null);
  const [status, setStatus] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [sendToAuth, setSendToAuth] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const pendingFocus = useRef(false);
  const menuId = useId();

  useEffect(() => {
    if (sendToAuth) window.location.hash = "#/auth";
  }, [sendToAuth]);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setFilter("");
    setShowForm(false);
    setName("");
    setVisibility("private");
    setError("");
    setCoords(null);
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeThis = () => close(false);
    claimMenu(closeThis);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close(true);
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      close(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      releaseMenu(closeThis);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    function place() {
      const button = buttonRef.current;
      const node = menuRef.current;
      if (!button || !node) return;
      const rect = button.getBoundingClientRect();
      const height = node.offsetHeight;
      const width = node.offsetWidth;
      const gap = 6;
      const margin = 8;
      let top = Math.round(rect.bottom + gap);
      if (top + height > window.innerHeight - margin) {
        const above = Math.round(rect.top - gap - height);
        top = above >= margin ? above : Math.max(margin, Math.round(window.innerHeight - margin - height));
      }
      let left = Math.round(rect.left);
      if (left + width > window.innerWidth - margin) left = Math.round(window.innerWidth - margin - width);
      if (left < margin) left = margin;
      setCoords((current) => (current && current.top === top && current.left === left ? current : { top, left }));
    }
    place();
    const observer = new ResizeObserver(place);
    observer.observe(menu);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, filter, showForm, error, lists, pending]);

  useEffect(() => {
    if (!open || !coords || !pendingFocus.current) return;
    pendingFocus.current = false;
    menuRef.current?.focus({ preventScroll: true });
  }, [open, coords]);

  function reject(caught: unknown) {
    const text = errorText(caught, "Could not add that picture.");
    if (text === "Sign in to do that.") {
      setSendToAuth(true);
      return;
    }
    setError(text);
  }

  async function addTo(list: { _id: Id<"lists">; title: string }) {
    if (busy.current) return;
    busy.current = true;
    setPending("add");
    setError("");
    try {
      const result = await add({ listId: list._id, postId });
      showStatus(setStatus, result.added ? `Added to “${list.title}”` : `Already in “${list.title}”`);
      close(true);
    } catch (caught) {
      reject(caught);
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function createAndAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending("create");
    setError("");
    try {
      const created = await create({ title: name, description: "", visibility });
      await add({ listId: created._id, postId });
      showStatus(setStatus, `Created “${created.title}” and added this picture.`);
      close(true);
    } catch (caught) {
      reject(caught);
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  const canFilter = lists !== undefined && lists.length > 5;
  const query = canFilter ? filter.trim().toLowerCase() : "";
  const matches = (lists ?? []).filter((list) => list.title.toLowerCase().includes(query));
  const shown = matches.slice(0, 5);
  const extra = matches.length - shown.length;

  const menu = (
    <div
      ref={menuRef}
      id={menuId}
      role="dialog"
      aria-label="Add to a list"
      tabIndex={-1}
      className="fixed z-50 w-64 max-w-[calc(100vw-1rem)] rounded-md border border-border-strong bg-surface p-2 text-sm text-foreground shadow-lg outline-none"
      style={{ top: coords?.top ?? 0, left: coords?.left ?? 0, visibility: coords ? "visible" : "hidden" }}
    >
      <div className="grid gap-1">
        {canFilter && (
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Filter ${lists.length} lists…`}
            aria-label="Filter lists"
            autoComplete="off"
            className="py-1 text-[0.8rem]"
          />
        )}
        {lists === undefined && <p className="m-0 px-2 py-1 text-muted-foreground">Loading…</p>}
        {lists !== undefined && lists.length === 0 && (
          <p className="m-0 px-2 py-1 text-muted-foreground">No lists yet — make your first below.</p>
        )}
        {lists !== undefined && lists.length > 0 && matches.length === 0 && (
          <p className="m-0 px-2 py-1 text-muted-foreground">No list matches “{filter.trim()}”.</p>
        )}
        {shown.length > 0 && (
          <div className="grid gap-0.5">
            {shown.map((list) => (
              <button
                key={list._id}
                type="button"
                disabled={pending !== null}
                className="w-full cursor-pointer rounded-md px-2 py-1 text-left break-words hover:bg-selection disabled:cursor-default disabled:opacity-40"
                onClick={() => void addTo(list)}
              >
                {list.title} ({list.visibility})
              </button>
            ))}
          </div>
        )}
        {extra > 0 && (
          <p className="m-0 px-2 py-1 text-muted-foreground">
            {extra} more — filter above or manage lists from{" "}
            <a href="#/lists" className="text-accent no-underline hover:underline" onClick={() => close(false)}>
              Lists
            </a>
            .
          </p>
        )}
        {error && (
          <p className="m-0 px-2 py-1 text-danger" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          aria-expanded={showForm}
          className="w-full cursor-pointer rounded-md px-2 py-1 text-left text-accent hover:bg-selection"
          onClick={() => setShowForm((value) => !value)}
        >
          + New list…
        </button>
        {showForm && (
          <form className="grid gap-1.5" onSubmit={(event) => void createAndAdd(event)}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              aria-label="New list name"
              placeholder="New list name…"
              autoComplete="off"
              className="py-1 text-[0.8rem]"
            />
            <ThemedSelect
              label="New list visibility"
              value={visibility}
              full
              options={visibilityOptions}
              onChange={setVisibility}
            />
            <button
              type="submit"
              disabled={pending !== null}
              className="w-full cursor-pointer rounded-md border border-border-strong bg-surface-soft px-2 py-1 text-left text-[0.8rem] hover:bg-selection disabled:cursor-default disabled:opacity-40"
            >
              {pending === "create" ? "Creating…" : "Create & add"}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={menuId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!session.data?.user) {
            window.location.hash = "#/auth";
            return;
          }
          setOpen((value) => {
            const next = !value;
            if (next) pendingFocus.current = true;
            return next;
          });
        }}
      >
        + List
      </button>
      {open && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
      {status && typeof document !== "undefined"
        ? createPortal(
            <p
              role="status"
              className="pointer-events-none fixed bottom-4 left-1/2 z-[60] m-0 max-w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-center text-sm break-words text-foreground shadow-lg"
            >
              {status}
            </p>,
            document.body,
          )
        : null}
    </>
  );
}
