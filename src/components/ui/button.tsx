import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "border border-border-strong bg-surface-soft text-foreground hover:bg-selection",
        accent: "border border-accent bg-accent font-semibold text-accent-foreground hover:brightness-110",
        outline: "border border-border-strong bg-surface text-foreground hover:bg-surface-soft",
        ghost: "text-muted-foreground hover:bg-surface-soft hover:text-foreground",
      },
      size: {
        default: "h-9 px-3.5",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
