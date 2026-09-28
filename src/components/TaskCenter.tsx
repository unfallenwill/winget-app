import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronDown,
  ListTodo,
  Loader2,
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
import { ScrollArea } from '@/components/ui/scroll-area'
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

function TaskStatusBadge({ task }: { task: Task }) {
  if (task.status === 'running')
    return (
      <Badge variant="outline" className="gap-1 text-[11px] text-primary">
        <Loader2 className="size-3 animate-spin" />
        {task.progress != null ? `${task.progress}%` : '进行中'}
      </Badge>
    )
  if (task.status === 'done')
    return (
      <Badge variant="outline" className="gap-1 border-success/40 bg-success/10 text-[11px] text-success">
        <CheckCircle2 className="size-3" />
        成功
      </Badge>
    )
  if (task.status === 'cancelled')
    return (
      <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground">
        <X className="size-3" />
        已取消
      </Badge>
    )
  return (
    <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/10 text-[11px] text-destructive">
      <XCircle className="size-3" />
      失败
    </Badge>
  )
}

function TaskLogDialog({ task, open, onOpenChange }: { task: Task | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView()
  }, [open, task?.logs.length])

  if (!task) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ACTION_LABEL[task.action]} · {task.pkgName}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{task.pkgId}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[55vh] rounded-md border bg-muted/40 p-3">
          <pre className="font-mono text-xs leading-5 whitespace-pre-wrap">
            {task.logs.length === 0 ? '等待输出…' : task.logs.join('\n')}
            <div ref={bottomRef} />
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export function TaskCenter({ tasks, onCancel, onClearFinished }: TaskCenterProps) {
  const [expanded, setExpanded] = useState(true)
  const [logTask, setLogTask] = useState<Task | null>(null)

  if (tasks.length === 0) return null

  const running = tasks.filter((t) => t.status === 'running')
  const finished = tasks.filter((t) => t.status !== 'running')
  const visible = expanded ? tasks : running.length ? running : tasks.slice(-3)
  const allDone = running.length === 0

  return (
    <>
      <div className="shadow-dia pointer-events-auto absolute bottom-4 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-card">
        {/* 头部 */}
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <ListTodo className="size-4 text-muted-foreground" />
          <span className="text-xs font-medium">
            任务中心
            {running.length > 0 && <span className="ml-1.5 text-muted-foreground">· {running.length} 个进行中</span>}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {finished.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearFinished}>
                清除已完成
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setExpanded((e) => !e)}>
              <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
            </Button>
          </div>
        </div>

        {/* 任务列表 */}
        <div className={cn('divide-y transition-all', !expanded && 'max-h-none')}>
          {visible.map((task) => {
            const Icon = ACTION_ICON[task.action]
            return (
              <div key={task.id} className="group px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      task.status === 'running' ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer text-left"
                    onClick={() => setLogTask(task)}
                    title="查看完整日志"
                  >
                    <p className="truncate text-xs font-medium">{task.pkgName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {ACTION_LABEL[task.action]}
                      {task.status === 'running' && task.lastLine ? ` · ${stripBar(task.lastLine)}` : ''}
                    </p>
                  </button>
                  <TaskStatusBadge task={task} />
                  {task.status === 'running' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 opacity-60 hover:opacity-100"
                      onClick={() => onCancel(task.id)}
                      title="取消任务"
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                      onClick={() => setLogTask(task)}
                      title="查看日志"
                    >
                      <ChevronDown className="size-3.5 -rotate-90" />
                    </Button>
                  )}
                </div>
                {task.status === 'running' && task.progress != null && (
                  <Progress value={task.progress} className="mt-2 h-1" />
                )}
              </div>
            )
          })}
        </div>

        {allDone && expanded && (
          <div className="border-t px-3 py-1.5 text-center text-[11px] text-muted-foreground">全部任务已结束</div>
        )}
      </div>

      <TaskLogDialog task={logTask} open={!!logTask} onOpenChange={(o) => !o && setLogTask(null)} />
    </>
  )
}

/** 去掉进度条竖线分隔符，只留有用信息 */
function stripBar(line: string): string {
  return line.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}
