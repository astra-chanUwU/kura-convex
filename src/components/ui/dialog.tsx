import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface p-5 outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogPrimitive.Title className="m-0 text-xl font-semibold">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 mb-0 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-surface-soft hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
