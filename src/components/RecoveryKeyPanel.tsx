import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RecoveryKeyPanel({ recoveryKey, onDone }: { recoveryKey: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="m-0 text-lg font-semibold">Save this recovery key</h2>
      <p className="m-0 text-sm text-muted-foreground">
        This is the only time it is shown. It is the way back in if you lose your password and passkeys.
      </p>
      <p className="m-0 font-mono text-sm break-all">{recoveryKey}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(recoveryKey).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" variant="accent" onClick={onDone}>
          I saved it
        </Button>
      </div>
    </div>
  );
}
