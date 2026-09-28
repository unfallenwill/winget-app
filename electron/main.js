'use strict'
const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const winget = require('./winget')

const isDev = !!process.env.VITE_DEV_SERVER_URL
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1020,
    minHeight: 680,
    show: false,
    backgroundColor: '#fbfaf6',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // 外部链接一律用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // 开发时自动打开 DevTools（Ctrl+Shift+I 手动）
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/* ---------------- 任务管理 ---------------- */

let taskSeq = 0
/** @type {Map<string, {action:string, pkg:string, handle:{cancel():void}}>} */
const tasks = new Map()

function sendTaskEvent(taskId, event) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('winget:task:event', { taskId, ...event })
  }
}

/* ---------------- IPC ---------------- */

ipcMain.handle('winget:env', () => winget.env())

ipcMain.handle('winget:search', (_e, query, opts) => winget.search(query, opts || {}))
ipcMain.handle('winget:list', () => winget.list())
ipcMain.handle('winget:upgrades', () => winget.upgrades())
ipcMain.handle('winget:show', (_e, id) => winget.show(id))

ipcMain.handle('winget:task:start', (_e, action, pkg) => {
  if (!['install', 'upgrade', 'uninstall'].includes(action)) {
    throw new Error(`未知操作: ${action}`)
  }
  // 同一个包不允许并发任务
  for (const t of tasks.values()) {
    if (t.pkg === pkg) throw new Error(`已有针对 ${pkg} 的任务正在进行`)
  }
  const taskId = `t${++taskSeq}`
  tasks.set(taskId, { action, pkg })

  sendTaskEvent(taskId, { type: 'status', status: 'running' })

  const handle = winget.startAction(action, pkg, {
    onLine: (line) => {
      const progress = winget.parseProgress(line)
      sendTaskEvent(taskId, {
        type: progress != null ? 'progress' : 'log',
        progress,
        line,
      })
    },
  })
  tasks.get(taskId).handle = handle

  handle.promise.then((result) => {
    tasks.delete(taskId)
    sendTaskEvent(taskId, {
      type: 'done',
      ok: result.ok && !result.cancelled,
      cancelled: result.cancelled,
      code: result.code,
      lastLine: (result.output || result.stderr || '').split(/\r?\n/).filter((l) => l.trim()).pop() || '',
    })
  })

  return taskId
})

ipcMain.handle('winget:task:cancel', (_e, taskId) => {
  const t = tasks.get(taskId)
  if (t && t.handle) t.handle.cancel()
})

// 渲染进程深浅色变化时同步原生窗口背景色
ipcMain.on('ui:set-dark', (_e, dark) => {
  if (mainWindow) mainWindow.setBackgroundColor(dark ? '#21201c' : '#fbfaf6')
})

/* ---------------- 生命周期 ---------------- */

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 冒烟测试：窗口起来 3 秒后自动退出（CI 验证主进程可启动）
if (process.env.SMOKE_TEST) {
  app.whenReady().then(() => {
    setTimeout(() => {
      console.log('[smoke] window created, exiting')
      app.exit(0)
    }, 3000)
  })
}

// 自动截图：SCREENSHOT=<输出路径> SHOT_MODE=home|installed|updates|palette|dark
if (process.env.SCREENSHOT) {
  app.whenReady().then(() => {
    const mode = process.env.SHOT_MODE || 'home'
    const wc = mainWindow.webContents
    setTimeout(async () => {
      try {
        if (mode === 'dark') {
          await wc.executeJavaScript("document.documentElement.classList.add('dark')")
          mainWindow.setBackgroundColor('#21201c')
        } else if (mode === 'light') {
          await wc.executeJavaScript("document.documentElement.classList.remove('dark')")
          mainWindow.setBackgroundColor('#fbfaf6')
        } else if (mode === 'installed' || mode === 'updates') {
          const label = mode === 'installed' ? '已安装' : '更新'
          await wc.executeJavaScript(
            `[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('${label}'))?.click()`
          )
        } else if (mode === 'palette') {
          // 点击 logo（onClick={onOpenPalette}），React 合成事件对原生 click() 可靠响应
          await wc.executeJavaScript("document.querySelector('header button')?.click()")
        }
        // 已安装/更新需要等 winget 数据渲染
        await new Promise((r) => setTimeout(r, mode === 'installed' || mode === 'updates' ? 2500 : 900))
        const image = await wc.capturePage()
        fs.writeFileSync(process.env.SCREENSHOT, image.toPNG())
        console.log('[screenshot] saved: ' + process.env.SCREENSHOT + ' (mode=' + mode + ')')
      } catch (err) {
        console.error('[screenshot] failed:', err)
      }
      app.exit(0)
    }, 7000)
  })
}
