import { CircleArrowUp, Compass, HardDriveDownload, Moon, Package2, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ViewKey = 'discover' | 'installed' | 'updates'

interface SidebarProps {
  active: ViewKey
  onNavigate: (view: ViewKey) => void
  updatesCount: number
  runningTasks: number
  dark: boolean
  onToggleTheme: () => void
  wingetVersion: string | null
}
const NAV_ITEMS: { key: ViewKey; label: string; icon: typeof Compass }[] = [
  { key: 'discover', label: '发现', icon: Compass },
  { key: 'installed', label: '已安装', icon: HardDriveDownload },
  { key: 'updates', label: '更新', icon: CircleArrowUp },
]

export function Sidebar({ active, onNavigate, updatesCount, runningTasks, dark, onToggleTheme, wingetVersion }: SidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <div className="relative flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Package2 className="size-5" />
          {runningTasks > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-chart-2 ring-2 ring-sidebar" title="有任务进行中" />
          )}
        </div>
        <div>
          <p className="text-sm leading-tight font-semibold">Winget 管理器</p>
          <p className="text-[11px] text-muted-foreground">图形化包管理前端</p>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active === key
                ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className="size-4" />
            {label}
            {key === 'updates' && updatesCount > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {updatesCount > 99 ? '99+' : updatesCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* 底部 */}
      <div className="space-y-2 px-5 pb-5">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="size-8" onClick={onToggleTheme} title={dark ? '切换到浅色' : '切换到深色'}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
        <p className="truncate text-[11px] text-muted-foreground/70" title={wingetVersion ?? ''}>
          {wingetVersion ? wingetVersion : '正在检测 winget…'}
        </p>
      </div>
    </aside>
  )
}
