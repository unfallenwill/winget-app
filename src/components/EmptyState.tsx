import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** 键位帽：引导态用来把"键盘优先"的骨架讲清楚 */
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-xs border border-border',
        'bg-surface-2 px-1 font-mono text-2xs leading-none text-muted-foreground'
      )}
    >
      {children}
    </kbd>
  )
}

/**
 * 空状态：加载失败 / 无结果 / 未搜索的引导态共用。
 * 默认呈现中性卡片；调用方可用 className 上的任意变体区分场景：
 *   - 破坏性：`[&_[data-slot=empty-icon]]:text-destructive!`
 *   - 引导性：`[&_[data-slot=empty-hint]]:flex`（打开键位提示条）
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-full w-full items-center justify-center px-4 py-10',
        className
      )}
    >
      <div
        className={cn(
          'relative flex w-full max-w-[26rem] flex-col items-center gap-4 overflow-hidden',
          'rounded-2xl border border-border/80 bg-card/70 px-7 py-8 text-center shadow-s1'
        )}
      >
        {/* 暖纸光晕 + 顶部主色渐隐细线：让空卡片不显得像一块空白 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 size-48 -translate-x-1/2 rounded-full bg-primary/[0.08] blur-2xl"
        />
        <div
          aria-hidden
          className="absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent"
        />

        <div
          data-slot="empty-icon"
          className={cn(
            'relative flex size-12 items-center justify-center rounded-xl',
            'border border-primary/15 bg-primary/[0.09] text-primary shadow-s1'
          )}
        >
          <Icon className="size-[1.375rem]" />
        </div>

        <div className="relative space-y-1.5">
          <p className="text-lg font-semibold leading-snug tracking-tight text-foreground">
            {title}
          </p>
          {description && (
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {/* 引导性：键位提示，默认隐藏，由调用方 className 打开 */}
        <div
          data-slot="empty-hint"
          className="relative hidden items-center gap-1.5 pt-1 text-2xs text-muted-foreground"
        >
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>移动</span>
          <span className="text-border-strong">·</span>
          <Kbd>↵</Kbd>
          <span>打开</span>
        </div>

        {action && (
          <div className="relative flex w-full flex-wrap items-center justify-center gap-2">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
