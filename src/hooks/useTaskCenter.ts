import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ACTION_LABEL, type Task, type TaskAction } from '@/types'

/**
 * 任务中心：管理 install/upgrade/uninstall 任务的实时状态。
 * startTask 返回的 Promise 在任务结束时 resolve（成功与否见参数）。
 */
export function useTaskCenter(onAnyTaskDone: (action: TaskAction) => void) {
  const [tasks, setTasks] = useState<Task[]>([])
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const doneWaiters = useRef(new Map<string, (ok: boolean) => void>())

  useEffect(() => {
    const unsub = window.winget.onTaskEvent((e) => {
      const { taskId, ...evt } = e
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t
          switch (evt.type) {
            case 'log':
              return { ...t, logs: [...t.logs, evt.line ?? ''].slice(-500), lastLine: evt.line ?? '' }
            case 'progress':
              return { ...t, progress: evt.progress ?? null, logs: evt.progress != null ? t.logs : [...t.logs, evt.line ?? ''].slice(-500) }
            case 'done': {
              const status: Task['status'] = evt.cancelled ? 'cancelled' : evt.ok ? 'done' : 'failed'
              return { ...t, status, progress: evt.ok ? 100 : t.progress, lastLine: evt.lastLine || t.lastLine }
            }
            default:
              return t
          }
        })
      )

      if (evt.type === 'done') {
        const task = tasksRef.current.find((t) => t.id === taskId)
        const ok = !!evt.ok && !evt.cancelled
        const cancelled = !!evt.cancelled
        const label = task ? `${ACTION_LABEL[task.action]} ${task.pkgName}` : '任务'
        if (cancelled) toast.info(`${label} 已取消`)
        else if (ok) toast.success(`${label} 完成`)
        else toast.error(`${label} 失败`, { description: evt.lastLine || `退出码 ${evt.code}` })

        doneWaiters.current.get(taskId)?.(ok)
        doneWaiters.current.delete(taskId)
        if (!cancelled) onAnyTaskDone(task?.action ?? 'install')
      }
    })
    return unsub
  }, [onAnyTaskDone])

  const run = useCallback(async (action: TaskAction, pkgId: string, pkgName: string): Promise<boolean> => {
    let taskId: string
    try {
      taskId = await window.winget.startTask(action, pkgId)
    } catch (err) {
      toast.error(String((err as Error).message || err))
      return false
    }
    const task: Task = {
      id: taskId,
      action,
      pkgId,
      pkgName,
      status: 'running',
      progress: null,
      logs: [],
      lastLine: '',
      startedAt: Date.now(),
    }
    setTasks((prev) => [...prev, task])
    return new Promise((resolve) => {
      doneWaiters.current.set(taskId, resolve)
    })
  }, [])

  const cancel = useCallback((taskId: string) => {
    window.winget.cancelTask(taskId)
  }, [])

  const clearFinished = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === 'running'))
  }, [])

  const isBusy = useCallback(
    (pkgId: string) => tasks.some((t) => t.pkgId === pkgId && t.status === 'running'),
    [tasks]
  )

  return { tasks, run, cancel, clearFinished, isBusy }
}
