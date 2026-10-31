import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { ThemedSelect } from "@/components/ThemedSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText } from "@/lib/errors";

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private — only me" },
  { value: "public", label: "Public — anyone with the link" },
];

function pictureCount(count: number) {
  return `${count} ${count === 1 ? "picture" : "pictures"}`;
}

export function ListsPage() {
  const prefs = useQuery(api.preferences.get);
  const signedIn = prefs?.signedIn === true;
  const lists = useQuery(api.lists.mine, signedIn ? {} : "skip");

  if (prefs === undefined) return <p className="m-0 text-sm text-muted-foreground">Loading…</p>;
  if (!signedIn) {
    return (
      <section className="grid max-w-md gap-3">
        <h1 className="m-0 text-2xl font-semibold">Lists</h1>
        <p className="m-0 text-sm text-muted-foreground">Sign in to make lists.</p>
        <a
          href="#/auth"
          className="inline-flex w-fit items-center rounded-[0.4rem] border border-border-strong bg-surface-soft px-[0.9rem] py-[0.55rem] text-[0.9rem] text-foreground no-underline hover:bg-selection"
        >
          Sign in
        </a>
      </section>
    );
  }

  return (
    <section className="grid max-w-[44rem] gap-4">
      <h1 className="m-0 text-2xl font-semibold">Lists</h1>
      <p className="m-0 text-sm text-muted-foreground">
        Private lists are only yours. A public list can be opened by anyone with the link.
      </p>
      <CreateList />
      {lists === undefined ? (
        <p className="m-0 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <YourLists lists={lists} />
      )}
    </section>
  );
}

function CreateList() {
  const create = useMutation(api.lists.create);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <>
      <form
        className="flex flex-col gap-3 min-[701px]:flex-row min-[701px]:flex-wrap min-[701px]:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          setPending(true);
          void create({ title, description, visibility })
            .then(() => {
              setTitle("");
              setDescription("");
              setVisibility("private");
            })
            .catch((caught) => setError(errorText(caught, "Could not create that list.")))
            .finally(() => setPending(false));
        }}
      >
        <Input
          required
          maxLength={80}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="New list title"
          aria-label="New list title"
          className="min-[701px]:w-56"
        />
        <Input
          maxLength={300}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description (optional)"
          aria-label="List description"
          className="min-[701px]:min-w-48 min-[701px]:flex-1"
        />
        <ThemedSelect
          label="Visibility"
          value={visibility}
          options={VISIBILITY_OPTIONS}
          onChange={setVisibility}
          className="max-[700px]:w-full"
        />
        <Button type="submit" disabled={pending}>
          Create list
        </Button>
      </form>
      {error && (
        <p className="m-0 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function YourLists({
  lists,
}: {
  lists: Array<{
    _id: string;
    title: string;
    description: string;
    visibility: "private" | "public";
    itemCount: number;
  }>;
}) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const shown = needle ? lists.filter((list) => list.title.toLowerCase().includes(needle)) : lists;

  return (
    <>
      {lists.length > 5 && (
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={`Filter ${lists.length} lists…`}
          aria-label="Filter your lists"
          className="max-w-xs"
        />
      )}
      {lists.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No lists yet.</p>
      ) : shown.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No list matches “{filter.trim()}”.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {shown.map((list) => (
            <li key={list._id}>
              <a
                href={`#/lists/${encodeURIComponent(list._id)}`}
                className="group grid min-w-0 gap-1 rounded-xl border border-border bg-surface p-3 no-underline"
              >
                <span className="font-semibold break-words text-foreground group-hover:text-accent">{list.title}</span>
                <span className="text-sm text-muted-foreground">
                  {list.visibility} · {pictureCount(list.itemCount)}
                </span>
                {list.description.trim() !== "" && (
                  <span className="line-clamp-2 text-sm text-muted-foreground">{list.description}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
