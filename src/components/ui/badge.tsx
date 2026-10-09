import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-px text-xs font-medium whitespace-nowrap tabular-nums",
    "transition-[color,background-color,border-color,box-shadow] duration-fast ease-diasnap",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/25",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&>svg]:pointer-events-none [&>svg]:size-3",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-accent",
        soft: "bg-muted text-foreground/75 [a&]:hover:bg-accent",
        success: "bg-success/12 text-success [a&]:hover:bg-success/18",
        warning: "bg-warning/12 text-warning [a&]:hover:bg-warning/18",
        info: "bg-info/12 text-info [a&]:hover:bg-info/18",
        gold: "bg-gold/16 text-gold-foreground [a&]:hover:bg-gold/24",
        destructive:
          "bg-destructive/12 text-destructive [a&]:hover:bg-destructive/18",
        outline:
          "border-border text-foreground/80 [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "text-muted-foreground [a&]:hover:bg-accent",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
      size: {
        default: "h-[1.125rem]",
        lg: "h-6 px-2.5 text-sm [&>svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }