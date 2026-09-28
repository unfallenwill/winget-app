import { useMemo, useState } from 'react'
import { ArrowRight, Filter, Loader2, PackageOpen, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/EmptyState'
import { SortableHeader, type SortState } from '@/components/SortableHeader'
import { cleanVersion, type WingetRow } from '@/types'

type SortKey = 'name' | 'id' | 'version'

interface InstalledViewProps {
  rows: WingetRow[] | null
  loading: boolean
  error: string
  busyIds: Set<string>
  onRefresh: () => void
  onDetail: (row: WingetRow) => void
  onUpgrade: (row: WingetRow) => void
  onUninstall: (row: WingetRow) => void
}

export function InstalledView({
  rows,
  loading,
  error,
  busyIds,
  onRefresh,
  onDetail,
  onUpgrade,
  onUninstall,
}: InstalledViewProps) {
  const [filter, setFilter] = useState('')
  const [onlyUpdatable, setOnlyUpdatable] = useState(false)
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'name', dir: 'asc' })
  const [confirmRow, setConfirmRow] = useState<WingetRow | null>(null)

  const filtered = useMemo(() => {
    if (!rows) return null
    const q = filter.trim().toLowerCase()
    let out = rows
    if (q) {
      out = out.filter(
        (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
      )
    }
    if (onlyUpdatable) out = out.filter((r) => !!r.available)
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => (a[sort.key] ?? '').localeCompare(b[sort.key] ?? '', 'zh-CN') * dir)
  }, [rows, filter, onlyUpdatable, sort])

  const updatableCount = useMemo(() => rows?.filter((r) => !!r.available).length ?? 0, [rows])

  const handleSort = (key: string) => {
    const k = key as SortKey
    setSort((prev) => ({ key: k, dir: prev.key === k && prev.dir === 'asc' ? 'desc' : 'asc' }))
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 max-w-xs flex-1">
          <Filter className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="按名称或 ID 过滤…"
            className="h-10 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="only-updatable" checked={onlyUpdatable} onCheckedChange={setOnlyUpdatable} />
          <Label htmlFor="only-updatable" className="text-sm text-muted-foreground">
            仅可更新{updatableCount > 0 ? ` (${updatableCount})` : ''}
          </Label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {rows && (
            <Badge variant="outline" className="font-normal">
              {filtered?.length ?? 0} / {rows.length} 个程序
            </Badge>
          )}
          <Button variant="outline" size="icon" className="size-10" onClick={onRefresh} title="重新扫描">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {loading && !rows && (
          <div className="space-y-2 px-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {error && !loading && !rows && (
          <EmptyState icon={PackageOpen} title="扫描失败" description={error} action={<Button variant="outline" onClick={onRefresh}>重试</Button>} />
        )}

        {filtered && (
          <Table>
            <SortableHeader
              columns={[
                { key: 'name', label: '名称' },
                { key: 'id', label: 'ID' },
                { key: 'version', label: '版本' },
                { key: 'available', label: '可更新', sortable: false },
                { key: 'source', label: '源', sortable: false },
                { key: 'actions', label: '', sortable: false, className: 'w-[150px] text-right' },
              ]}
              sort={sort}
              onSort={handleSort}
            />
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={PackageOpen}
                      title={filter || onlyUpdatable ? '没有符合条件的程序' : '还没有安装任何程序'}
                      description={filter || onlyUpdatable ? '调整过滤条件试试' : undefined}
                    />
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((row, idx) => {
                const busy = busyIds.has(row.id)
                const unknown = row.version.startsWith('>')
                const canUpgrade = !!row.available && !busy
                return (
                  <TableRow key={`${row.id}|${row.version}|${row.source}|${idx}`} className="cursor-pointer" onClick={() => onDetail(row)}>
                    <TableCell className="max-w-[300px] font-medium">
                      <span className="block truncate" title={row.name}>
                        {row.name}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[240px] text-muted-foreground">
                      <span className="block truncate font-mono text-xs" title={row.id}>
                        {row.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      {unknown ? (
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          ≥ {cleanVersion(row.version)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{row.version}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.available ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground">{row.version.replace(/^>\s*/, '')}</span>
                          <ArrowRight className="size-3 text-primary" />
                          <span className="font-medium text-primary">{row.available}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.source || '本地'}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {canUpgrade && (
                        <Button size="sm" variant="default" className="mr-1" onClick={() => onUpgrade(row)}>
                          {busy && <Loader2 className="size-3.5 animate-spin" />}
                          升级
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={busy}
                        onClick={() => setConfirmRow(row)}
                        title="卸载"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </ScrollArea>

      {/* 卸载确认 */}
      <AlertDialog open={!!confirmRow} onOpenChange={(open) => !open && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>卸载「{confirmRow?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              将通过 winget 卸载 {confirmRow?.id}。此操作不可撤销，部分程序可能弹出确认窗口。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (confirmRow) onUninstall(confirmRow)
                setConfirmRow(null)
              }}
            >
              卸载
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
