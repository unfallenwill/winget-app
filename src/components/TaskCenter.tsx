import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Loader2,
  Terminal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ACTION_LABEL, type Task } from '@/types'
import { cn } from '@/lib/utils'

interface TaskCenterProps {
  tasks: Task[]
  onCancel: (taskId: string) => void
  onClearFinished: () => void
}

const ACTION_ICON = {
  install: ArrowDownToLine,
  upgrade: ArrowUpFromLine,
  uninstall: Trash2,
} as const

/**
 * 四态 → 视觉语义的唯一映射点（业务判断仍由 status 决定，此处只管长什么样）。
 * running 用 info + 旋转，done 用 success，failed 用 destructive，cancelled 退到中性。
 */
const STATUS = {
  running: { label: '进行中', tone: 'info', Icon: Loader2, spin: true },
  done: { label: '成功', tone: 'success', Icon: CheckCircle2, spin: false },
  cancelled: { label: '已取消', tone: 'soft', Icon: X, spin: false },
  failed: { label: '失败', tone: 'destructive', Icon: XCircle, spin: false },
} as const

/** 跃迁高亮持续时长：够被看见，不至于在长任务流里闪个不停 */
const FLASH_MS = 2800
const ALL_DONE_MS = 3600
const LEAVE_MS = 200
/** 内联日志尾部的行数：既能看出卡在哪一步，又不至于把浮层撑成日志查看器 */
const PEEK_LINES = 8

const TC_CSS = `
@keyframes tc-pop{0%{transform:scale(.55);opacity:0}62%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes tc-sweep{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}
`

/** winget 用 | 与 █ 画进度条，抹掉只留语义 */
function stripBar(line: string): string {
  return line
    .replace(/\r/g, ' ')
    .replace(/[|│┃]/g, ' ')
    .replace(/[█▉▊▋▌▍▎▏]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 摘要行的截断上限：完整输出交给内联日志与日志对话框 */
const SUMMARY_MAX = 84

/** 疑似错误行：让失败任务的输出自己指向问题 */
const ERROR_LINE = /(error|failed|failure|exception|denied|cannot|unable|exit code|0x8[a-f0-9]{7}|失败|错误|拒绝|无权限)/i

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 找到真正在滚动的祖先（穿透 ScrollArea / 包装层），底部跟随逻辑靠它 */
function tailScroller(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el
  while (node) {
    if (node.scrollHeight > node.clientHeight + 1) return node
    node = node.parentElement
  }
  return el
}

function nearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 20
}

/* ────────────────────────────── 完整日志对话框 ────────────────────────────── */

function TaskLogDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const [following, setFollowing] = useState(true)

  const jumpToTail = () => {
    follow.current = true
    setFollowing(true)
    const el = tailScroller(bottomRef.current)
    if (el) el.scrollTop = el.scrollHeight
  }

  // 打开或切换任务时重新接管滚动
  useEffect(() => {
    if (!open) return
    follow.current = true
    setFollowing(true)
    const el = tailScroller(bottomRef.current)
    if (el) el.scrollTop = el.scrollHeight
  }, [open, task?.id])

  // 逐行追加：直接写 scrollTop，不排队动画（100 行日志时平滑滚动会明显拖沓）
  useEffect(() => {
    if (!open || !follow.current) return
    const el = tailScroller(bottomRef.current)
    if (el) el.scrollTop = el.scrollHeight
  }, [open, task?.logs.length, task?.id])

  const lines = task?.logs ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task && <TaskStatusBadge task={task} />}
            <span className="truncate">
              {task && `${ACTION_LABEL[task.action]} · ${task.pkgName}`}
            </span>
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{task?.pkgId}</DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg border border-border/70 bg-surface-1 shadow-well">
          <div className="flex items-center gap-1.5 border-b border-border/60 px-2.5 py-1 text-2xs text-muted-foreground">
            <Terminal className="size-3" />
            <span>winget 输出</span>
            <span className="ml-auto font-mono tabular-nums">{lines.length} 行</span>
          </div>
          <div
            className="h-[min(52vh,26rem)] overflow-y-auto select-text px-3 py-2"
            onScroll={(e) => {
              const el = e.currentTarget
              const f = nearBottom(el)
              follow.current = f
              setFollowing(f)
            }}
          >
            {lines.length === 0 ? (
              <WaitingOutput />
            ) : (
              <pre className="font-mono text-xs leading-5 whitespace-pre-wrap">
                {lines.map((raw, i) => {
                  const text = stripBar(raw)
                  return (
                    <div
                      key={i}
                      className={cn(
                        'min-h-5 break-words',
                        ERROR_LINE.test(raw) ? 'text-destructive' : 'text-foreground/72',
                        i >= lines.length - 3 && 'text-foreground/90',
                      )}
                    >
                      {text || ' '}
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </pre>
            )}
          </div>
          {/* 用户上滚查看历史时，暂停自动跟随并给出回到底部的出口 */}
          {!following && (
            <button
              type="button"
              onClick={jumpToTail}
              className="absolute inset-x-0 bottom-2 mx-auto w-fit cursor-pointer rounded-full border border-border-strong/70 bg-surface-2 px-2.5 py-1 text-2xs text-foreground/80 shadow-s2 transition-colors duration-fast ease-diasnap hover:bg-surface-3 focus-ring"
            >
              已暂停自动滚动 · 回到最新
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 还没有输出时的「仍在跑」提示：载入类指示器，减弱动效下也保留动画 */
function WaitingOutput() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="motion-required animate-shimmer h-px w-1/3 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      </div>
      <p className="text-xs text-muted-foreground">等待 winget 输出…</p>
    </div>
  )
}

/* ────────────────────────────── 状态徽章 ────────────────────────────── */

function TaskStatusBadge({ task, pop }: { task: Task; pop?: boolean }) {
  const meta = STATUS[task.status]
  const { Icon } = meta
  return (
    <Badge variant={meta.tone} className="gap-1">
      <span
        className="inline-flex"
        style={pop ? { animation: 'tc-pop 440ms cubic-bezier(.2,0,0,1) both' } : undefined}
      >
        <Icon className={cn('size-3', meta.spin && 'animate-spin')} />
      </span>
      {task.status === 'running' && task.progress != null ? `${task.progress}%` : meta.label}
    </Badge>
  )
}

/* ────────────────────────────── 主组件 ────────────────────────────── */

export function TaskCenter({ tasks, onCancel, onClearFinished }: TaskCenterProps) {
  const [expanded, setExpanded] = useState(true)
  const [logTask, setLogTask] = useState<Task | null>(null)

  /* 浮层生命周期：任务来了进场，最后一个任务消失后播放退场再卸载 */
  const [mounted, setMounted] = useState(tasks.length > 0)
  const [leaving, setLeaving] = useState(false)

  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({})
  const [flash, setFlash] = useState<Record<string, 'success' | 'destructive' | 'muted'>>({})
  const [popId, setPopId] = useState<string | null>(null)
  const [allDoneFlash, setAllDoneFlash] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const manualLog = useRef(new Set<string>())
  const peekRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const followPeek = useRef<Record<string, boolean>>({})
  const prevStatus = useRef<Map<string, Task['status']>>(new Map())
  const timers = useRef<number[]>([])

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id)
      fn()
    }, ms)
    timers.current.push(id)
  }
  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  /* ── 进 / 退场 ── */
  useEffect(() => {
    if (tasks.length > 0) {
      setMounted(true)
      setLeaving(false)
      return
    }
    if (!mounted) return
    setLeaving(true)
    const id = window.setTimeout(() => {
      setMounted(false)
      setLeaving(false)
    }, LEAVE_MS)
    return () => window.clearTimeout(id)
  }, [tasks.length, mounted])

  /* ── 状态跃迁检测：进行中 → 结束的那一帧给反馈 ── */
  useEffect(() => {
    const next = new Map(tasks.map((t) => [t.id, t.status]))
    const prev = prevStatus.current
    prevStatus.current = next
    if (tasks.length === 0) return

    const settled = tasks.filter(
      (t) => prev.get(t.id) === 'running' && t.status !== 'running',
    )
    if (settled.length === 0) return

    const toneOf = (s: Task['status']) =>
      s === 'done' ? ('success' as const) : s === 'failed' ? ('destructive' as const) : ('muted' as const)
    setFlash((f) => {
      const nextFlash = { ...f }
      settled.forEach((t) => {
        nextFlash[t.id] = toneOf(t.status)
      })
      return nextFlash
    })
    settled.forEach((t) => {
      later(() => {
        setFlash((f) => {
          const n = { ...f }
          delete n[t.id]
          return n
        })
        setPopId((cur) => (cur === t.id ? null : cur))
      }, FLASH_MS)
    })
    setPopId((cur) => cur ?? (settled.find((t) => t.status === 'failed') ?? settled[0]).id)

    // 失败后用户的下一步就是看输出：没被手动关过的话自动展开日志尾部
    const failed = settled.filter((t) => t.status === 'failed').map((t) => t.id)
    if (failed.length > 0) {
      setOpenLogs((s) => {
        const n = { ...s }
        failed.forEach((id) => {
          if (!manualLog.current.has(id)) n[id] = true
        })
        return n
      })
    }

    // 最后一个任务落地：面板整体给一次成功提示
    if (tasks.every((t) => t.status !== 'running')) {
      setAllDoneFlash(true)
      later(() => setAllDoneFlash(false), ALL_DONE_MS)
    }
  }, [tasks])

  const running = useMemo(() => tasks.filter((t) => t.status === 'running'), [tasks])
  const finished = useMemo(() => tasks.filter((t) => t.status !== 'running'), [tasks])
  const hasRunning = running.length > 0
  const allDone = !hasRunning

  /* ── 秒级心跳：安装一个大包可能几分钟，时长是「还在跑」最直接的证据 ── */
  useEffect(() => {
    if (!hasRunning) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [hasRunning])

  /* ── 内联日志尾部跟随底部：用户手动上滚后不再拽回 ── */
  useEffect(() => {
    for (const id of Object.keys(openLogs)) {
      if (!openLogs[id]) continue
      if (followPeek.current[id] === false) continue
      const el = peekRefs.current[id]
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [tasks, openLogs])

  /* 多任务时的总览进度：有百分比才算，否则走不确定态 */
  const aggregate = useMemo(() => {
    if (!running.length) return null
    const known = running.map((t) => t.progress).filter((p): p is number => p != null)
    if (known.length !== running.length) return null
    return Math.round(known.reduce((a, b) => a + b, 0) / known.length)
  }, [running])

  const toggleLog = (id: string) => {
    manualLog.current.add(id)
    setOpenLogs((s) => ({ ...s, [id]: !s[id] }))
  }

  const visible = expanded ? tasks : hasRunning ? running : tasks.slice(-3)
  const flashCount = Object.keys(flash).length

  return (
    <>
      <style>{TC_CSS}</style>
      <span className="sr-only" role="status" aria-live="polite">
        {flashCount > 0
          ? `${flashCount} 个任务已结束`
          : hasRunning
            ? `${running.length} 个任务进行中`
            : ''}
      </span>

      {mounted && (
        <div
          role="region"
          aria-label="任务中心"
          className={cn(
            'pointer-events-auto absolute right-4 bottom-4 z-40 flex w-[392px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border-strong/70 bg-surface-2 shadow-s3',
            'transition-[transform,opacity,box-shadow] duration-base ease-diasnap',
            leaving
              ? 'translate-y-3 scale-[0.98] opacity-0'
              : 'animate-fade-up',
            hasRunning && !leaving && 'ring-1 ring-primary/12',
            allDoneFlash && 'ring-1 ring-success/25',
          )}
        >
          {/* 头部 */}
          <div className="relative flex items-center gap-2 border-b border-border/70 bg-surface-3/45 px-3 py-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-2 shadow-s1',
                allDoneFlash ? 'text-success' : hasRunning ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {allDoneFlash ? <CheckCircle2 className="size-3.5" /> : <ListTodo className="size-3.5" />}
            </span>
            <span className="text-sm leading-none font-medium">任务中心</span>
            <span className="truncate text-xs text-muted-foreground">
              {hasRunning ? `${running.length} 个进行中` : allDoneFlash ? '全部完成' : '暂无进行中任务'}
            </span>

            <div className="ml-auto flex items-center gap-1">
              {finished.length > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 text-2xs text-muted-foreground"
                  onClick={onClearFinished}
                >
                  清除已完成
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setExpanded((e) => !e)}
                title={expanded ? '折叠' : '展开'}
                aria-expanded={expanded}
              >
                <ChevronDown
                  className={cn(
                    'transition-transform duration-base ease-diasnap',
                    !expanded && '-rotate-90',
                  )}
                />
              </Button>
            </div>

            {/* 总览进度：贴在头部下沿，作为「面板还活着」的持续信号 */}
            {hasRunning && (
              <Progress
                value={aggregate ?? undefined}
                indeterminate={aggregate == null}
                className={cn(
                  'absolute inset-x-0 -bottom-px h-[3px] rounded-none transition-opacity duration-base',
                  expanded ? 'opacity-100' : 'opacity-0',
                )}
              />
            )}
          </div>

          {/* 任务列表：grid 轨道做真实的高度折叠 */}
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-slow ease-diasnap',
              expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="min-h-0 overflow-hidden">
              {visible.map((task) => {
                const ActionIcon = ACTION_ICON[task.action]
                const isRunning = task.status === 'running'
                const tone = flash[task.id]
                const logOpen = !!openLogs[task.id]
                const elapsed = now - task.startedAt
                const tail = task.logs.slice(-PEEK_LINES)

                return (
                  <div
                    key={task.id}
                    data-status={task.status}
                    className={cn(
                      'group relative border-b border-border/60 px-3 py-2.5 transition-colors duration-base ease-diasnap last:border-b-0',
                      'hover:bg-surface-3/40',
                      tone === 'success' && 'bg-success/10',
                      tone === 'destructive' && 'bg-destructive/10',
                      tone === 'muted' && 'bg-muted/60',
                    )}
                  >
                    {/* 完成瞬间掠过的高光，一次性、不循环 */}
                    {tone === 'success' && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-success/12 to-transparent"
                        style={{ animation: 'tc-sweep 900ms cubic-bezier(.2,0,0,1) both' }}
                      />
                    )}

                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          'relative mt-px flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-1 shadow-s1 transition-colors duration-slow',
                          isRunning
                            ? 'text-primary'
                            : task.status === 'done'
                              ? 'text-success'
                              : task.status === 'failed'
                                ? 'text-destructive'
                                : 'text-muted-foreground',
                        )}
                      >
                        <ActionIcon className="size-3.5" />
                        {isRunning && (
                          <span className="motion-required animate-ping absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary/70 ring-2 ring-surface-2" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLog(task.id)}
                            title={logOpen ? '收起输出' : '查看输出'}
                            className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm leading-snug font-medium transition-colors duration-fast hover:text-primary focus-ring rounded-xs"
                          >
                            {task.pkgName}
                          </button>
                          <TaskStatusBadge task={task} pop={popId === task.id} />
                        </div>

                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="shrink-0">{ACTION_LABEL[task.action]}</span>
                          <span className="text-border-strong">·</span>
                          <span className="shrink-0 tabular-nums">{fmtDuration(elapsed)}</span>
                          {task.status === 'failed' && (
                            <>
                              <span className="text-border-strong">·</span>
                              <span className="truncate text-destructive/85">展开输出查看原因</span>
                            </>
                          )}
                          {isRunning && task.lastLine && (
                            <>
                              <span className="text-border-strong">·</span>
                              <span className="truncate font-mono text-2xs">
                                {clip(stripBar(task.lastLine))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-0.5 flex shrink-0 items-center gap-0.5">
                        {isRunning ? (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => onCancel(task.id)}
                            title="取消任务"
                          >
                            <X />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground opacity-60 transition-opacity duration-fast group-hover:opacity-100"
                            onClick={() => toggleLog(task.id)}
                            title={logOpen ? '收起输出' : '查看输出'}
                            aria-expanded={logOpen}
                          >
                            {logOpen ? (
                              <ChevronDown className="transition-transform duration-base ease-diasnap" />
                            ) : (
                              <ChevronRight />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 进行中：无论有没有百分比都给出进度条，不确定态走 indeterminate */}
                    {isRunning && (
                      <Progress
                        value={task.progress ?? undefined}
                        indeterminate={task.progress == null}
                        className="mt-2 h-1"
                      />
                    )}

                    {/* 内联输出尾部：不用进二级对话框就能看到卡在哪一步 */}
                    {logOpen && (
                      <div className="mt-2 overflow-hidden rounded-md border border-border/70 bg-surface-1/80 shadow-well">
                        <div className="flex items-center gap-1.5 border-b border-border/60 px-2 py-1 text-2xs text-muted-foreground">
                          <Terminal className="size-3" />
                          <span>输出</span>
                          <span className="font-mono tabular-nums">
                            {task.logs.length > PEEK_LINES ? `最近 ${PEEK_LINES} / ` : ''}
                            {task.logs.length} 行
                          </span>
                          <button
                            type="button"
                            onClick={() => setLogTask(task)}
                            className="ml-auto cursor-pointer rounded-xs px-1 text-foreground-subtle transition-colors duration-fast hover:text-primary focus-ring"
                          >
                            完整日志
                          </button>
                        </div>
                        <div
                          ref={(el) => {
                            peekRefs.current[task.id] = el
                          }}
                          onScroll={(e) => {
                            followPeek.current[task.id] = nearBottom(e.currentTarget)
                          }}
                          className="max-h-28 overflow-y-auto px-2 py-1.5 select-text"
                        >
                          {tail.length === 0 ? (
                            <p className="py-1 text-2xs text-muted-foreground">
                              {isRunning ? '等待输出…' : '没有输出记录'}
                            </p>
                          ) : (
                            tail.map((raw, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'font-mono text-xs leading-[1.55] break-words',
                                  ERROR_LINE.test(raw)
                                    ? 'text-destructive'
                                    : i >= tail.length - 2
                                      ? 'text-foreground/80'
                                      : 'text-foreground-subtle',
                                )}
                              >
                                {stripBar(raw) || ' '}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {allDone && expanded && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-1.5 border-t border-border/60 px-3 py-2 text-2xs transition-colors duration-slow',
                    allDoneFlash ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {allDoneFlash ? <CheckCircle2 className="size-3" /> : null}
                  {allDoneFlash ? '全部任务已完成' : '全部任务已结束'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <TaskLogDialog task={logTask} open={!!logTask} onOpenChange={(o) => !o && setLogTask(null)} />
    </>
  )
}

function clip(s: string): string {
  return s.length > SUMMARY_MAX ? `${s.slice(0, SUMMARY_MAX)}…` : s
}
