export { cn } from "cn"

/** 搜索历史（localStorage 持久化，最多 8 条） */
const HISTORY_KEY = 'winget-search-history'

export function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveSearchHistory(history: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 8)))
}

/** 包名 → 首字母/首字（列表图标位） */
export function packageInitial(name: string): string {
  const ch = name.trim().charAt(0)
  return /[a-zA-Z0-9]/.test(ch) ? ch.toUpperCase() : ch
}

/**
 * 按名称哈希到柔和色板（列表/详情图标位）。
 * 静态类名字面量，Tailwind 可直接扫到；底色统一 14–16% 透明度 + 1px 内描边，
 * 与新的暖纸表面叠加时不会糊成一块。
 */
const ICON_TINTS = [
  'bg-chart-1/14 text-chart-1 ring-1 ring-inset ring-chart-1/15',
  'bg-chart-2/16 text-chart-2 ring-1 ring-inset ring-chart-2/20',
  'bg-chart-3/14 text-chart-3 ring-1 ring-inset ring-chart-3/15',
  'bg-chart-4/14 text-chart-4 ring-1 ring-inset ring-chart-4/15',
  'bg-chart-5/14 text-chart-5 ring-1 ring-inset ring-chart-5/15',
]

export function packageTint(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  // 末端雪崩，避免相邻名称（GitHub / GitHub-CLI）落到相邻色
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0
  return ICON_TINTS[h % ICON_TINTS.length]
}

/** 版本号比较：返回 >0 / =0 / <0；空串视为最小 */
export function compareVersions(a?: string, b?: string): number {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  const pa = a.split(/[.\-+]/).filter(Boolean)
  const pb = b.split(/[.\-+]/).filter(Boolean)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i]) || 0
    const nb = Number(pb[i]) || 0
    if (na !== nb) return na - nb
    const sa = pa[i] ?? ""
    const sb = pb[i] ?? ""
    if (na === 0 && na === nb && sa !== sb) return sa.localeCompare(sb)
  }
  return 0
}
