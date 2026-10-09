import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-input/15 px-3 py-1 text-sm transition-[color,background-color,border-color,box-shadow] duration-fast ease-diasnap outline-none",
        "shadow-well placeholder:text-foreground-subtle selection:bg-primary selection:text-primary-foreground",
        "focus-ring-soft",
        "aria-invalid:border-destructive aria-invalid:shadow-danger",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
        "md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }