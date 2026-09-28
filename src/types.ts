/** 渲染进程与主进程共享的类型定义 */

export type ViewKey = 'discover' | 'installed' | 'updates'

export interface WingetRow {
  name: string
  id: string
  version: string
  available?: string
  source?: string
  match?: string
}

export interface WingetShowField {
  key: string
  value: string
}

export interface WingetShow {
  title: string
  fields: WingetShowField[]
  raw: string
}

export type TaskAction = 'install' | 'upgrade' | 'uninstall'

export interface TaskEvent {
  type: 'status' | 'log' | 'progress' | 'done'
  status?: 'running'
  line?: string
  progress?: number | null
  ok?: boolean
  cancelled?: boolean
  code?: number
  lastLine?: string
}

export interface Task {
  id: string
  action: TaskAction
  pkgId: string
  pkgName: string
  status: 'running' | 'done' | 'failed' | 'cancelled'
  progress: number | null
  logs: string[]
  lastLine: string
  startedAt: number
}

export interface WingetApi {
  getEnv(): Promise<{ ok: boolean; exe: string; version: string }>
  search(query: string, opts?: { source?: string; count?: number; exact?: boolean }): Promise<WingetRow[]>
  list(): Promise<WingetRow[]>
  upgrades(): Promise<WingetRow[]>
  show(id: string): Promise<WingetShow>
  startTask(action: TaskAction, pkg: string): Promise<string>
  cancelTask(taskId: string): Promise<void>
  onTaskEvent(cb: (e: TaskEvent & { taskId: string }) => void): () => void
  setNativeDark(dark: boolean): void
}

declare global {
  interface Window {
    winget: WingetApi
  }
}

/** 任务动作的中文文案 */
export const ACTION_LABEL: Record<TaskAction, string> = {
  install: '安装',
  upgrade: '升级',
  uninstall: '卸载',
}

/** winget 版本列 "> 1.8.10" 前缀清理 */
export function cleanVersion(v?: string): string {
  if (!v) return ''
  return v.replace(/^>\s*/, '')
}
