'use strict'
const { contextBridge, ipcRenderer } = require('electron')

const api = {
  /** @returns {Promise<{ok:boolean, exe:string, version:string}>} */
  getEnv: () => ipcRenderer.invoke('winget:env'),
  /** @returns {Promise<import('../src/types').WingetRow[]>} */
  search: (query, opts) => ipcRenderer.invoke('winget:search', query, opts),
  /** @returns {Promise<import('../src/types').WingetRow[]>} */
  list: () => ipcRenderer.invoke('winget:list'),
  /** @returns {Promise<import('../src/types').WingetRow[]>} */
  upgrades: () => ipcRenderer.invoke('winget:upgrades'),
  /** @returns {Promise<import('../src/types').WingetShow>} */
  show: (id) => ipcRenderer.invoke('winget:show', id),
  /**
   * @param {'install'|'upgrade'|'uninstall'} action
   * @returns {Promise<string>} taskId
   */
  startTask: (action, pkg) => ipcRenderer.invoke('winget:task:start', action, pkg),
  cancelTask: (taskId) => ipcRenderer.invoke('winget:task:cancel', taskId),
  /**
   * 订阅任务事件（进度/日志/完成）
   * @param {(e: {taskId:string} & import('../src/types').TaskEvent) => void} cb
   * @returns {() => void} 取消订阅
   */
  onTaskEvent: (cb) => {
    const listener = (_e, payload) => cb(payload)
    ipcRenderer.on('winget:task:event', listener)
    return () => ipcRenderer.removeListener('winget:task:event', listener)
  },
  setNativeDark: (dark) => ipcRenderer.send('ui:set-dark', dark),
}

contextBridge.exposeInMainWorld('winget', api)
