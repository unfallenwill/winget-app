import { useEffect, useRef, type ReactNode } from 'react'
import { Loader2, PackageSearch, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { cleanVersion, type WingetRow } from '@/types'
import { cn, packageInitial, packageTint } from '@/lib/utils'

interface PackageListViewProps {
  rows: WingetRow[] | null
  loading: boolean
  error: string
  selectedId: string | null
  onSelect: (row: WingetRow) => void
  /** Enter 键触发的主操作（按视图定义） */
  onPrimaryAction: (row: WingetRow) => void
  onRetry?: () => void
  emptyTitle: string
  emptyDescription?: string
  emptyAction?: ReactNode
  /** 版本区（中右侧） */
  renderMeta?: (row: WingetRow) => ReactNode
  /** 行尾操作按钮（hover/选中显示） */
  renderActions?: (row: WingetRow) => ReactNode
  /** 名称旁徽章 */
  renderBadge?: (row: WingetRow) => ReactNode
  /** 正在执行安装/升级/卸载的行：其操作区常显，不随 hover 隐藏 */
  busyIds?: Set<string>
}

/* ──────────────────────────────────────────────────────────────
 * 行几何：骨架屏与真实行共用同一组类名。
 * 任何尺寸改动只改这里，加载完成瞬间不会跳动。
 * 目标行高 44px（内容 32px + py-1.5×2），行距 2px。
 * ────────────────────────────────────────────────────────────── */
const ROW_GEOMETRY = 'flex items-center gap-3 rounded-xl px-3 py-1.5'
const ICON_GEOMETRY = 'size-8 shrink-0 rounded-md'
const NAME_LINE = 'text-base font-medium leading-tight tracking-tight'
const ID_LINE = 'mt-0.5 font-mono text-2xs leading-tight'

/** 尊重系统减弱动效：键盘导航改为瞬时滚动 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Raycast 式统一列表：行式 item、选中联动详情、↑↓ 键盘导航、Enter 主操作。
 * 三个视图（发现/已安装/更新）共用此渲染。
 */
export function PackageListView({
  rows,
  loading,
  error,
  selectedId,
  onSelect,
  onPrimaryAction,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  renderMeta,
  renderActions,
  renderBadge,
  busyIds,
}: PackageListViewProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // 键盘导航：↑↓ 移动选中，Enter 主操作（输入框聚焦时忽略）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (!rows || rows.length === 0) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = rows.findIndex((r) => r.id === selectedId)
        const next =
          idx === -1
            ? 0
            : Math.min(rows.length - 1, Math.max(0, idx + (e.key === 'ArrowDown' ? 1 : -1)))
        const row = rows[next]
        if (row) {
          onSelect(row)
          // 滚动保持可见（减弱动效时瞬时到位）
          requestAnimationFrame(() => {
            listRef.current
              ?.querySelector(`[data-row-id="${CSS.escape(row.id)}"]`)
              ?.scrollIntoView({
                block: 'nearest',
                behavior: prefersReducedMotion() ? 'auto' : 'smooth',
              })
          })
        }
      } else if (e.key === 'Enter' && selectedId) {
        const row = rows.find((r) => r.id === selectedId)
        if (row) onPrimaryAction(row)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, selectedId, onSelect, onPrimaryAction])

  return (
    <div
      ref={listRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
    >
      {/* 骨架屏：与真实行逐像素同构 */}
      {loading && !rows && (
        <div className="space-y-0.5 pt-1" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={ROW_GEOMETRY}>
              <Skeleton className={ICON_GEOMETRY} />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-0.5 h-2.5 w-52" />
              </div>
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && !rows && (
        <EmptyState
          icon={RefreshCw}
          title="加载失败"
          description={error}
          action={
            onRetry && (
              <Button variant="outline" onClick={onRetry}>
                重试
              </Button>
            )
          }
          className="[&_[data-slot=empty-icon]]:border-destructive/25! [&_[data-slot=empty-icon]]:bg-destructive/10! [&_[data-slot=empty-icon]]:text-destructive!"
        />
      )}

      {rows && rows.length === 0 && !loading && (
        <EmptyState
          icon={PackageSearch}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      )}

      {/* 无数据且非加载中（如发现页未搜索时）：展示引导空态 */}
      {!rows && !loading && !error && (
        <EmptyState
          icon={PackageSearch}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          className="[&_[data-slot=empty-hint]]:flex"
        />
      )}

      {rows && rows.length > 0 && (
        <div role="listbox" aria-label="软件包列表" className="animate-fade-up space-y-0.5 pt-1">
          {rows.map((row) => {
            const selected = row.id === selectedId
            // 运行中的行不隐藏操作区：安装可能持续数分钟，指示器不能靠 hover 才可见
            const busy = busyIds?.has(row.id) === true
            return (
              <div
                key={`${row.id}|${row.version}|${row.source}`}
                data-row-id={row.id}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => onSelect(row)}
                onKeyDown={(e) => e.key === 'Enter' && onPrimaryAction(row)}
                className={cn(
                  'group relative flex cursor-default select-none outline-none',
                  ROW_GEOMETRY,
                  'transition-colors duration-fast ease-diasnap',
                  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                  selected
                    ? // 选中：实心暖表面 + 内描边 + 左侧主色标记条，三重签名
                      'bg-accent ring-1 ring-inset ring-border-strong'
                    : // 未选中：hover 只是一层淡暖色水洗，明显弱于选中
                      'hover:bg-muted'
                )}
              >
                {/* 左侧主色标记条：键盘用户的"我在哪"锚点 */}
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary',
                    'transition-opacity duration-fast ease-diasnap',
                    selected ? 'opacity-100' : 'opacity-0'
                  )}
                />

                {/* 图标位：行的视觉锚点，选中时轻微放大强化焦点 */}
                <div
                  className={cn(
                    ICON_GEOMETRY,
                    'flex items-center justify-center text-sm font-semibold',
                    'transition-transform duration-base ease-diasnap',
                    packageTint(row.name),
                    selected && 'scale-105'
                  )}
                >
                  {packageInitial(row.name)}
                </div>

                {/* 名称 + ID：两行定宽，mono 对齐便于竖向扫读 */}
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2">
                    <span className={cn('min-w-0 truncate text-foreground', NAME_LINE)}>
                      {row.name}
                    </span>
                    {renderBadge && (
                      <span className="flex shrink-0 items-center">{renderBadge(row)}</span>
                    )}
                  </p>
                  <p
                    className={cn(
                      ID_LINE,
                      'truncate tabular-nums transition-colors duration-fast ease-diasnap',
                      selected ? 'text-muted-foreground' : 'text-foreground-subtle'
                    )}
                  >
                    {row.id}
                  </p>
                </div>

                {/* 版本/元信息：右对齐 + 表格数字，横向成列 */}
                <div
                  className={cn(
                    'max-w-[46%] shrink-0 truncate text-right text-xs tabular-nums',
                    'text-muted-foreground transition-colors duration-fast ease-diasnap'
                  )}
                >
                  {renderMeta ? (
                    renderMeta(row)
                  ) : (
                    <span>{cleanVersion(row.version) || '—'}</span>
                  )}
                </div>

                {/* 操作：选中常显（键盘路径），其余 hover / 焦点内浮现 */}
                {renderActions && (
                  <div
                    className={cn(
                      'flex shrink-0 items-center gap-1 tabular-nums',
                      'transition-opacity duration-fast ease-diasnap',
                      selected || busy
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderActions(row)}
                  </div>
                )}
              </div>
            )
          })}

          {/* 底部呼吸空间 */}
          <div className="h-2" />

          {/* 刷新中：贴底常驻指示器（不随列表滚走） */}
          {loading && rows.length > 0 && (
            <div className="sticky bottom-0 z-10 mt-1 flex justify-center py-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border border-border/80',
                  'bg-popover/90 px-3 py-1.5 text-xs text-muted-foreground shadow-s2 backdrop-blur-sm'
                )}
              >
                <Loader2 className="motion-required size-3 animate-spin text-primary" />
                正在刷新
                <span className="tabular-nums text-foreground-subtle">{rows.length} 项</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
