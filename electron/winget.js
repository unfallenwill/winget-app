'use strict'
/**
 * winget 命令执行器与输出解析器。
 *
 * 输出格式基于实测（winget v1.29，中文系统）：
 *  - 管道输出为 UTF-8
 *  - search/list/upgrade 为固定列宽表格，表头列名与数据列起始字符位置对齐
 *  - install/upgrade 进度行以 \r 刷新，形如 "  45% | ███████ | 3.1/8.4 MiB"
 *  - show 为 "键: 值" 块，含缩进续行与子段落
 */
const { spawn, execFile } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')

const COMMON_ARGS = ['--disable-interactivity', '--accept-source-agreements']

let cachedExe = null

/** 定位 winget.exe（WindowsApps 别名是 0 字节 reparse point，直接 spawn 可用） */
async function findWinget() {
  if (cachedExe) return cachedExe
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'winget.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'winget.exe'),
  ].filter(Boolean)
  for (const c of candidates) {
    try {
      fs.accessSync(c)
      cachedExe = c
      return c
    } catch {
      /* ignore */
    }
  }
  // 兜底：where.exe 查 PATH
  try {
    const exe = await new Promise((resolve, reject) => {
      execFile('where.exe', ['winget'], (err, stdout) => (err ? reject(err) : resolve(stdout.trim().split(/\r?\n/)[0])))
    })
    if (exe) {
      cachedExe = exe
      return exe
    }
  } catch {
    /* ignore */
  }
  throw new Error('未找到 winget，请先从 Microsoft Store 安装“应用安装程序”')
}

/**
 * 运行 winget 命令。
 * @param {string[]} args
 * @param {{ onLine?: (line: string) => void }} opts 流式按行（\r/\n）回调，用于进度
 * @returns {Promise<{code: number|null, stdout: string, stderr: string}>}
 */
function run(args, opts = {}) {
  return findWinget().then(
    (exe) =>
      new Promise((resolve, reject) => {
        const child = spawn(exe, args, { windowsHide: true })
        let outChunks = []
        let errChunks = []
        let pending = Buffer.alloc(0)

        const emitLines = (final) => {
          for (;;) {
            let eol = -1
            for (let i = 0; i < pending.length; i++) {
              if (pending[i] === 0x0d || pending[i] === 0x0a) {
                eol = i
                break
              }
            }
            if (eol < 0) break
            const line = pending.slice(0, eol).toString('utf8')
            // 吃掉紧随的 \r\n 组合
            let next = eol + 1
            if (pending[next] === 0x0d) next++
            if (pending[next] === 0x0a) next++
            pending = pending.slice(next)
            if (opts.onLine && line.trim()) opts.onLine(line)
          }
          if (final && pending.length && opts.onLine) {
            const line = pending.toString('utf8')
            if (line.trim()) opts.onLine(line)
          }
        }

        child.stdout.on('data', (d) => {
          outChunks.push(d)
          pending = Buffer.concat([pending, d])
          emitLines(false)
        })
        child.stderr.on('data', (d) => errChunks.push(d))
        child.on('error', reject)
        child.on('close', (code) => {
          emitLines(true)
          resolve({ code, stdout: Buffer.concat(outChunks).toString('utf8'), stderr: Buffer.concat(errChunks).toString('utf8') })
        })
      })
  )
}

/* ---------------- 表格解析 ---------------- */

/** 简易显示宽度：CJK/全角占 2 列，其余 1 列（winget 表格按显示宽度对齐） */
function charWidth(ch) {
  const cp = ch.codePointAt(0)
  if (
    cp >= 0x1100 &&
    (cp <= 0x115f ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x20000 && cp <= 0x3fffd))
  )
    return 2
  return 1
}

/** 按显示宽度坐标切取子串 */
function displaySlice(chars, startCol, endCol) {
  let col = 0
  let out = ''
  for (const ch of chars) {
    const w = charWidth(ch)
    if (col >= startCol && col + w <= endCol) out += ch
    col += w
    if (col >= endCol) break
  }
  return out
}

const COLUMN_ALIASES = [
  { key: 'name', aliases: ['名称', 'Name'] },
  { key: 'id', aliases: ['ID', 'Id'] },
  { key: 'version', aliases: ['版本', 'Version'] },
  { key: 'available', aliases: ['可用', 'Available'] },
  { key: 'source', aliases: ['源', 'Source'] },
  { key: 'match', aliases: ['匹配', 'Match'] },
]

/** 在表头行中定位各已知列名（要求词边界），返回按位置排序的列定义（位置为显示宽度坐标） */
function parseHeaderLine(line) {
  const chars = Array.from(line)
  const found = []
  for (const { key, aliases } of COLUMN_ALIASES) {
    for (const alias of aliases) {
      const a = Array.from(alias)
      for (let s = 0; s + a.length <= chars.length; s++) {
        if (s > 0 && chars[s - 1] !== ' ') continue
        let ok = true
        for (let j = 0; j < a.length; j++) {
          if (chars[s + j] !== a[j]) {
            ok = false
            break
          }
        }
        if (!ok) continue
        const end = s + a.length
        if (end < chars.length && chars[end] !== ' ') continue
        found.push({ key, start: chars.slice(0, s).reduce((w, c) => w + charWidth(c), 0) })
        break
      }
      if (found.some((f) => f.key === key)) break
    }
  }
  if (found.length < 2) return null
  found.sort((x, y) => x.start - y.start)
  return found
}

/** 解析 search/list/upgrade 的固定宽度表格 */
function parseTable(stdout) {
  const lines = stdout.split(/\r?\n/)
  let headerIdx = -1
  let headerCols = null
  for (let i = 0; i < lines.length; i++) {
    const cols = parseHeaderLine(lines[i])
    if (cols) {
      headerIdx = i
      headerCols = cols
      break
    }
  }
  if (!headerCols) return []
  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim()) continue
    if (/^\s*-{4,}/.test(raw)) continue
    const chars = Array.from(raw)
    const row = {}
    headerCols.forEach((col, ci) => {
      const start = col.start
      const end = ci + 1 < headerCols.length ? headerCols[ci + 1].start : Infinity
      row[col.key] = displaySlice(chars, start, end).trim()
    })
    if (row.name || row.id) {
      // 数据行必须包含 ID 列：过滤 winget 尾部的统计行（如 “1 升级可用。”）
      if (!row.id) continue
      rows.push(row)
    }
  }
  return rows
}

/* ---------------- show 解析 ---------------- */

/** 解析 `winget show` 的键值块，输出有序字段列表 + 原始文本 */
function parseShow(stdout) {
  const lines = stdout.split(/\r?\n/)
  const fields = []
  let title = ''
  let current = null

  for (const line of lines) {
    if (!line.trim()) continue
    // "已找到 Notepad++ [Notepad++.Notepad++]" / "Found Notepad++ [Notepad++.Notepad++]"
    if (!title && /^(已找到|Found)\s/.test(line.trim())) {
      const m = line.match(/^(?:已找到|Found)\s+(.+?)\s*\[(.+?)\]/)
      if (m) title = m[1]
      current = null
      continue
    }
    // 顶格 "键: 值"
    const kv = line.match(/^([^\s:：][^:：]{0,30})[：:]\s?(.*)$/)
    if (kv && !line.startsWith(' ') && !line.startsWith('\t')) {
      current = { key: kv[1].trim(), value: kv[2].trim() }
      fields.push(current)
      continue
    }
    // 缩进续行：并入当前字段值
    if (current && /^\s{2,}/.test(line)) {
      current.value = (current.value ? current.value + '\n' : '') + line.trim()
    }
  }
  return { title, fields, raw: stdout.trim() }
}

/* ---------------- 进度解析 ---------------- */

/** 从进度行提取百分比，如 "  45% | ..." → 45 */
function parseProgress(line) {
  const m = line.match(/(?:^|\s)(\d{1,3})%\s*\|/)
  if (m) return Math.min(100, Number(m[1]))
  return null
}

/* ---------------- 高层 API ---------------- */

async function env() {
  const exe = await findWinget()
  const { stdout } = await run(['--version'])
  return { ok: true, exe, version: stdout.trim().split(/\r?\n/)[0] }
}

async function search(query, opts = {}) {
  if (!query || !query.trim()) return []
  const args = ['search', query, ...COMMON_ARGS]
  if (opts.source) args.push('--source', opts.source)
  if (opts.count) args.push('--count', String(opts.count))
  if (opts.exact) args.push('-e')
  const { stdout, stderr, code } = await run(args)
  // 过滤无 ID 的行（msstore 推荐位/截断行等）
  const rows = parseTable(stdout).filter((r) => r.id)
  if (!rows.length && code !== 0) {
    throw new Error(prettifyError(stderr || stdout) || `winget search 失败（退出码 ${code}）`)
  }
  return rows
}

async function list() {
  const { stdout } = await run(['list', '--accept-source-agreements'])
  return parseTable(stdout).filter((r) => r.id)
}

async function upgrades() {
  const { stdout, stderr, code } = await run(['upgrade', '--include-unknown', ...COMMON_ARGS])
  const rows = parseTable(stdout).filter((r) => r.id)
  // 无可用升级时 winget 退出码非 0 且输出为空
  if (!rows.length && code !== 0 && !stdout.includes('----')) {
    return [] // 正常：没有更新
  }
  return rows
}

async function show(id) {
  if (!id) throw new Error('该条目缺少包 ID，无法加载详情')
  const { stdout, code } = await run(['show', '--id', id, '-e', ...COMMON_ARGS])
  if (code !== 0 || !stdout.trim()) {
    throw new Error(`未找到包 ${id}`)
  }
  return parseShow(stdout)
}

/**
 * 启动安装/升级/卸载任务（流式）。
 * @param {'install'|'upgrade'|'uninstall'} action
 * @param {string} id 包 ID
 * @param {{ onLine: (line: string) => void }} handlers
 * @returns {{ promise: Promise<{ok: boolean, code: number, output: string}>, cancel: () => void }}
 */
function startAction(action, id, handlers) {
  let cancelled = false
  let child = null

  const args =
    action === 'uninstall'
      ? ['uninstall', '--id', id, '-e', '--disable-interactivity']
      : [
          action,
          '--id',
          id,
          '-e',
          '--disable-interactivity',
          '--accept-package-agreements',
          '--accept-source-agreements',
        ]

  const promise = findWinget().then(
    (exe) =>
      new Promise((resolve) => {
        child = spawn(exe, args, { windowsHide: true })
        const outChunks = []
        const errChunks = []
        let pending = Buffer.alloc(0)

        const emitLines = (final) => {
          for (;;) {
            let eol = -1
            for (let i = 0; i < pending.length; i++) {
              if (pending[i] === 0x0d || pending[i] === 0x0a) {
                eol = i
                break
              }
            }
            if (eol < 0) break
            const line = pending.slice(0, eol).toString('utf8')
            let next = eol + 1
            if (pending[next] === 0x0d) next++
            if (pending[next] === 0x0a) next++
            pending = pending.slice(next)
            if (line.trim()) handlers.onLine(line)
          }
          if (final && pending.length && pending.toString('utf8').trim()) {
            handlers.onLine(pending.toString('utf8'))
          }
        }

        child.stdout.on('data', (d) => {
          outChunks.push(d)
          pending = Buffer.concat([pending, d])
          emitLines(false)
        })
        child.stderr.on('data', (d) => {
          errChunks.push(d)
          const text = d.toString('utf8')
          // 安装器错误往往走 stderr
          for (const l of text.split(/\r?\n/)) if (l.trim()) handlers.onLine(l)
        })
        child.on('error', (err) => {
          resolve({ ok: false, code: -1, output: String(err), cancelled })
        })
        child.on('close', (code) => {
          emitLines(true)
          resolve({
            ok: code === 0,
            code: code ?? -1,
            output: Buffer.concat(outChunks).toString('utf8'),
            stderr: Buffer.concat(errChunks).toString('utf8'),
            cancelled,
          })
        })
      })
  )

  return {
    promise,
    cancel() {
      cancelled = true
      if (child && child.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
      }
    },
  }
}

function prettifyError(text) {
  const line = (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^-+$/.test(l))
    .find((l) => l)
  return line || ''
}

module.exports = { env, search, list, upgrades, show, startAction, parseTable, parseShow, parseProgress }
