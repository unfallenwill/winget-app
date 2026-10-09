import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CircleCheck,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
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
  AlertDialogMedia,
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
import { cn, loadSearchHistory, saveSearchHistory } from '@/lib/utils'
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

  /* ---------- 批量进度的真实完成度（纯展示派生） ---------- */
  const batchPct = batchProgress
    ? Math.round((batchProgress.done / Math.max(1, batchProgress.total)) * 100)
    : 0

  /* ---------- 状态条：上下文键位提示（纯展示派生，不新增任何状态或副作用） ---------- */
  const hasRows = !!currentRows && currentRows.length > 0
  const primaryLabel = view === 'discover' ? '安装' : '升级'
  const canPrimary =
    !!selected && (view === 'discover' ? !installedIds.has(selected.id) : !!selected.available)
  const statusHints: { keys: string; label: string; accent?: boolean }[] = [
    ...(hasRows ? [{ keys: '↑↓', label: '选择' }] : []),
    ...(canPrimary ? [{ keys: '↵', label: primaryLabel, accent: true }] : []),
    ...(view === 'discover' && dq ? [{ keys: 'esc', label: '清空' }] : []),
    { keys: 'Ctrl K', label: '命令栏' },
  ]

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
        <div className="flex shrink-0 animate-fade-up items-center gap-2 border-b border-destructive/25 bg-destructive/8 px-4 py-2 text-xs text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">winget 不可用</span>
            <span className="mx-1.5 opacity-40">·</span>
            {envError}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setEnvError('')}
            title="关闭提示"
            aria-label="关闭提示"
            className="shrink-0 text-destructive hover:bg-destructive/12 hover:text-destructive"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* 主区：工具行 + 列表 */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* 控制带：工具行 + 批量进度，共用一张 surface-1 表面与一条底部分隔线 */}
          <div className="shrink-0 border-b border-border bg-surface-1">
            {/* 三个视图共用一套控件语法（h-9 / 圆角胶囊 / gap-2）；key 触发切视图时的淡入转场 */}
            <div key={view} className="flex h-13 animate-fade-up items-center gap-2 px-4">
              {view === 'discover' && (
                <>
                  {/* 搜索槽：输入与源选择器共用一个暖色输入井，焦点反馈由外层统一给出 */}
                  <div className="group flex h-9 max-w-xl min-w-0 flex-1 items-center gap-1 rounded-full border border-input bg-input/15 pr-1 pl-3 shadow-well transition-[border-color,box-shadow] duration-fast ease-diasnap focus-within:border-ring focus-within:shadow-glow">
                    <Search className="mr-0.5 size-4 shrink-0 text-muted-foreground transition-colors duration-fast group-focus-within:text-primary" />
                    <Input
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
                      aria-label="搜索 winget 软件包"
                      className="h-full min-w-0 flex-1 border-0 bg-transparent px-1.5 shadow-none focus-visible:border-transparent focus-visible:shadow-none"
                    />
                    {dLoading ? (
                      <Loader2 className="motion-required mx-1 size-4 shrink-0 animate-spin text-primary" />
                    ) : dq ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDq('')
                          doSearch('', dSource)
                        }}
                        aria-label="清除搜索"
                        title="清除搜索 (Esc)"
                        className="focus-ring mr-0.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-fast ease-diasnap hover:bg-surface-3 hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                    <div className="mx-1 h-4 w-px shrink-0 bg-border-strong" />
                    <Select
                      value={dSource}
                      onValueChange={(v) => {
                        setDSource(v)
                        doSearch(dq.trim(), v)
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="搜索源"
                        className="h-7 w-[104px] shrink-0 rounded-full border-0 bg-transparent px-2.5 text-xs text-muted-foreground shadow-none ring-0 hover:bg-surface-3 hover:text-foreground focus-visible:border-transparent focus-visible:shadow-none dark:bg-transparent"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部源</SelectItem>
                        <SelectItem value="winget">winget 源</SelectItem>
                        <SelectItem value="msstore">MS Store</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
                    {dRows && !dError ? (
                      <>
                        <span className="hidden max-w-40 truncate text-xs text-muted-foreground lg:block">
                          「{dSearched}」
                        </span>
                        <Badge variant="soft" size="lg" className="h-6 gap-1 px-2 text-xs font-normal">
                          <ListChecks className="size-3" />
                          {dRows.length} 个结果
                        </Badge>
                      </>
                    ) : (
                      <span className="hidden text-xs text-foreground-subtle lg:block">
                        winget 公共源 · Enter 立即搜索
                      </span>
                    )}
                  </div>
                </>
              )}

              {view === 'installed' && (
                <>
                  <div className="relative h-9 max-w-xs min-w-0 flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={iFilter}
                      onChange={(e) => setIFilter(e.target.value)}
                      placeholder="按名称或 ID 过滤已安装程序…"
                      aria-label="过滤已安装程序"
                      className="h-9 rounded-full pr-9 pl-9 text-sm"
                    />
                    {iFilter && (
                      <button
                        type="button"
                        onClick={() => setIFilter('')}
                        aria-label="清除过滤"
                        title="清除过滤"
                        className="focus-ring absolute top-1/2 right-2 inline-flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-fast ease-diasnap hover:bg-surface-3 hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  {/* 过滤开关：与搜索框同高的胶囊筛选器，开启时转主色 */}
                  <div
                    className={cn(
                      'flex h-9 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-3 ring-1 ring-inset transition-colors duration-fast ease-diasnap',
                      iOnlyUpd
                        ? 'bg-primary/10 ring-primary/30'
                        : 'bg-surface-2 ring-border hover:bg-surface-3'
                    )}
                  >
                    <Switch id="only-upd" size="sm" checked={iOnlyUpd} onCheckedChange={setIOnlyUpd} />
                    <Label
                      htmlFor="only-upd"
                      className={cn(
                        'cursor-pointer text-xs font-normal transition-colors duration-fast ease-diasnap',
                        iOnlyUpd ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      仅可更新
                    </Label>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
                    <Badge variant="soft" size="lg" className="h-7 gap-1 px-2.5 text-xs font-normal">
                      <span className="tabular-nums text-foreground">{installedVisible?.length ?? 0}</span>
                      <span className="text-foreground-subtle">/ {installed?.length ?? 0}</span>
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={loadInstalled}
                      title="重新扫描已安装列表"
                      aria-label="重新扫描已安装列表"
                      className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={cn('size-4', installedLoading && 'motion-required animate-spin')} />
                    </Button>
                  </div>
                </>
              )}

              {view === 'updates' && (
                <>
                  {/* 金黄只落在一个小小的计数气泡上，标签本身保持可读 */}
                  <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 pr-3.5 pl-2.5 text-xs text-muted-foreground ring-1 ring-inset ring-border">
                    {updatesCount > 0 ? (
                      <>
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-2xs leading-none font-semibold tabular-nums text-gold-foreground">
                          {updatesCount}
                        </span>
                        <span>个可更新</span>
                      </>
                    ) : (
                      <>
                        <CircleCheck className="size-3.5 text-success" />
                        <span className="text-foreground">已是最新</span>
                      </>
                    )}
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={loadUpgrades}
                      title="重新检查更新"
                      aria-label="重新检查更新"
                      className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={cn('size-4', upgradesLoading && 'motion-required animate-spin')} />
                    </Button>
                    {updatesCount > 0 && (
                      <Button variant="gold" onClick={upgradeAll} disabled={batchMode} className="h-9 pl-3.5">
                        {batchMode ? (
                          <Loader2 className="motion-required size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        {batchMode
                          ? `全部更新中 ${batchProgress ? `${batchProgress.done}/${batchProgress.total}` : '…'}`
                          : '全部更新'}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 批量进度：完成度如实取 done/total，当前包用不确定扫光表示"正在跑" */}
            {view === 'updates' && batchMode && batchProgress && (
              <div className="mx-4 mt-2 mb-3 animate-fade-up rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 shadow-s1">
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <Loader2 className="motion-required size-3.5 shrink-0 animate-spin text-primary" />
                  <span className="shrink-0 text-muted-foreground">正在升级</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {batchProgress.current ?? '准备中…'}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {batchProgress.done} / {batchProgress.total}
                  </span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-primary/75 to-primary transition-[width] duration-slow ease-diasnap"
                    style={{ width: `${batchPct}%` }}
                  />
                  {batchProgress.current && (
                    <div className="absolute inset-y-0 overflow-hidden" style={{ left: `${batchPct}%`, right: 0 }}>
                      <div className="motion-required animate-indeterminate absolute inset-y-0 w-full bg-linear-to-r from-transparent via-primary/40 to-transparent" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 列表：与工具行同一转场节奏，切视图时整块内容重新落位 */}
          <div key={view} className="flex min-h-0 flex-1 animate-fade-up flex-col">
            <PackageListView
              rows={currentRows}
              loading={currentLoading}
              error={currentError}
              selectedId={selected?.id ?? null}
              busyIds={busyIds}
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
                  <div className="flex max-w-lg flex-wrap items-center justify-center gap-1.5">
                    {HOT_KEYWORDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="focus-ring cursor-pointer rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground shadow-s1 transition-colors duration-fast ease-diasnap hover:border-primary/35 hover:bg-surface-2 hover:text-foreground"
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
                  <Badge variant="success" className="h-4 gap-0.5 rounded-full px-1.5 text-2xs leading-none">
                    <CircleCheck className="size-2.5" />
                    已安装
                  </Badge>
                ) : null
              }
              renderMeta={(row) => {
                if (view === 'discover') {
                  return (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="tabular-nums">{cleanVersion(row.version)}</span>
                      <Badge variant="ghost" className="h-4 rounded-full px-1.5 text-2xs leading-none text-muted-foreground">
                        {row.source || '-'}
                      </Badge>
                    </span>
                  )
                }
                if (row.available) {
                  return (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <span className="text-muted-foreground">{row.version.replace(/^>\s*/, '')}</span>
                      <ArrowRight className="size-3 text-muted-foreground/60" />
                      <span className="font-medium text-primary">{cleanVersion(row.available)}</span>
                    </span>
                  )
                }
                if (view === 'installed' && row.version.startsWith('>')) {
                  return <span className="tabular-nums text-muted-foreground">≥ {cleanVersion(row.version)}</span>
                }
                return <span className="tabular-nums text-muted-foreground">{cleanVersion(row.version) || '—'}</span>
              }}
              renderActions={(row) => {
                const busy = busyIds.has(row.id)
                if (busy) {
                  return (
                    <span className="inline-flex items-center gap-1.5 pr-1 text-xs text-muted-foreground">
                      <Loader2 className="motion-required size-3.5 animate-spin" />
                      进行中
                    </span>
                  )
                }
                return (
                  <>
                    {view === 'discover' && !installedIds.has(row.id) && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 px-3 text-xs"
                        onClick={() => runAction('install', row)}
                      >
                        安装
                      </Button>
                    )}
                    {row.available && (
                      <Button
                        size="sm"
                        variant="soft"
                        className="h-7 px-3 text-xs"
                        onClick={() => runAction('upgrade', row)}
                      >
                        升级
                      </Button>
                    )}
                    {view === 'installed' && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="size-7 text-foreground-subtle hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/30"
                        title="卸载"
                        aria-label={`卸载 ${row.name}`}
                        onClick={() => setConfirmRow(row)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </>
                )
              }}
            />
          </div>
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

      {/* 状态条：左侧环境自检，中间当前上下文，右侧随上下文变化的键位提示 */}
      <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-border bg-surface-1 pr-3 pl-4 text-2xs text-muted-foreground select-none">
        <span className="inline-flex shrink-0 items-center gap-1.5">
          {wingetVersion ? (
            <>
              <CircleCheck className="size-3 shrink-0 text-success" />
              <span className="font-mono text-foreground-subtle">winget {wingetVersion}</span>
            </>
          ) : (
            <>
              <Loader2 className="motion-required size-3 shrink-0 animate-spin" />
              <span>正在检测 winget…</span>
            </>
          )}
        </span>

        {selected && (
          <>
            <span className="hidden h-3 w-px shrink-0 bg-border sm:block" />
            <span className="hidden min-w-0 truncate font-mono text-foreground-subtle sm:block">{selected.id}</span>
          </>
        )}

        {/* 键盘优先的自我说明：只提示此刻真正可用的键位 */}
        <span className="ml-auto flex shrink-0 items-center gap-3">
          {statusHints.map((h) => (
            <span key={h.keys} className="inline-flex items-center gap-1">
              <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-surface-2 px-1 font-mono leading-none text-foreground-subtle shadow-well">
                {h.keys}
              </kbd>
              <span className={h.accent ? 'text-foreground' : undefined}>{h.label}</span>
            </span>
          ))}
        </span>
      </footer>

      {/* 任务中心浮层 */}
      <TaskCenter tasks={tasks} onCancel={cancel} onClearFinished={clearFinished} />

      {/* 卸载确认 */}
      <AlertDialog open={!!confirmRow} onOpenChange={(open) => !open && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/12 text-destructive ring-destructive/25">
              <Trash2 className="size-6" />
            </AlertDialogMedia>
            <AlertDialogTitle>卸载「{confirmRow?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              将通过 winget 卸载 <span className="font-mono text-foreground">{confirmRow?.id}</span>
              。此操作不可撤销，部分程序可能弹出确认窗口。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmRow) runAction('uninstall', confirmRow)
                setConfirmRow(null)
              }}
            >
              <Trash2 className="size-4" />
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
