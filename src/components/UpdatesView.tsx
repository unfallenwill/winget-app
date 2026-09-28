import { useMemo } from 'react'
import { ArrowRight, CircleCheck, ListChecks, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/EmptyState'
import { cleanVersion, type WingetRow } from '@/types'

interface UpdatesViewProps {
  rows: WingetRow[] | null
  loading: boolean
  error: string
  busyIds: Set<string>
  batchMode: boolean
  batchProgress: { done: number; total: number; current?: string } | null
  onRefresh: () => void
  onUpgrade: (row: WingetRow) => void
  onUpgradeAll: () => void
  onDetail: (row: WingetRow) => void
}

export function UpdatesView({
  rows,
  loading,
  error,
  busyIds,
  batchMode,
  batchProgress,
  onRefresh,
  onUpgrade,
  onUpgradeAll,
  onDetail,
}: UpdatesViewProps) {
  const sorted = useMemo(() => {
    if (!rows) return null
    return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [rows])

  const anyBusy = busyIds.size > 0

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3">
        {rows && (
          <Badge variant="outline" className="h-7 gap-1 px-2.5 text-xs font-normal">
            <ListChecks className="size-3.5" />
            {rows.length} 个可更新
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-10" onClick={onRefresh} title="重新检查更新">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
          {rows && rows.length > 0 && (
            <Button onClick={onUpgradeAll} disabled={anyBusy || batchMode} className="gap-1.5">
              {batchMode ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {batchMode ? `正在全部更新… ${batchProgress ? `${batchProgress.done}/${batchProgress.total}` : ''}` : '全部更新'}
            </Button>
          )}
        </div>
      </div>

      {batchMode && batchProgress && (
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="mb-2 flex items-center justify-between text-sm">
            <span className="truncate">
              正在升级 <span className="font-medium">{batchProgress.current ?? ''}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {batchProgress.done} / {batchProgress.total}
            </span>
          </p>
          <Progress
            value={((batchProgress.done + (batchProgress.current ? 0.5 : 0)) / Math.max(1, batchProgress.total)) * 100}
            className="h-1.5"
          />
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {loading && !rows && (
          <div className="space-y-2 px-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {error && !loading && !rows && (
          <EmptyState icon={RefreshCw} title="检查更新失败" description={error} action={<Button variant="outline" onClick={onRefresh}>重试</Button>} />
        )}

        {sorted && (
          <Table>
            <TableBody>
              {sorted.length === 0 && !loading && (
                <TableRow>
                  <TableCell>
                    <EmptyState
                      icon={CircleCheck}
                      title="一切已是最新 🎉"
                      description="没有检测到可用更新，所有软件都是最新版本"
                    />
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((row, idx) => {
                const busy = busyIds.has(row.id)
                return (
                  <TableRow key={`${row.id}|${row.version}|${row.source}|${idx}`} className="cursor-pointer" onClick={() => onDetail(row)}>
                    <TableCell className="max-w-[300px] font-medium">
                      <span className="block truncate" title={row.name}>
                        {row.name}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground" title={row.id}>
                        {row.id}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <span className="inline-flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{cleanVersion(row.version) || '未知'}</span>
                        <ArrowRight className="size-3.5 shrink-0 text-primary" />
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                          {cleanVersion(row.available) || '最新'}
                        </Badge>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.source || 'winget'}</TableCell>
                    <TableCell className="w-[110px] text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" disabled={busy || batchMode} onClick={() => onUpgrade(row)}>
                        {busy && <Loader2 className="size-3.5 animate-spin" />}
                        {busy ? '升级中' : '升级'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </ScrollArea>
    </div>
  )
}
