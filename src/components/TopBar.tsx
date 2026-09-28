import { Moon, Package2, Sun } from 'lucide-react'
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

const NAV: { key: ViewKey; label: string }[] = [
  { key: 'discover', label: '发现' },
  { key: 'installed', label: '已安装' },
  { key: 'updates', label: '更新' },
]

/** Dia/Raycast 式顶栏：logo + 胶囊分段导航 + 右侧动作 */
export function TopBar({ view, onNavigate, updatesCount, runningTasks, dark, onToggleTheme, onOpenPalette }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      {/* Logo：点击呼出命令栏 */}
      <button
        type="button"
        onClick={onOpenPalette}
        title="搜索与命令 (Ctrl+K)"
        className="flex cursor-pointer items-center gap-2.5 rounded-full py-1 pr-3 pl-1 transition-colors hover:bg-accent"
      >
        <span className="relative flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
          <Package2 className="size-4.5" />
          {runningTasks > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-chart-3 ring-2 ring-background" />
          )}
        </span>
        <span className="hidden text-sm font-semibold tracking-tight whitespace-nowrap sm:inline">Winget</span>
      </button>

      {/* 胶囊分段导航 */}
      <nav className="flex items-center gap-0.5 rounded-full bg-secondary/70 p-1">
        {NAV.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            className={cn(
              'relative flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all',
              view === key
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
            {key === 'updates' && updatesCount > 0 && (
              <span
                className={cn(
                  'inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                  view === key ? 'bg-gold text-gold-foreground' : 'bg-gold/90 text-gold-foreground'
                )}
              >
                {updatesCount > 99 ? '99+' : updatesCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        {runningTasks > 0 && (
          <span className="mr-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-chart-3" />
            {runningTasks} 个任务
          </span>
        )}
        <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={onToggleTheme} title={dark ? '切换到浅色' : '切换到深色'}>
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  )
}
