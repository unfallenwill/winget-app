import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Sidebar, type ViewKey } from '@/components/Sidebar'
import { DiscoverView } from '@/components/DiscoverView'
import { InstalledView } from '@/components/InstalledView'
import { UpdatesView } from '@/components/UpdatesView'
import { PackageDetailDialog } from '@/components/PackageDetailDialog'
import { TaskCenter } from '@/components/TaskCenter'
import { useTaskCenter } from '@/hooks/useTaskCenter'
import { useTheme } from '@/hooks/useTheme'
import type { WingetRow } from '@/types'

const VIEW_TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  discover: { title: '发现', subtitle: '从 winget 仓库搜索并安装软件' },
  installed: { title: '已安装', subtitle: '管理本机已安装的程序' },
  updates: { title: '更新', subtitle: '检查并升级到最新版本' },
}

export default function App() {
  const { dark, toggle } = useTheme()
  const [view, setView] = useState<ViewKey>('discover')
  const [envError, setEnvError] = useState('')
  const [wingetVersion, setWingetVersion] = useState<string | null>(null)

  // 数据
  const [installed, setInstalled] = useState<WingetRow[] | null>(null)
  const [installedLoading, setInstalledLoading] = useState(false)
  const [installedError, setInstalledError] = useState('')
  const [upgrades, setUpgrades] = useState<WingetRow[] | null>(null)
  const [upgradesLoading, setUpgradesLoading] = useState(false)
  const [upgradesError, setUpgradesError] = useState('')

  const [detailRow, setDetailRow] = useState<WingetRow | null>(null)
  const [batchMode, setBatchMode] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; current?: string } | null>(null)
  const upgradesRef = useRef<WingetRow[] | null>(null)
  upgradesRef.current = upgrades

  /* ---------- 数据加载 ---------- */

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

  // 启动：环境检测 + 首次加载
  useEffect(() => {
    window.winget
      .getEnv()
      .then((env) => setWingetVersion(env.version))
      .catch((err) => setEnvError(String((err as Error).message || err)))
    refreshAll()
  }, [refreshAll])

  /* ---------- 任务 ---------- */

  // 任务完成后刷新数据
  const onAnyTaskDone = useCallback(() => {
    loadInstalled()
    // 升级结果有延迟，稍等再查
    setTimeout(loadUpgrades, 1500)
  }, [loadInstalled, loadUpgrades])

  const { tasks, run, cancel, clearFinished } = useTaskCenter(onAnyTaskDone)

  const busyIds = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks) if (t.status === 'running') s.add(t.pkgId)
    return s
  }, [tasks])

  const installedIds = useMemo(() => new Set((installed ?? []).map((r) => r.id)), [installed])

  const runAction = useCallback(
    (action: 'install' | 'upgrade' | 'uninstall', row: WingetRow) => {
      // 乐观更新：发现页立即显示"已安装"状态由数据刷新保证，这里仅启动任务
      run(action, row.id, row.name)
    },
    [run]
  )

  /* ---------- 全部更新 ---------- */

  const upgradeAll = useCallback(async () => {
    const pending = upgradesRef.current ?? []
    if (pending.length === 0 || batchMode) return
    setBatchMode(true)
    setBatchProgress({ done: 0, total: pending.length })
    let done = 0
    for (const row of pending) {
      if (!row.available) continue
      setBatchProgress({ done, total: pending.length, current: row.name })
      const ok = await run('upgrade', row.id, row.name)
      done++
      setBatchProgress({ done, total: pending.length, current: undefined })
      if (!ok) {
        // 单个失败继续下一个，不中断批量
        continue
      }
    }
    setBatchProgress(null)
    setBatchMode(false)
    loadUpgrades()
  }, [batchMode, run, loadUpgrades])

  /* ---------- 渲染 ---------- */

  const runningCount = tasks.filter((t) => t.status === 'running').length
  const updatesCount = upgrades?.filter((r) => !!r.available).length ?? 0

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        active={view}
        onNavigate={setView}
        updatesCount={updatesCount}
        runningTasks={runningCount}
        dark={dark}
        onToggleTheme={toggle}
        wingetVersion={wingetVersion}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <header className="flex shrink-0 items-baseline gap-3 border-b px-6 pt-5 pb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{VIEW_TITLES[view].title}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{VIEW_TITLES[view].subtitle}</p>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 p-6">
          {envError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="size-4" />
              <AlertTitle>无法连接 winget</AlertTitle>
              <AlertDescription>{envError}</AlertDescription>
            </Alert>
          )}

          {view === 'discover' && (
            <DiscoverView
              installedIds={installedIds}
              busyIds={busyIds}
              onInstall={(row) => runAction('install', row)}
              onDetail={setDetailRow}
            />
          )}
          {view === 'installed' && (
            <InstalledView
              rows={installed}
              loading={installedLoading}
              error={installedError}
              busyIds={busyIds}
              onRefresh={loadInstalled}
              onDetail={setDetailRow}
              onUpgrade={(row) => runAction('upgrade', row)}
              onUninstall={(row) => runAction('uninstall', row)}
            />
          )}
          {view === 'updates' && (
            <UpdatesView
              rows={upgrades}
              loading={upgradesLoading}
              error={upgradesError}
              busyIds={busyIds}
              batchMode={batchMode}
              batchProgress={batchProgress}
              onRefresh={loadUpgrades}
              onUpgrade={(row) => runAction('upgrade', row)}
              onUpgradeAll={upgradeAll}
              onDetail={setDetailRow}
            />
          )}

          {/* 任务中心浮层 */}
          <TaskCenter tasks={tasks} onCancel={cancel} onClearFinished={clearFinished} />
        </div>
      </main>

      <PackageDetailDialog row={detailRow} open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)} />

      <Toaster position="top-center" richColors closeButton />
    </div>
  )
}
