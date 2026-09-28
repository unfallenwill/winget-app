import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ListChecks, Loader2, RefreshCw, Search, Sparkles, Trash2, X } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TopBar } from '@/components/TopBar'
import { PackageListView } from '@/components/PackageListView'
import { DetailPanel } from '@/components/DetailPanel'
import { CommandPalette } from '@/components/CommandPalette'
import { TaskCenter } from '@/components/TaskCenter'
import { useTaskCenter } from '@/hooks/useTaskCenter'
import { useDebounced, useTheme } from '@/hooks/useTheme'
import { loadSearchHistory, saveSearchHistory } from '@/lib/utils'
import { cleanVersion, type ViewKey, type WingetRow } from '@/types'

const HOT_KEYWORDS = ['git', 'vscode', 'node.js', 'python', 'chrome', '7zip', 'everything', 'potplayer']

export default function App() {
  const { dark, toggle } = useTheme()
  const [view, setView] = useState<ViewKey>('discover')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [envError, setEnvError] = useState('')
  const [wingetVersion, setWingetVersion] = useState<string | null>(null)

  /* ---------- 数据 ---------- */
  const [installed, setInstalled] = useState<WingetRow[] | null>(null)
  const [installedLoading, setInstalledLoading] = useState(false)
  const [installedError, setInstalledError] = useState('')
  const [upgrades, setUpgrades] = useState<WingetRow[] | null>(null)
  const [upgradesLoading, setUpgradesLoading] = useState(false)
  const [upgradesError, setUpgradesError] = useState('')

  const loadInstalled = useCallback(async () => {
    setInstalledLoading(true)
    setInstalledError('')
    try {
      setInstalled(await window.winget.list())
    } catch (err) {
      setInstalledError(String((err as Error).message || err))
    } finally {
      setInstalledLoading(false)
    }
  }, [])

  const loadUpgrades = useCallback(async () => {
    setUpgradesLoading(true)
    setUpgradesError('')
    try {
      setUpgrades(await window.winget.upgrades())
    } catch (err) {
      setUpgradesError(String((err as Error).message || err))
    } finally {
      setUpgradesLoading(false)
    }
  }, [])

  const refreshAll = useCallback(() => {
    loadInstalled()
    loadUpgrades()
  }, [loadInstalled, loadUpgrades])

  useEffect(() => {
    window.winget
      .getEnv()
      .then((env) => setWingetVersion(env.version))
      .catch((err) => setEnvError(String((err as Error).message || err)))
    refreshAll()
  }, [refreshAll])

  /* ---------- 任务 ---------- */
  const onAnyTaskDone = useCallback(() => {
    loadInstalled()
    setTimeout(loadUpgrades, 1500)
  }, [loadInstalled, loadUpgrades])

  const { tasks, run, cancel, clearFinished } = useTaskCenter(onAnyTaskDone)

  const busyIds = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks) if (t.status === 'running') s.add(t.pkgId)
    return s
  }, [tasks])

  const installedIds = useMemo(() => new Set((installed ?? []).map((r) => r.id)), [installed])
  const updatesCount = upgrades?.filter((r) => !!r.available).length ?? 0
  const runningCount = tasks.filter((t) => t.status === 'running').length

  /* ---------- 选中（master-detail） ---------- */
  const [selected, setSelected] = useState<WingetRow | null>(null)

  // 切视图时清空选中，避免面板与列表脱节
  useEffect(() => {
    setSelected(null)
  }, [view])

  /* ---------- 发现：搜索 ---------- */
  const [dq, setDq] = useState('')
  const [dSource, setDSource] = useState('all')
  const [dRows, setDRows] = useState<WingetRow[] | null>(null)
  const [dLoading, setDLoading] = useState(false)
  const [dError, setDError] = useState('')
  const [dSearched, setDSearched] = useState('')
  const [initialSearch, setInitialSearch] = useState<{ q: string; nonce: number }>()
  const dqDebounced = useDebounced(dq.trim(), 450)
  const lastSearchKey = useRef('')

  const doSearch = useCallback(
    async (q: string, src: string, force = false) => {
      if (!q) {
        lastSearchKey.current = ''
        setDRows(null)
        setDSearched('')
        return
      }
      const key = `${q}|${src}`
      if (!force && key === lastSearchKey.current) return
      lastSearchKey.current = key
      setDLoading(true)
      setDError('')
      try {
        const opts = src === 'all' ? {} : { source: src }
        const result = await window.winget.search(q, { ...opts, count: 100 })
        setDRows(result)
        setDSearched(q)
        const hist = [q, ...loadSearchHistory().filter((x) => x !== q)].slice(0, 8)
        saveSearchHistory(hist)
      } catch (err) {
        setDRows([])
        setDError(String((err as Error).message || err))
      } finally {
        setDLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (view === 'discover' && dqDebounced) doSearch(dqDebounced, dSource)
  }, [dqDebounced, dSource, doSearch, view])

  // 命令栏发起的搜索
  useEffect(() => {
    if (!initialSearch?.q) return
    setDq(initialSearch.q)
    doSearch(initialSearch.q, dSource, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch?.nonce])

  /* ---------- 已安装：过滤 ---------- */
  const [iFilter, setIFilter] = useState('')
  const [iOnlyUpd, setIOnlyUpd] = useState(false)

  /* ---------- 全部更新（批量） ---------- */
  const [batchMode, setBatchMode] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; current?: string } | null>(null)
  const upgradesRef = useRef(upgrades)
  upgradesRef.current = upgrades

  const upgradeAll = useCallback(async () => {
    const pending = upgradesRef.current ?? []
    if (pending.length === 0 || batchMode) return
    setBatchMode(true)
    setBatchProgress({ done: 0, total: pending.length })
    let done = 0
    for (const row of pending) {
      if (!row.available) continue
      setBatchProgress({ done, total: pending.length, current: row.name })
      await run('upgrade', row.id, row.name)
      done++
      setBatchProgress({ done, total: pending.length })
    }
    setBatchProgress(null)
    setBatchMode(false)
    loadUpgrades()
  }, [batchMode, run, loadUpgrades])

  /* ---------- 主操作（Enter / 按钮共用） ---------- */
  const runAction = useCallback(
    (action: 'install' | 'upgrade' | 'uninstall', row: WingetRow) => run(action, row.id, row.name),
    [run]
  )

  const handlePrimary = useCallback(
    (row: WingetRow) => {
      if (view === 'discover' && !installedIds.has(row.id)) runAction('install', row)
      else if (view === 'updates' && row.available) runAction('upgrade', row)
      else if (view === 'installed' && row.available) runAction('upgrade', row)
    },
    [view, installedIds, runAction]
  )

  /* ---------- 卸载确认 ---------- */
  const [confirmRow, setConfirmRow] = useState<WingetRow | null>(null)

  /* ---------- 各视图可见行 ---------- */
  const installedVisible = useMemo(() => {
    if (!installed) return null
    const q = iFilter.trim().toLowerCase()
    let out = installed
    if (q) out = out.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    if (iOnlyUpd) out = out.filter((r) => !!r.available)
    return [...out].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [installed, iFilter, iOnlyUpd])

  const updatesVisible = useMemo(
    () => (upgrades ? [...upgrades].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')) : null),
    [upgrades]
  )

  const currentRows = view === 'discover' ? dRows : view === 'installed' ? installedVisible : updatesVisible
  const currentLoading = view === 'discover' ? dLoading : view === 'installed' ? installedLoading : upgradesLoading
  const currentError = view === 'discover' ? dError : view === 'installed' ? installedError : upgradesError
  const currentRetry = view === 'discover' ? () => doSearch(dq.trim(), dSource, true) : view === 'installed' ? loadInstalled : loadUpgrades

  // 列表变化后若选中项不在列表中，自动选中第一行（Raycast 式：面板始终有内容）
  useEffect(() => {
    if (!currentRows || currentRows.length === 0) return
    if (!selected || !currentRows.some((r) => r.id === selected.id)) {
      setSelected(currentRows[0])
    }
  }, [currentRows, selected])

  /* ---------- 渲染 ---------- */
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        view={view}
        onNavigate={setView}
        updatesCount={updatesCount}
        runningTasks={runningCount}
        dark={dark}
        onToggleTheme={toggle}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {envError && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">{envError}</div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* 主区：工具行 + 列表 */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* 工具行 */}
          <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
            {view === 'discover' && (
              <>
                <div className="relative flex h-10 max-w-md flex-1 items-center gap-0.5 rounded-full border bg-card pr-1 pl-3 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25 hover:border-ring/50">
                  <Search className="mr-1 size-4 shrink-0 text-muted-foreground" />
                  <input
                    value={dq}
                    onChange={(e) => setDq(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') doSearch(dq.trim(), dSource, true)
                      if (e.key === 'Escape' && dq) {
                        setDq('')
                        doSearch('', dSource)
                      }
                    }}
                    placeholder="搜索软件包，如 git、vscode、python…"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {dLoading ? (
                    <Loader2 className="mx-1.5 size-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : dq ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDq('')
                        doSearch('', dSource)
                      }}
                      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                  <div className="mx-1 h-5 w-px shrink-0 bg-border" />
                  <Select value={dSource} onValueChange={(v) => {
                    setDSource(v)
                    doSearch(dq.trim(), v)
                  }}>
                    <SelectTrigger className="w-[104px] shrink-0 border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 dark:bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部源</SelectItem>
                      <SelectItem value="winget">winget 源</SelectItem>
                      <SelectItem value="msstore">MS Store</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {dRows && !dError && (
                  <span className="text-xs whitespace-nowrap text-muted-foreground">
                    「{dSearched}」{dRows.length} 个结果
                  </span>
                )}
              </>
            )}

            {view === 'installed' && (
              <>
                <div className="relative h-10 max-w-xs flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={iFilter}
                    onChange={(e) => setIFilter(e.target.value)}
                    placeholder="按名称或 ID 过滤已安装程序…"
                    className="h-10 rounded-full pr-9 pl-9 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="only-upd" checked={iOnlyUpd} onCheckedChange={setIOnlyUpd} />
                  <Label htmlFor="only-upd" className="cursor-pointer text-xs text-muted-foreground">
                    仅可更新
                  </Label>
                </div>
                <Badge variant="outline" className="h-7 rounded-full font-normal">
                  {installedVisible?.length ?? 0} / {installed?.length ?? 0}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-full"
                  onClick={loadInstalled}
                  title="重新扫描"
                >
                  <RefreshCw className={installedLoading ? 'size-4 animate-spin' : 'size-4'} />
                </Button>
              </>
            )}

            {view === 'updates' && (
              <>
                <Badge variant="outline" className="h-7 gap-1.5 rounded-full px-3 font-normal">
                  <ListChecks className="size-3.5" />
                  {updatesCount} 个可更新
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full"
                    onClick={loadUpgrades}
                    title="重新检查更新"
                  >
                    <RefreshCw className={upgradesLoading ? 'size-4 animate-spin' : 'size-4'} />
                  </Button>
                  {updatesCount > 0 && (
                    <Button onClick={upgradeAll} disabled={batchMode} className="rounded-full">
                      {batchMode ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-gold-foreground" />}
                      {batchMode
                        ? `正在全部更新 ${batchProgress ? `${batchProgress.done}/${batchProgress.total}` : '…'}`
                        : '全部更新'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 批量进度条 */}
          {view === 'updates' && batchMode && batchProgress && (
            <div className="mx-4 mb-2 rounded-xl border bg-card px-4 py-2.5">
              <p className="mb-1.5 flex items-center justify-between text-xs">
                <span className="truncate">
                  正在升级 <span className="font-medium">{batchProgress.current ?? ''}</span>
                </span>
                <span className="text-muted-foreground">
                  {batchProgress.done} / {batchProgress.total}
                </span>
              </p>
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((batchProgress.done + (batchProgress.current ? 0.5 : 0)) / Math.max(1, batchProgress.total)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 列表 */}
          <PackageListView
            rows={currentRows}
            loading={currentLoading}
            error={currentError}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            onPrimaryAction={handlePrimary}
            onRetry={currentRetry}
            emptyTitle={
              view === 'discover'
                ? '从发现新软件开始'
                : iFilter || (view === 'installed' && iOnlyUpd)
                  ? '没有符合条件的程序'
                  : view === 'updates'
                    ? '一切已是最新 🎉'
                    : '列表为空'
            }
            emptyDescription={
              view === 'discover'
                ? '输入关键词搜索 winget 仓库中数千款软件包'
                : view === 'updates'
                  ? '所有软件都是最新版本'
                  : '调整过滤条件试试'
            }
            emptyAction={
              view === 'discover' && !dq ? (
                <div className="flex max-w-md flex-wrap items-center justify-center gap-2">
                  {HOT_KEYWORDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="cursor-pointer rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        setDq(k)
                        doSearch(k, dSource, true)
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              ) : undefined
            }
            renderBadge={(row) =>
              view === 'discover' && installedIds.has(row.id) ? (
                <Badge variant="secondary" className="h-4.5 rounded-full px-1.5 text-[10px]">
                  已安装
                </Badge>
              ) : null
            }
            renderMeta={(row) => {
              if (view === 'discover') {
                return (
                  <span className="inline-flex items-center gap-1.5">
                    <span>{cleanVersion(row.version)}</span>
                    <Badge variant="outline" className="h-4.5 rounded-full px-1.5 text-[10px] text-muted-foreground">
                      {row.source || '-'}
                    </Badge>
                  </span>
                )
              }
              if (row.available) {
                return (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-muted-foreground">{row.version.replace(/^>\s*/, '')}</span>
                    <ArrowRight className="size-3 text-primary" />
                    <span className="font-medium text-primary">{cleanVersion(row.available)}</span>
                  </span>
                )
              }
              if (view === 'installed' && row.version.startsWith('>')) {
                return <span className="text-muted-foreground">≥ {cleanVersion(row.version)}</span>
              }
              return <span className="text-muted-foreground">{cleanVersion(row.version) || '—'}</span>
            }}
            renderActions={(row) => {
              const busy = busyIds.has(row.id)
              if (busy) {
                return (
                  <span className="inline-flex items-center gap-1.5 pr-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    进行中
                  </span>
                )
              }
              return (
                <>
                  {view === 'discover' && !installedIds.has(row.id) && (
                    <Button size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => runAction('install', row)}>
                      安装
                    </Button>
                  )}
                  {row.available && (
                    <Button size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => runAction('upgrade', row)}>
                      升级
                    </Button>
                  )}
                  {view === 'installed' && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="卸载"
                      onClick={() => setConfirmRow(row)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </>
              )
            }}
          />
        </main>

        {/* 详情面板 */}
        <DetailPanel
          row={selected}
          busy={selected ? busyIds.has(selected.id) : false}
          onInstall={view === 'discover' ? (row) => runAction('install', row) : undefined}
          onUpgrade={selected?.available ? (row) => runAction('upgrade', row) : undefined}
          onUninstall={view === 'installed' ? (row) => setConfirmRow(row) : undefined}
        />
      </div>

      {/* 状态条 */}
      <footer className="flex h-8 shrink-0 items-center gap-4 border-t px-4 text-[11px] text-muted-foreground">
        <span>{wingetVersion ? `winget ${wingetVersion}` : '正在检测 winget…'}</span>
        <span className="ml-auto inline-flex items-center gap-3">
          <span>
            <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> 选择
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd> 主操作
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1 font-mono">Ctrl K</kbd> 命令
          </span>
        </span>
      </footer>

      {/* 任务中心浮层 */}
      <TaskCenter tasks={tasks} onCancel={cancel} onClearFinished={clearFinished} />

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
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (confirmRow) runAction('uninstall', confirmRow)
                setConfirmRow(null)
              }}
            >
              卸载
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 全局命令栏 */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={setView}
        onSearch={(q) => {
          setInitialSearch({ q, nonce: Date.now() })
          setView('discover')
        }}
        installed={installed}
        updatesCount={updatesCount}
        runningTasks={runningCount}
        batchMode={batchMode}
        dark={dark}
        onToggleTheme={toggle}
        onRefreshAll={refreshAll}
        onUpgradeAll={upgradeAll}
        onDetail={setSelected}
      />

      <Toaster position="top-center" richColors closeButton />
    </div>
  )
}
