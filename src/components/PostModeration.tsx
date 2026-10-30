import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { Component, type ReactNode, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/errors";

export function PostModeration({ id, back }: { id: string; back: string }) {
  return (
    <QuietBoundary>
      <ModerationBody id={id as Id<"posts">} back={back} />
    </QuietBoundary>
  );
}

function ModerationBody({ id, back }: { id: Id<"posts">; back: string }) {
  const post = useQuery(api.posts.get, { id });
  const remove = useMutation(api.posts.remove);
  const [error, setError] = useState("");
  if (!post || post.mine || !post.canRemove || post.removed) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        onClick={() => {
          if (!window.confirm("Remove this picture from the board? You can roll it back from history.")) return;
          setError("");
          void remove({ postId: post._id })
            .then(() => {
              window.location.hash = back;
            })
            .catch((caught) => setError(errorText(caught, "Could not remove that picture.")));
        }}
      >
        <Trash2 className="size-4" />
        Remove
      </Button>
      {error && <p className="m-0 text-sm text-danger">{error}</p>}
    </div>
  );
}

class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
