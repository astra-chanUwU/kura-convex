import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex w-fit cursor-pointer items-center justify-center gap-2 rounded-[0.4rem] border text-[0.9rem] whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "border-border-strong bg-surface-soft text-foreground hover:bg-selection",
        accent: "border-accent bg-accent font-semibold text-accent-foreground hover:brightness-105",
        outline: "border-border-strong bg-surface text-foreground hover:bg-surface-soft",
        ghost: "border-transparent text-muted-foreground hover:bg-surface-soft hover:text-foreground",
      },
      size: {
        default: "px-[0.9rem] py-[0.55rem]",
        icon: "size-8 rounded-[0.35rem] p-0",
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
