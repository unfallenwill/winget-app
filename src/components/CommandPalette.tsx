import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CircleArrowUp,
  Compass,
  HardDriveDownload,
  History,
  Loader2,
  Moon,
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import type { ViewKey } from '@/types'
import { loadSearchHistory } from '@/lib/utils'
import type { WingetRow } from '@/types'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: ViewKey) => void
  /** 跳转到发现页并立即搜索 */
  onSearch: (q: string) => void
  installed: WingetRow[] | null
  updatesCount: number
  runningTasks: number
  batchMode: boolean
  dark: boolean
  onToggleTheme: () => void
  onRefreshAll: () => void
  onUpgradeAll: () => void
  onDetail: (row: WingetRow) => void
}

/**
 * Dia 式全局命令栏：一框多能（搜包 / 跳转 / 命令），键盘优先。
 * Ctrl+K 随时呼出，↑↓ 选择，↵ 执行，Esc 关闭。
 */
export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onSearch,
  installed,
  updatesCount,
  runningTasks,
  batchMode,
  dark,
  onToggleTheme,
  onRefreshAll,
  onUpgradeAll,
  onDetail,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')

  const q = query.trim()
  const qLower = q.toLowerCase()

  // 已安装本地匹配（输入即过滤，零延迟）
  const localMatches = useMemo(() => {
    if (!q || !installed) return []
    return installed
      .filter((r) => r.name.toLowerCase().includes(qLower) || r.id.toLowerCase().includes(qLower))
      .slice(0, 4)
  }, [q, qLower, installed])

  // 最近搜索匹配
  const historyMatches = useMemo(() => {
    if (!q) return []
    return loadSearchHistory().filter((h) => h.toLowerCase().includes(qLower)).slice(0, 3)
  }, [q, qLower])

  const run = (fn: () => void) => {
    onOpenChange(false)
    setQuery('')
    // 等关闭动画后再执行，避免焦点残留
    setTimeout(fn, 60)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setQuery('')
      }}
      showCloseButton={false}
      className="top-[16%] max-w-xl translate-y-0 rounded-3xl border-border/60"
      title="命令栏"
      description="搜索软件包或执行命令"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="搜索软件包，或输入命令…"
      />
      <CommandList className="min-h-56">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <PackageSearch className="size-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">没有匹配的命令或已安装程序</p>
            {q && (
              <p className="text-xs text-muted-foreground/70">
                试试在 winget 源中搜索「{q}」
              </p>
            )}
          </div>
        </CommandEmpty>

        {/* 搜索行动：Dia 式一框多能的核心 */}
        {q && (
          <CommandGroup heading="搜索">
            <CommandItem
              value={`winget-search-${q}`}
              onSelect={() => run(() => onSearch(q))}
              className="gap-2.5"
            >
              <Search className="size-4 shrink-0 text-primary" />
              <span>
                在 winget 搜索 <span className="font-medium">「{q}」</span>
              </span>
              <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
            </CommandItem>
          </CommandGroup>
        )}

        {historyMatches.length > 0 && (
          <CommandGroup heading="最近搜索">
            {historyMatches.map((h) => (
              <CommandItem key={h} value={`history-${h}`} onSelect={() => run(() => onSearch(h))} className="gap-2.5">
                <History className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{h}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {localMatches.length > 0 && (
          <CommandGroup heading="已安装匹配">
            {localMatches.map((row) => (
              <CommandItem
                key={`${row.id}|${row.version}|${row.source}`}
                value={`installed-${row.id}-${row.version}`}
                onSelect={() => run(() => onDetail(row))}
                className="gap-2.5"
              >
                <HardDriveDownload className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{row.name}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">{row.id}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{row.version.replace(/^>\s*/, '')}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* 导航与快捷命令 */}
        <CommandGroup heading="前往">
          <CommandItem value="go-discover" onSelect={() => run(() => onNavigate('discover'))} className="gap-2.5">
            <Compass className="size-4 shrink-0" />
            发现
          </CommandItem>
          <CommandItem value="go-installed" onSelect={() => run(() => onNavigate('installed'))} className="gap-2.5">
            <HardDriveDownload className="size-4 shrink-0" />
            已安装
          </CommandItem>
          <CommandItem value="go-updates" onSelect={() => run(() => onNavigate('updates'))} className="gap-2.5">
            <CircleArrowUp className="size-4 shrink-0" />
            更新
            {updatesCount > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-gold-foreground">
                {updatesCount}
              </span>
            )}
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="操作">
          {updatesCount > 0 && (
            <CommandItem
              value="upgrade-all"
              disabled={batchMode}
              onSelect={() => run(onUpgradeAll)}
              className="gap-2.5"
            >
              {batchMode ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Sparkles className="size-4 shrink-0 text-gold" />}
              全部更新（{updatesCount} 个）
            </CommandItem>
          )}
          <CommandItem value="refresh" onSelect={() => run(onRefreshAll)} className="gap-2.5">
            <RefreshCw className="size-4 shrink-0" />
            刷新数据
          </CommandItem>
          <CommandItem value="toggle-theme" onSelect={() => run(onToggleTheme)} className="gap-2.5">
            {dark ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
            切换到{dark ? '浅色' : '深色'}模式
          </CommandItem>
        </CommandGroup>
      </CommandList>

      {/* Dia 式内联键位提示 */}
      <div className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> 选择
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd> 执行
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border bg-muted px-1 font-mono">esc</kbd> 关闭
        </span>
        {runningTasks > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-primary">
            <Loader2 className="size-3 animate-spin" />
            {runningTasks} 个任务进行中
          </span>
        )}
      </div>
    </CommandDialog>
  )
}
