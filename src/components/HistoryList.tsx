import { Undo2 } from "lucide-react";
import { useState } from "react";
import { diffStates, type DiffLine } from "../../shared/historyDiff";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/errors";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  "post.created": "Uploaded",
  "post.updated": "Edited",
  "post.removed": "Removed",
  rollback: "Rolled back",
};

export type ChangeView = {
  entityId: string;
  actorName: string;
  action: string;
  before: {
    artist: string;
    caption: string;
    source: string;
    tags: string[];
    rating: string;
    removed: boolean;
  };
  after: ChangeView["before"];
  rollbackOf: string | null;
  createdAt: number;
  storageKey: string | null;
  thumbKey: string | null;
};

function formatWhen(ms: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
}

function actionClass(action: string) {
  if (action === "post.removed") return "text-danger";
  if (action === "rollback") return "text-accent";
  return "text-foreground";
}

function lineClass(kind: DiffLine["kind"]) {
  if (kind === "added") return "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success";
  if (kind === "removed") return "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger";
  return "text-muted-foreground";
}

function signFor(kind: DiffLine["kind"]) {
  if (kind === "added") return "+";
  if (kind === "removed") return "−";
  return "·";
}

function previewLabel(entry: ChangeView) {
  const rating = entry.after.rating !== "safe" ? entry.after.rating : entry.before.rating;
  if (!entry.storageKey && rating !== "safe") return "Sensitive";
  return "No preview";
}

function HistoryThumb({ entry }: { entry: ChangeView }) {
  const [failed, setFailed] = useState(false);
  const key = entry.thumbKey || entry.storageKey;
  if (!key || failed) {
    return (
      <span className="grid h-full place-items-center px-0.5 text-center text-[0.5rem] leading-tight font-semibold tracking-wide text-muted-foreground uppercase sm:px-1 sm:text-[0.65rem]">
        {previewLabel(entry)}
      </span>
    );
  }
  return (
    <img
      src={imageUrl(key)}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function HistoryList<Id extends string>({
  entries,
  allowRollback,
  onRollback,
  showPostLink,
  showThumb,
}: {
  entries: Array<ChangeView & { _id: Id }>;
  allowRollback: boolean;
  onRollback: (id: Id) => Promise<void>;
  showPostLink?: boolean;
  showThumb?: boolean;
}) {
  const [confirmId, setConfirmId] = useState<Id | null>(null);
  const [busyId, setBusyId] = useState<Id | null>(null);
  const [error, setError] = useState("");

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong px-4 py-10 text-center text-sm text-muted-foreground">
        No changes recorded yet. Edits and removals show up here as a diff.
      </div>
    );
  }

  async function rollBack(id: Id) {
    setError("");
    setBusyId(id);
    try {
      await onRollback(id);
      setConfirmId(null);
    } catch (caught) {
      setError(errorText(caught, "Could not roll that back."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono font-semibold text-danger">−</span> removed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono font-semibold text-success">+</span> added
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-muted-foreground">·</span> unchanged
        </span>
      </p>
      <ol className="m-0 grid list-none gap-3 p-0">
        {entries.map((entry) => {
          const lines = diffStates(entry.before, entry.after);
          const canRoll = allowRollback && entry.action !== "post.created";
          const confirming = confirmId === entry._id;
          const busy = busyId === entry._id;
          return (
            <li key={entry._id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div
                className={cn(
                  "grid gap-3 p-3 sm:gap-4 sm:p-4",
                  showThumb && "sm:grid-cols-[5.5rem_minmax(0,1fr)]",
                )}
              >
                {showThumb && (
                  <a
                    href={`#/posts/${entry.entityId}`}
                    target="_blank"
                    rel="noopener"
                    className="hidden aspect-square overflow-hidden rounded-lg border border-border bg-background sm:block"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <HistoryThumb entry={entry} />
                  </a>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:items-baseline">
                    {showThumb && (
                      <a
                        href={`#/posts/${entry.entityId}`}
                        target="_blank"
                        rel="noopener"
                        className="block size-11 shrink-0 overflow-hidden rounded-md border border-border bg-background sm:hidden"
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <HistoryThumb entry={entry} />
                      </a>
                    )}
                    <span className={cn("font-semibold", actionClass(entry.action))}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {entry.actorName} · {formatWhen(entry.createdAt)}
                    </span>
                    {showPostLink && (
                      <a
                        href={`#/posts/${entry.entityId}`}
                        target="_blank"
                        rel="noopener"
                        className="text-sm text-accent no-underline"
                      >
                        View post
                      </a>
                    )}
                    {canRoll && !confirming && (
                      <Button
                        variant="outline"
                        className="ml-auto h-8 rounded-full border-accent px-3 text-accent"
                        disabled={busy}
                        onClick={() => {
                          setError("");
                          setConfirmId(entry._id);
                        }}
                      >
                        <Undo2 />
                        Roll back
                      </Button>
                    )}
                  </div>
                  {confirming && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
                      <p className="m-0 mr-auto text-sm">Restore the earlier version?</p>
                      <Button variant="ghost" className="h-8 px-2.5" disabled={busy} onClick={() => setConfirmId(null)}>
                        Cancel
                      </Button>
                      <Button variant="accent" className="h-8 px-3" disabled={busy} onClick={() => void rollBack(entry._id)}>
                        <Undo2 />
                        {busy ? "Rolling back…" : "Roll back"}
                      </Button>
                    </div>
                  )}
                  <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background">
                    <ol className="m-0 list-none p-1 font-mono text-[0.8125rem] leading-5" aria-label="What changed">
                      {lines.length === 0 ? (
                        <li className="px-2 py-1 text-muted-foreground">No visible difference</li>
                      ) : (
                        lines.map((line, index) => (
                          <li
                            key={`${line.field}-${line.kind}-${index}`}
                            data-kind={line.kind}
                            className={cn(
                              "grid grid-cols-[1.35rem_minmax(0,1fr)] rounded-sm",
                              lineClass(line.kind),
                            )}
                          >
                            <span className="border-r border-border/80 py-0.5 text-center font-semibold" aria-hidden="true">
                              {signFor(line.kind)}
                            </span>
                            <span className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 px-2 py-0.5 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-x-3">
                              <span>{line.field}</span>
                              <span className={cn("break-words", line.kind === "removed" && "line-through decoration-current/70")}>
                                {line.value}
                                <span className="sr-only">
                                  {line.kind === "unchanged" ? "" : `, ${line.kind}`}
                                </span>
                              </span>
                            </span>
                          </li>
                        ))
                      )}
                    </ol>
                  </div>
                  {entry.rollbackOf && <p className="mt-2 mb-0 text-xs text-muted-foreground">Restores an earlier version.</p>}
                  {error && confirming && (
                    <p className="mt-2 mb-0 text-sm text-danger" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
