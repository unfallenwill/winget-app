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
          // 滚动保持可见
          requestAnimationFrame(() => {
            listRef.current
              ?.querySelector(`[data-row-id="${CSS.escape(row.id)}"]`)
              ?.scrollIntoView({ block: 'nearest' })
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
    <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {loading && !rows && (
        <div className="space-y-1.5 pt-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-44" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-3.5 w-16" />
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
        />
      )}

      {rows && rows.length === 0 && !loading && (
        <EmptyState icon={PackageSearch} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      )}

      {/* 无数据且非加载中（如发现页未搜索时）：展示引导空态 */}
      {!rows && !loading && !error && (
        <EmptyState icon={PackageSearch} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-0.5 pt-1">
          {rows.map((row) => {
            const selected = row.id === selectedId
            return (
              <div
                key={`${row.id}|${row.version}|${row.source}`}
                data-row-id={row.id}
                role="button"
                tabIndex={-1}
                onClick={() => onSelect(row)}
                onKeyDown={(e) => e.key === 'Enter' && onPrimaryAction(row)}
                className={cn(
                  'group flex cursor-default items-center gap-3 rounded-xl px-3 py-1.5 transition-colors outline-none select-none',
                  selected ? 'bg-accent' : 'hover:bg-accent/45'
                )}
              >
                {/* 图标位 */}
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold',
                    packageTint(row.name)
                  )}
                >
                  {packageInitial(row.name)}
                </div>

                {/* 名称 + ID */}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm leading-tight font-medium">
                    <span className="truncate">{row.name}</span>
                    {renderBadge?.(row)}
                  </p>
                  <p className="truncate font-mono text-[11px] leading-tight text-muted-foreground">{row.id}</p>
                </div>

                {/* 版本/元信息 */}
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  {renderMeta ? (
                    renderMeta(row)
                  ) : (
                    <span>{cleanVersion(row.version) || '—'}</span>
                  )}
                </div>

                {/* 操作 */}
                {renderActions && (
                  <div
                    className={cn(
                      'flex shrink-0 items-center gap-1 transition-opacity',
                      selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
          {loading && rows.length > 0 && (
            <p className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              正在刷新…
            </p>
          )}
        </div>
      )}
    </div>
  )
}
