import {
  CircleArrowUp,
  Compass,
  HardDriveDownload,
  Loader2,
  Moon,
  Package2,
  Search,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ViewKey } from '@/types'
import { cn } from '@/lib/utils'

interface TopBarProps {
  view: ViewKey
  onNavigate: (view: ViewKey) => void
  updatesCount: number
  runningTasks: number
  dark: boolean
  onToggleTheme: () => void
  onOpenPalette: () => void
}

type NavIcon = typeof Compass

const NAV: { key: ViewKey; label: string; icon: NavIcon }[] = [
  { key: 'discover', label: '发现', icon: Compass },
  { key: 'installed', label: '已安装', icon: HardDriveDownload },
  { key: 'updates', label: '更新', icon: CircleArrowUp },
]

/**
 * 应用外壳顶栏：品牌块 + 胶囊分段导航 + 右侧动作。
 *
 * 结构约定（与工具行/状态条同属一套外壳语法）：
 *  · 轨道凹陷（bg-muted）、选中项浮起（surface-2 + s1 + ring）——导航靠它定位；
 *  · 金黄只出现在"可更新"这个高价值计数上：未选中是浅金环提示，选中才是实心金；
 *  · 一切加载类指示器都带 motion-required，减弱动效的用户仍能看到"还在跑"。
 */
export function TopBar({
  view,
  onNavigate,
  updatesCount,
  runningTasks,
  dark,
  onToggleTheme,
  onOpenPalette,
}: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-1 px-3">
      {/* 品牌块：点击呼出命令栏 */}
      <button
        type="button"
        onClick={onOpenPalette}
        title="搜索与命令 (Ctrl+K)"
        className="focus-ring group flex cursor-pointer items-center gap-2.5 rounded-full py-1 pr-2 pl-1.5 transition-colors duration-fast ease-diasnap hover:bg-surface-3"
      >
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-linear-to-br from-primary to-chart-5 text-primary-foreground shadow-s1 ring-1 ring-white/20 ring-inset dark:ring-white/10">
          <Package2 className="size-4.5" strokeWidth={2.25} />
          {/* 运行中任务：呼吸点 */}
          {runningTasks > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
              <span className="motion-required absolute inset-0 animate-ping rounded-full bg-success/75" />
              <span className="relative m-auto size-2 rounded-full bg-success ring-2 ring-surface-1" />
            </span>
          )}
        </span>
        <span className="hidden items-baseline gap-1.5 sm:flex">
          <span className="text-sm font-semibold tracking-tight">Winget</span>
          <span className="text-2xs text-foreground-subtle">包管理器</span>
        </span>
      </button>

      {/* 胶囊分段导航：轨道凹陷 + 选中项浮起 */}
      <nav className="flex items-center gap-0.5 rounded-full bg-muted p-1 shadow-well">
        {NAV.map(({ key, label, icon: Icon }) => {
          const active = view === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-ring relative flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
                'transition-[color,background-color,box-shadow,transform] duration-base ease-diasnap',
                'active:scale-[0.98] motion-reduce:active:scale-100',
                active
                  ? 'bg-surface-2 text-foreground shadow-s1 ring-1 ring-border ring-inset'
                  : 'text-muted-foreground hover:bg-surface-3/70 hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'size-3.5 transition-colors duration-base ease-diasnap',
                  active ? 'text-primary' : 'text-foreground-subtle'
                )}
                strokeWidth={2.1}
              />
              {label}
              {key === 'updates' && updatesCount > 0 && (
                <span
                  className={cn(
                    'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-2xs leading-none font-semibold tabular-nums',
                    'transition-[color,background-color,box-shadow] duration-base ease-diasnap',
                    active
                      ? 'bg-gold text-gold-foreground'
                      : 'bg-gold/20 text-foreground ring-1 ring-gold/45 ring-inset'
                  )}
                >
                  {updatesCount > 99 ? '99+' : updatesCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* 右侧动作 */}
      <div className="ml-auto flex items-center gap-1.5">
        {runningTasks > 0 && (
          <span className="mr-0.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-success/12 px-2.5 text-xs font-medium text-success ring-1 ring-success/25 ring-inset">
            <Loader2 className="motion-required size-3.5 animate-spin" />
            <span className="tabular-nums">{runningTasks}</span>
            个任务运行中
          </span>
        )}

        {/* 命令栏入口：键盘优先的显性入口 */}
        <button
          type="button"
          onClick={onOpenPalette}
          title="搜索与命令 (Ctrl+K)"
          className="focus-ring hidden h-7 cursor-pointer items-center gap-1.5 rounded-full bg-surface-2 pr-1.5 pl-2.5 text-xs text-muted-foreground shadow-well ring-1 ring-border ring-inset transition-colors duration-fast ease-diasnap hover:bg-surface-3 hover:text-foreground md:inline-flex"
        >
          <Search className="size-3.5" />
          <span className="whitespace-nowrap">搜索与命令</span>
          <kbd className="rounded-xs border border-border bg-background px-1 font-mono text-2xs text-foreground-subtle">
            Ctrl K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleTheme}
          title={dark ? '切换到浅色模式' : '切换到深色模式'}
          aria-label={dark ? '切换到浅色模式' : '切换到深色模式'}
          className="size-8 rounded-full text-muted-foreground hover:text-foreground"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  )
}
