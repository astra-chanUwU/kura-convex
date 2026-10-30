import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { HistoryList } from "@/components/HistoryList";
import { canModerate } from "../../shared/roles";
import { cn } from "@/lib/utils";

export function HistoryPage() {
  const prefs = useQuery(api.preferences.get);
  const staff = prefs?.signedIn === true && canModerate(prefs.role);
  const [actorId, setActorId] = useState("");
  const [notice, setNotice] = useState("");
  const entries = useQuery(api.history.recent, staff ? { actorId: actorId || undefined } : "skip");
  const actors = useQuery(api.history.actors, staff ? {} : "skip");
  const rollback = useMutation(api.history.rollback);

  if (prefs === undefined) return <p className="text-sm text-muted-foreground">Loading history…</p>;
  if (!prefs.signedIn) {
    return (
      <section className="grid max-w-md gap-3">
        <h1 className="m-0 text-2xl font-semibold">History</h1>
        <p className="m-0 text-sm text-muted-foreground">Sign in with a moderator account to read the change log.</p>
        <a
          href="#/auth"
          className="inline-flex h-9 w-fit items-center rounded-md border border-border-strong bg-surface-soft px-3.5 text-sm text-foreground no-underline hover:bg-selection"
        >
          Sign in
        </a>
      </section>
    );
  }
  if (!staff) {
    return (
      <section className="grid max-w-md gap-3">
        <h1 className="m-0 text-2xl font-semibold">History</h1>
        <p className="m-0 text-sm text-muted-foreground">
          The change log is for moderators and the owner. Picture edits you make still show on that picture.
        </p>
      </section>
    );
  }

  return (
    <section className="grid max-w-[48rem] gap-5">
      <div className="grid gap-2">
        <h1 className="m-0 text-2xl font-semibold">History</h1>
        <p className="m-0 max-w-2xl text-sm text-muted-foreground">
          Every edit and removal on the board, newest first. Roll back restores the earlier version. The rollback is
          recorded too, so the log stays complete.
        </p>
      </div>
      {actors && actors.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by person">
          <FilterChip active={actorId === ""} onClick={() => setActorId("")}>
            Everyone
          </FilterChip>
          {actors.map((actor) => (
            <FilterChip key={actor.id} active={actorId === actor.id} onClick={() => setActorId(actor.id)}>
              {actor.name}
            </FilterChip>
          ))}
        </div>
      )}
      {actorId && (
        <p className="m-0 text-sm text-muted-foreground">Roll back each row to undo this person’s changes.</p>
      )}
      {notice && (
        <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}
      {entries === undefined ? (
        <p className="m-0 text-sm text-muted-foreground">Loading history…</p>
      ) : (
        <HistoryList
          entries={entries}
          allowRollback
          showThumb
          showPostLink
          onRollback={async (changeId) => {
            await rollback({ changeId });
            setNotice("Rolled back. That rollback is now in the history.");
          }}
        />
      )}
      {entries && entries.length >= 80 && (
        <p className="m-0 text-xs text-muted-foreground">Showing the latest 80.</p>
      )}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1 text-sm",
        active
          ? "border-accent bg-selection text-foreground"
          : "border-border-strong bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
