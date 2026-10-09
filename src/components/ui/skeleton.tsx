import * as React from "react"
import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // 扫光动画挂在 ::before 上，故 motion-required 必须加在宿主元素，
        // 由 index.css 的 `*:not(.motion-required)::before` 让它在减弱动效下存活——
        // 否则用户会看到静止的灰块，分不清是加载中还是已加载。
        "motion-required relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-y-0 before:left-0 before:w-full before:from-transparent before:via-foreground/[0.07] before:to-transparent before:bg-linear-to-r before:animate-shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }