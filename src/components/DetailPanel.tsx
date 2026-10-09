import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Download,
  Info,
  Keyboard,
  Link2,
  Loader2,
  MousePointerClick,
  Package,
  RefreshCw,
  ScrollText,
  Tag,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cleanVersion, type WingetRow, type WingetShow } from '@/types'
import { cn, packageInitial, packageTint } from '@/lib/utils'

interface DetailPanelProps {
  row: WingetRow | null
  busy: boolean
  onInstall?: (row: WingetRow) => void
  onUpgrade?: (row: WingetRow) => void
  onUninstall?: (row: WingetRow) => void
}

/** show 键 → 中文标签。winget 会按系统语言返回中/英两套键，故两套都要保留 */
const KEY_LABELS: Record<string, string> = {
  版本: '版本',
  Version: '版本',
  发布者: '发布者',
  Publisher: '发布者',
  '发布服务器 URL': '发布者主页',
  'Publisher Url': '发布者主页',
  作者: '作者',
  Author: '作者',
  绰号: '别名',
  Moniker: '别名',
  描述: '描述',
  Description: '描述',
  主页: '主页',
  Homepage: '主页',
  许可证: '许可证',
  License: '许可证',
  '许可证 URL': '许可证链接',
  'License Url': '许可证链接',
  支持页面: '支持页面',
  'Support Url': '支持页面',
  文档: '文档',
  'Document Url': '文档',
  发行说明: '发行说明',
  '发行说明 URL': '发行说明',
  'Release Notes': '发行说明',
  'Release Notes Url': '发行说明',
  发行日期: '发行日期',
  'Release Date': '发行日期',
  安装程序类型: '安装器',
  'Installer Type': '安装器',
  安装范围: '安装范围',
  'Installer Scope': '安装范围',
  标记: '标签',
  Tags: '标签',
}

const URL_LABELS = new Set(['主页', '许可证链接', '发行说明', '发布者主页', '支持页面', '文档'])

/** 元数据行 / 链接行的展示顺序：命中即排前，未命中的保持 winget 原序追加在后面 */
const FACT_ORDER = ['发布者', '作者', '别名', '许可证', '发行日期', '安装器', '安装范围', '版权', '支持页面', '文档']
const LINK_ORDER = ['主页', '发布者主页', '发行说明', '文档', '支持页面', '许可证链接']

const URL_RE = /^https?:\/\//i
/** 描述超过该长度才出现「展开全文」，避免短描述挂一个无意义的开关 */
const DESC_CLAMP_AT = 190
/** 关键词最多展示数，其余折叠成 +N */
const TAG_LIMIT = 8
/** 面板骨架：无内容 / 有内容 两条分支共用同一外壳，宽度与边框永不跳动 */
const PANEL =
  'hidden w-[340px] shrink-0 overflow-hidden border-l border-border bg-surface-1 lg:flex lg:flex-col'

interface Fact {
  label: string
  value: string
}

interface Link {
  label: string
  url: string
}

interface Detail {
  facts: Fact[]
  links: Link[]
  description: string
  tags: string[]
}

function rankOf(label: string, order: string[]) {
  const i = order.indexOf(label)
  return i < 0 ? order.length : i
}

function parseTags(value: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value.split(/[,;、\s]+/)) {
    const tag = raw.trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

/** URL 只保留主机部分：整条路径塞进 340px 的行里必然截断得看不出所以然 */
function shortUrl(url: string): string {
  const s = url.replace(URL_RE, '').replace(/^www\./i, '')
  return s.length > 40 ? `${s.slice(0, 40)}…` : s
}

/** 把 winget 的平铺 fields 重组成 关键词 / 描述 / 事实 / 链接 四类 */
function readDetail(show: WingetShow): Detail {
  const facts: Fact[] = []
  const links: Link[] = []
  let description = ''
  let tags: string[] = []

  for (const field of show.fields) {
    const label = KEY_LABELS[field.key] ?? field.key
    const value = (field.value ?? '').trim()
    if (!value || label === '版本') continue // 版本由 row 直接给出，不进元数据表
    if (label === '标签') {
      tags = parseTags(value)
      continue
    }
    if (label === '描述') {
      description = value
      continue
    }
    const first = value.split('\n')[0].trim()
    if (URL_LABELS.has(label) || URL_RE.test(first)) {
      if (URL_RE.test(first)) links.push({ label, url: first })
      else facts.push({ label, value })
      continue
    }
    facts.push({ label, value })
  }

  // sort 稳定，同序保持 winget 原始次序
  facts.sort((a, b) => rankOf(a.label, FACT_ORDER) - rankOf(b.label, FACT_ORDER))
  links.sort((a, b) => rankOf(a.label, LINK_ORDER) - rankOf(b.label, LINK_ORDER))
  return { facts, links, description, tags }
}

function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Icon className="size-3 shrink-0" />
      {children}
    </h3>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-border bg-surface-2 px-1 font-mono text-2xs leading-none text-foreground-subtle shadow-well">
      {children}
    </kbd>
  )
}

/** 骨架按真实版式裁剪，切换时轮廓几乎不变 */
function BodySkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-14 rounded-xs" />
        <Skeleton className="h-3 w-full rounded-xs" />
        <Skeleton className="h-3 w-[93%] rounded-xs" />
        <Skeleton className="h-3 w-[64%] rounded-xs" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-16 rounded-xs" />
        <div className="space-y-2.5 rounded-lg border border-border bg-surface-2 p-2.5">
          {[76, 88, 62, 70].map((w) => (
            <div key={w} className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-14 shrink-0 rounded-xs" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-2.5 rounded-xs" style={{ width: `${w}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Raycast 式右侧详情面板：选中即显示，替代弹窗 */
export function DetailPanel({ row, busy, onInstall, onUpgrade, onUninstall }: DetailPanelProps) {
  const [detail, setDetail] = useState<WingetShow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /**
   * 展示用快照：最后一次成功落地的详情 + 它归属的包 id。
   * 快速 ↑↓ 时详情会反复经历 loading→data→换行→loading；若直接把 detail 当渲染源，
   * 面板每次都从空塌陷重建。这里保留上一次的内容（切换期间淡化），只切不塌。
   */
  const [resolved, setResolved] = useState<{ id: string; detail: WingetShow } | null>(null)
  const synced = useRef<WingetShow | null>(null)
  if (detail !== synced.current) {
    synced.current = detail
    if (detail) setResolved({ id: row?.id ?? '', detail })
  }

  // 选中变化 → 防抖拉取详情
  useEffect(() => {
    if (!row?.id) {
      setDetail(null)
      setError('')
      return
    }
    let cancelled = false
    setDetail(null)
    setError('')
    const t = setTimeout(() => {
      setLoading(true)
      window.winget
        .show(row.id)
        .then((d) => !cancelled && setDetail(d))
        .catch((err) => !cancelled && setError(String((err as Error).message || err)))
        .finally(() => !cancelled && setLoading(false))
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [row?.id])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    setExpanded(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [row?.id])

  const rowId = row?.id ?? ''
  // 当前包的详情是否已到位；未到位时 resolved 属于上一个包，只能作淡化底衬
  const current = resolved && resolved.id === rowId ? resolved.detail : null
  const pending = !!row && !current && !error
  const shown = row && !error ? resolved : null
  const meta = useMemo(() => (shown ? readDetail(shown.detail) : null), [shown])

  if (!row) {
    return (
      <aside className={PANEL}>
        <div className="h-0.5 w-full shrink-0 overflow-hidden bg-muted/70" aria-hidden />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-2 text-muted-foreground shadow-s1">
            <MousePointerClick className="size-5" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold tracking-tight">未选择程序</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              在列表中选中一项，这里会显示它的版本、描述与来源。
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span className="mx-0.5">浏览</span>
            <Kbd>↵</Kbd>
            <span>主操作</span>
          </div>
        </div>
      </aside>
    )
  }

  const canInstall = !!onInstall
  const canUpgrade = !!onUpgrade && !!row.available
  const primary = canUpgrade
    ? { label: '升级', Icon: RefreshCw, run: onUpgrade }
    : canInstall
      ? { label: '安装', Icon: Download, run: onInstall }
      : null
  const PrimaryIcon = primary?.Icon

  const version = cleanVersion(row.version)
  const available = cleanVersion(row.available)
  const hasUpdate = !!row.available
  const statusText = loading
    ? '正在读取包详情'
    : error
      ? '读取包详情失败'
      : pending
        ? '等待包详情'
        : '包详情已就绪'

  return (
    <aside className={PANEL}>
      <span className="sr-only" role="status" aria-live="polite">
        {statusText}
      </span>

      {/* 常驻 2px 轨道：占位不参与布局，pending 时才点亮 */}
      <div className="h-0.5 w-full shrink-0 overflow-hidden bg-muted/70" aria-hidden>
        {pending && (
          <div key={row.id} className="motion-required h-full w-full animate-indeterminate bg-primary" />
        )}
      </div>

      {/* ── 身份区 ────────────────────────────────────────── */}
      <header className="shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold',
              packageTint(row.name)
            )}
          >
            {packageInitial(row.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-snug font-semibold tracking-tight text-balance break-words">
              {current?.title || row.name}
            </h2>
            <p
              className="mt-1 font-mono text-2xs leading-4 break-words text-muted-foreground"
              title={row.id}
            >
              {row.id}
            </p>
          </div>
        </div>
      </header>

      {/* ── 主操作 ────────────────────────────────────────── */}
      {(primary || onUninstall) && (
        <div className="flex shrink-0 items-center gap-2 px-4 pb-3">
          {primary && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => primary.run?.(row)}
              className="h-9 min-w-0 flex-1 rounded-md"
            >
              {busy ? (
                <Loader2 className="motion-required size-3.5 animate-spin" />
              ) : (
                PrimaryIcon && <PrimaryIcon className="size-3.5" />
              )}
              <span className="truncate">{primary.label}</span>
            </Button>
          )}
          {onUninstall && (
            <Button
              size="sm"
              variant="soft"
              disabled={busy}
              onClick={() => onUninstall?.(row)}
              className={
                primary
                  ? 'h-9 shrink-0 rounded-md px-3 text-destructive hover:bg-destructive/10 hover:text-destructive'
                  : 'h-9 w-full rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive'
              }
            >
              <Trash2 className="size-3.5" />
              卸载
            </Button>
          )}
        </div>
      )}

      {/* ── 版本 / 更新状态 ───────────────────────────────── */}
      <div className="shrink-0 px-4 pb-4">
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface-2 p-3">
          {/* 金黄只做点缀：有更新时在卡边点一条，不参与任何正文语义 */}
          {hasUpdate && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gold" />}
          <div
            className={cn(
              'grid items-end gap-2 pl-1',
              hasUpdate ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_auto]'
            )}
          >
            <div className="min-w-0">
              <p className="text-2xs leading-4 text-muted-foreground">版本</p>
              <p className="truncate font-mono text-sm leading-5 tabular-nums" title={version}>
                {version || '未知'}
              </p>
            </div>
            {hasUpdate ? (
              <>
                <ArrowRight className="mb-1 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 text-right">
                  <p className="text-2xs leading-4 text-muted-foreground">可更新至</p>
                  <p
                    className="truncate font-mono text-sm leading-5 font-medium tabular-nums text-success"
                    title={available}
                  >
                    {available || '—'}
                  </p>
                </div>
              </>
            ) : (
              <Badge variant="soft" className="mb-0.5 h-5 gap-1 px-1.5 text-2xs font-normal">
                <Package className="size-3" />
                {row.source || '未知来源'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── 详情正文（唯一滚动区） ─────────────────────────── */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pt-1 pb-6">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 p-2.5">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-destructive" />
              <p className="min-w-0 text-xs leading-relaxed break-words text-destructive">{error}</p>
            </div>
          ) : shown && meta ? (
            <div key={shown.id} className="animate-fade-up">
              {/* 换包期间旧内容只淡化不卸载：等宽等高，不产生布局跳动 */}
              <div
                className={cn(
                  'space-y-5 transition-opacity duration-base ease-diasnap',
                  pending && 'opacity-40'
                )}
              >
                {meta.tags.length > 0 && (
                  <section>
                    <SectionLabel icon={Tag}>关键词</SectionLabel>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {meta.tags.slice(0, TAG_LIMIT).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="h-5 max-w-full px-1.5 text-2xs font-normal"
                        >
                          <span className="min-w-0 truncate">{tag}</span>
                        </Badge>
                      ))}
                      {meta.tags.length > TAG_LIMIT && (
                        <Badge
                          variant="ghost"
                          className="h-5 px-1.5 text-2xs font-normal tabular-nums"
                        >
                          +{meta.tags.length - TAG_LIMIT}
                        </Badge>
                      )}
                    </div>
                  </section>
                )}

                {meta.description && (
                  <section>
                    <SectionLabel icon={ScrollText}>描述</SectionLabel>
                    <p
                      className={cn(
                        'mt-1.5 text-sm leading-relaxed whitespace-pre-line break-words text-foreground/85',
                        !expanded && meta.description.length > DESC_CLAMP_AT && 'line-clamp-[8]'
                      )}
                    >
                      {meta.description}
                    </p>
                    {meta.description.length > DESC_CLAMP_AT && (
                      <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="focus-ring mt-1 rounded-xs text-2xs font-medium text-primary transition-colors duration-fast ease-diasnap hover:underline"
                      >
                        {expanded ? '收起' : '展开全文'}
                      </button>
                    )}
                  </section>
                )}

                {meta.facts.length > 0 && (
                  <section>
                    <SectionLabel icon={Info}>元数据</SectionLabel>
                    <dl className="mt-1.5 divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-surface-2">
                      {meta.facts.map((fact) => (
                        <div
                          key={fact.label}
                          className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-2 px-2.5 py-1.5"
                        >
                          <dt className="truncate text-2xs leading-5 text-muted-foreground">
                            {fact.label}
                          </dt>
                          <dd className="min-w-0 text-xs leading-5 break-words text-foreground/90">
                            {fact.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {meta.links.length > 0 && (
                  <section>
                    <SectionLabel icon={Link2}>链接</SectionLabel>
                    <div className="mt-1.5 overflow-hidden rounded-lg border border-border">
                      {meta.links.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          title={link.url}
                          className="focus-ring group flex items-center gap-2 border-b border-border px-2.5 py-1.5 transition-colors duration-fast ease-diasnap last:border-b-0 hover:bg-surface-3"
                        >
                          <span className="w-[4.25rem] shrink-0 truncate text-2xs text-muted-foreground">
                            {link.label}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-foreground/85 group-hover:text-primary">
                            {shortUrl(link.url)}
                          </span>
                          <ArrowUpRight className="size-3 shrink-0 text-muted-foreground/70 transition-colors duration-fast group-hover:text-primary" />
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {meta.tags.length === 0 &&
                  !meta.description &&
                  meta.facts.length === 0 &&
                  meta.links.length === 0 && (
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                      <Keyboard className="mt-px size-3.5 shrink-0" />
                      <span>
                        该来源未提供更多信息，可按 <Kbd>↵</Kbd> 直接执行主操作。
                      </span>
                    </p>
                  )}
              </div>
            </div>
          ) : (
            <BodySkeleton />
          )}
        </div>
      </div>
    </aside>
  )
}
