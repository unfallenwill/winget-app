import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  CircleArrowUp,
  Compass,
  HardDriveDownload,
  History,
  Info,
  Loader2,
  Moon,
  Package,
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
import { Badge } from '@/components/ui/badge'
import { cleanVersion, type ViewKey, type WingetRow } from '@/types'
import { cn, loadSearchHistory } from '@/lib/utils'

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

/** 图标底色语义：琥珀=高价值动作，primary/info=当前上下文，neutral=辅助 */
const TONE = {
  amber: 'border-warning/25 bg-warning/12 text-warning',
  primary: 'border-primary/20 bg-primary/10 text-primary',
  info: 'border-info/20 bg-info/10 text-info',
  neutral: 'border-border/70 bg-surface-3/55 text-muted-foreground',
} as const

const NAV_ITEMS: { view: ViewKey; label: string; desc: string; Icon: typeof Compass }[] = [
  { view: 'discover', label: '发现', desc: '搜索并安装新程序', Icon: Compass },
  { view: 'installed', label: '已安装', desc: '查看与管理本机程序', Icon: HardDriveDownload },
  { view: 'updates', label: '更新', desc: '可升级的程序', Icon: CircleArrowUp },
]

/**
 * 统一图标尺寸 14px。
 * 显式带上 size 类可以避开 command.tsx 里 `svg:not([class*='size-'])` 的默认尺寸与灰化规则，
 * 让图标瓷砖的语义色说了算。
 */
const ico = (Icon: typeof Compass, className?: string) => (
  <Icon className={cn('size-3.5', className)} />
)

/** 统一的命令项骨架：图标瓷砖 + 主标签 + 右侧附加信息 */
function ItemRow({
  value,
  onSelect,
  icon,
  tone,
  children,
  hint,
  disabled,
  title,
}: {
  value: string
  onSelect: () => void
  icon: ReactNode
  tone: keyof typeof TONE
  children: ReactNode
  hint?: ReactNode
  disabled?: boolean
  title?: string
}) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      title={title}
      className={cn(
        'h-9 gap-2.5 rounded-md pr-2.5 pl-2 transition-colors duration-fast ease-diasnap',
        "before:absolute before:top-1/2 before:left-0.5 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-transparent before:content-['']",
        'data-[selected=true]:bg-surface-3 data-[selected=true]:shadow-s1 data-[selected=true]:ring-1 data-[selected=true]:ring-border-strong/50 data-[selected=true]:before:bg-primary',
        'data-[disabled=true]:opacity-55',
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-[7px] border transition-colors duration-fast',
          TONE[tone],
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2 truncate">
        {children}
      </span>
      {hint}
    </CommandItem>
  )
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
      className={cn(
        'top-[14%] max-w-[600px] translate-y-0 rounded-xl border-border-strong/70',
        '[&_[data-slot=command-input-wrapper]]:bg-surface-3/30',
      )}
      title="命令栏"
      description="搜索软件包或执行命令"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="搜索已安装程序，或输入命令…"
        className="font-medium"
      />

      <CommandList className="max-h-[min(56vh,26rem)] min-h-56">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex size-9 items-center justify-center rounded-lg border border-border/70 bg-surface-3/50 text-muted-foreground">
              <PackageSearch className="size-4" />
            </span>
            <p className="text-sm font-medium text-foreground/80">没有匹配的命令或已安装程序</p>
            {q && <p className="text-xs text-muted-foreground">回车即可在 winget 源中搜索「{q}」</p>}
            {!q && <p className="text-xs text-muted-foreground">输入包名，或用 ↑↓ 浏览命令</p>}
          </div>
        </CommandEmpty>

        {/* 搜索行动：一框多能的核心，永远排在最前 */}
        {q && (
          <CommandGroup heading="搜索">
            <ItemRow
              value={`winget-search-${q}`}
              onSelect={() => run(() => onSearch(q))}
              icon={ico(Search)}
              tone="primary"
              hint={<ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />}
            >
              <span className="font-medium">在 winget 搜索</span>
              <span className="truncate text-muted-foreground">「{q}」</span>
            </ItemRow>
          </CommandGroup>
        )}

        {historyMatches.length > 0 && (
          <CommandGroup heading="最近搜索">
            {historyMatches.map((h) => (
              <ItemRow
                key={h}
                value={`history-${h}`}
                onSelect={() => run(() => onSearch(h))}
                icon={ico(History)}
                tone="neutral"
              >
                <span className="truncate">{h}</span>
              </ItemRow>
            ))}
          </CommandGroup>
        )}

        {localMatches.length > 0 && (
          <CommandGroup heading="已安装 · 打开详情">
            {localMatches.map((row) => (
              <ItemRow
                key={`${row.id}|${row.version}|${row.source}`}
                value={`installed-${row.id}-${row.version}`}
                onSelect={() => run(() => onDetail(row))}
                icon={ico(Package)}
                tone="info"
                hint={
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {cleanVersion(row.version)}
                  </span>
                }
              >
                <span className="truncate font-medium">{row.name}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">{row.id}</span>
              </ItemRow>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* 导航：三个视图，带一句话说明，避免只看到一个光秃秃的词 */}
        <CommandGroup heading="前往">
          {NAV_ITEMS.map(({ view, label, desc, Icon }) => (
            <ItemRow
              key={view}
              value={`go-${view}`}
              onSelect={() => run(() => onNavigate(view))}
              icon={ico(Icon)}
              tone="neutral"
              hint={
                view === 'updates' && updatesCount > 0 ? (
                  <Badge variant="warning" className="ml-2">
                    {updatesCount}
                  </Badge>
                ) : null
              }
            >
              <span className="font-medium">{label}</span>
              <span className="truncate text-xs text-muted-foreground">{desc}</span>
            </ItemRow>
          ))}
        </CommandGroup>

        <CommandGroup heading="操作">
          {updatesCount > 0 && (
            <ItemRow
              value="upgrade-all"
              onSelect={() => run(onUpgradeAll)}
              disabled={batchMode}
              title={batchMode ? '批量更新进行中，暂时无法再次触发' : undefined}
              icon={batchMode ? ico(Loader2, 'animate-spin') : ico(Sparkles)}
              tone="amber"
              hint={
                batchMode ? (
                  <span className="shrink-0 text-xs text-muted-foreground">批量更新中</span>
                ) : (
                  <Badge variant="warning" className="ml-2">
                    {updatesCount}
                  </Badge>
                )
              }
            >
              <span className="font-medium">全部更新</span>
              <span className="truncate text-xs text-muted-foreground">
                {batchMode ? '等待当前批量任务完成' : `${updatesCount} 个程序可升级`}
              </span>
            </ItemRow>
          )}

          <ItemRow
            value="refresh"
            onSelect={() => run(onRefreshAll)}
            icon={ico(RefreshCw)}
            tone="info"
            hint={<Info className="size-3.5 shrink-0 text-muted-foreground" />}
          >
            <span className="font-medium">刷新数据</span>
            <span className="truncate text-xs text-muted-foreground">重新拉取已安装与可更新列表</span>
          </ItemRow>

          <ItemRow
            value="toggle-theme"
            onSelect={() => run(onToggleTheme)}
            icon={ico(dark ? Sun : Moon)}
            tone="neutral"
          >
            <span>切换到{dark ? '浅色' : '深色'}模式</span>
          </ItemRow>
        </CommandGroup>
      </CommandList>

      {/* 键位提示条：与任务中心同一套浮层语言 */}
      <div className="flex items-center gap-3 border-t border-border/70 bg-surface-3/30 px-3 py-1.5 text-2xs text-muted-foreground">
        <Kbd>↑↓</Kbd>
        <span>选择</span>
        <Kbd>↵</Kbd>
        <span>执行</span>
        <Kbd>esc</Kbd>
        <span>关闭</span>
        {runningTasks > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-primary">
            <Loader2 className="size-3 animate-spin" />
            <span className="tabular-nums">{runningTasks}</span> 个任务进行中
          </span>
        )}
      </div>
    </CommandDialog>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-xs border border-border bg-surface-1 px-1 font-mono text-2xs text-foreground-subtle shadow-s1">
      {children}
    </kbd>
  )
}
