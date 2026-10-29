import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "h-9 rounded-lg bg-primary px-4 text-primary-foreground shadow-sm hover:brightness-110",
        pill: "h-9 rounded-full bg-foreground/10 px-5 text-foreground/90 shadow-sm hover:bg-foreground/15",
        outline:
          "h-8 rounded-full border border-foreground/15 bg-transparent px-3 text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
        ghost: "h-8 rounded-md bg-transparent px-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      },
      size: {
        default: "",
        icon: "size-8 p-0",
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
