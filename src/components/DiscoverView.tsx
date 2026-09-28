import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { History, Loader2, PackageSearch, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/EmptyState'
import { SortableHeader, type SortState } from '@/components/SortableHeader'
import { useDebounced } from '@/hooks/useTheme'
import { cleanVersion, type WingetRow } from '@/types'
import { cn } from '@/lib/utils'

type SortKey = 'name' | 'id' | 'version'

const HOT_KEYWORDS = ['git', 'vscode', 'node.js', 'python', 'chrome', '7zip', 'everything', 'potplayer']
const HISTORY_KEY = 'winget-search-history'

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

interface DiscoverViewProps {
  installedIds: Set<string>
  busyIds: Set<string>
  onInstall: (row: WingetRow) => void
  onDetail: (row: WingetRow) => void
}

export function DiscoverView({ installedIds, busyIds, onInstall, onDetail }: DiscoverViewProps) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [rows, setRows] = useState<WingetRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState('')
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'name', dir: 'asc' })
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<string[]>(loadHistory)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastKeyRef = useRef('')

  const debounced = useDebounced(query.trim(), 450)

  const remember = useCallback((k: string) => {
    setHistory((prev) => {
      const next = [k, ...prev.filter((x) => x !== k)].slice(0, 8)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const doSearch = useCallback(
    async (q: string, src: string, force = false) => {
      if (!q) {
        lastKeyRef.current = ''
        setRows(null)
        setSearched('')
        return
      }
      const key = `${q}|${src}`
      if (!force && key === lastKeyRef.current) return
      lastKeyRef.current = key
      setLoading(true)
      setError('')
      try {
        const opts = src === 'all' ? {} : { source: src }
        const result = await window.winget.search(q, { ...opts, count: 100 })
        setRows(result)
        setSearched(q)
        remember(q)
      } catch (err) {
        setRows([])
        setError(String((err as Error).message || err))
      } finally {
        setLoading(false)
      }
    },
    [remember]
  )

  // 防抖自动搜索
  useEffect(() => {
    if (debounced) doSearch(debounced, source)
  }, [debounced, source, doSearch])

  // Ctrl/Cmd + K 聚焦搜索框
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const clearQuery = () => {
    setQuery('')
    lastKeyRef.current = ''
    inputRef.current?.focus()
  }

  const showHistory = focused && !query.trim() && history.length > 0

  const handleSort = (key: string) => {
    const k = key as SortKey
    setSort((prev) => ({ key: k, dir: prev.key === k && prev.dir === 'asc' ? 'desc' : 'asc' }))
  }

  const sorted = useMemo(() => {
    if (!rows) return null
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => (a[sort.key] ?? '').localeCompare(b[sort.key] ?? '', 'zh-CN') * dir)
  }, [rows, sort])

  const installedCount = useMemo(
    () => (rows ? rows.filter((r) => installedIds.has(r.id)).length : 0),
    [rows, installedIds]
  )

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 一体式搜索栏 */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-2xl flex-1">
          <div
            className={cn(
              'flex h-11 items-center gap-0.5 rounded-lg border bg-card pr-1 pl-2.5 shadow-xs transition-colors',
              focused ? 'border-ring ring-[3px] ring-ring/30' : 'hover:border-ring/50'
            )}
          >
            <Search className="mr-1 size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doSearch(query.trim(), source, true)
                if (e.key === 'Escape') {
                  if (showHistory) {
                    setFocused(false)
                    inputRef.current?.blur()
                  } else if (query) {
                    clearQuery()
                  }
                }
              }}
              placeholder="搜索软件包，如 git、vscode、python…"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading ? (
              <Loader2 className="mx-1.5 size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : query ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearQuery}
                title="清空"
                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="mr-1.5 hidden shrink-0 items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground select-none sm:flex">
                Ctrl K
              </kbd>
            )}
            <div className="mx-1 h-5 w-px shrink-0 bg-border" />
            <Select value={source} onValueChange={(v) => {
              setSource(v)
              doSearch(query.trim(), v)
            }}>
              <SelectTrigger
                title="选择软件源"
                className="w-[112px] shrink-0 gap-1 border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 dark:bg-transparent"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部源</SelectItem>
                <SelectItem value="winget">winget 源</SelectItem>
                <SelectItem value="msstore">Microsoft Store</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 最近搜索 */}
          {showHistory && (
            <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
              <div className="flex items-center justify-between border-b px-3 py-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">最近搜索</span>
                <button
                  type="button"
                  className="cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setHistory([])
                    localStorage.removeItem(HISTORY_KEY)
                  }}
                >
                  清空
                </button>
              </div>
              <div className="p-1">
                {history.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(k)
                      doSearch(k, source, true)
                    }}
                  >
                    <History className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{k}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {/* 初始状态：热门推荐 + 最近搜索 */}
        {!rows && !loading && !debounced && (
          <EmptyState
            icon={PackageSearch}
            title="从发现新软件开始"
            description="输入关键词搜索 winget 仓库中数千款软件包"
            action={
              <div className="mt-2 flex max-w-md flex-wrap items-center justify-center gap-2">
                {HOT_KEYWORDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="cursor-pointer rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
                    onClick={() => {
                      setQuery(k)
                      doSearch(k, source, true)
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            }
          />
        )}

        {/* 加载骨架 */}
        {loading && (
          <div className="space-y-2 px-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {rows && !loading && error && <EmptyState icon={PackageSearch} title="搜索失败" description={error} />}

        {sorted && !error && (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              「{searched}」共 {sorted.length} 个结果
              {installedCount > 0 && `，其中 ${installedCount} 个已安装`}
            </p>
            <Table>
              <SortableHeader
                columns={[
                  { key: 'name', label: '名称' },
                  { key: 'id', label: 'ID' },
                  { key: 'version', label: '版本' },
                  { key: 'source', label: '源', sortable: false },
                  { key: 'actions', label: '', sortable: false, className: 'w-[130px] text-right' },
                ]}
                sort={sort}
                onSort={handleSort}
              />
              <TableBody>
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState icon={PackageSearch} title="没有找到匹配的软件包" description="换个关键词试试？" />
                    </TableCell>
                  </TableRow>
                )}
                {sorted.map((row, idx) => {
                  const installed = installedIds.has(row.id)
                  const busy = busyIds.has(row.id)
                  return (
                    <TableRow
                      key={`${row.id}|${row.version}|${row.source}|${idx}`}
                      className="cursor-pointer"
                      onClick={() => onDetail(row)}
                    >
                      <TableCell className="max-w-[320px] font-medium">
                        <span className="block truncate" title={row.name}>
                          {row.name}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[260px] text-muted-foreground">
                        <span className="block truncate font-mono text-xs" title={row.id}>
                          {row.id}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{cleanVersion(row.version)}</TableCell>
                      <TableCell>
                        <Badge variant={row.source === 'msstore' ? 'secondary' : 'outline'} className="text-[11px]">
                          {row.source || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {installed ? (
                          <Badge variant="secondary" className="mr-1">
                            已安装
                          </Badge>
                        ) : null}
                        {busy ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            安装中
                          </span>
                        ) : (
                          <Button size="sm" variant={installed ? 'ghost' : 'default'} disabled={installed} onClick={() => onInstall(row)}>
                            {installed ? '已安装' : '安装'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </ScrollArea>
    </div>
  )
}
