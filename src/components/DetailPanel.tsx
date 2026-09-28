import { useEffect, useState } from 'react'
import { ArrowRight, ExternalLink, MousePointerClick } from 'lucide-react'
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

/** show 键 → 中文标签 */
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
  版权所有: '版权',
  Copyright: '版权',
  '发行说明 URL': '发行说明',
  'Release Notes Url': '发行说明',
  '安装程序类型': '安装器',
  'Installer Type': '安装器',
  标记: '标签',
  Tags: '标签',
}

const URL_LABELS = new Set(['主页', '许可证链接', '发行说明', '发布者主页', '支持页面', '文档'])

/** Raycast 式右侧详情面板：选中即显示，替代弹窗 */
export function DetailPanel({ row, busy, onInstall, onUpgrade, onUninstall }: DetailPanelProps) {
  const [detail, setDetail] = useState<WingetShow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  if (!row) {
    return (
      <aside className="hidden w-[320px] shrink-0 border-l lg:flex">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <MousePointerClick className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">选择一个程序</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              点击列表中的项目查看详情
              <br />
              或用 <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> 浏览
            </p>
          </div>
        </div>
      </aside>
    )
  }

  const canInstall = !!onInstall
  const canUpgrade = !!onUpgrade && !!row.available

  return (
    <aside className="hidden w-[320px] shrink-0 overflow-hidden border-l lg:block">
      <div className="h-full overflow-y-auto">
        <div className="flex w-full min-w-0 flex-col gap-5 p-5">
          {/* 头部 */}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-semibold',
                packageTint(row.name)
              )}
            >
              {packageInitial(row.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] leading-snug font-semibold break-words">{detail?.title || row.name}</h2>
              <p className="mt-0.5 font-mono text-[11px] break-all text-muted-foreground">{row.id}</p>
            </div>
          </div>

          {/* 操作区 */}
          <div className="flex flex-wrap items-center gap-2">
            {canUpgrade ? (
              <Button size="sm" className="rounded-full" disabled={busy} onClick={() => onUpgrade?.(row)}>
                {busy && <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />}
                升级到 {cleanVersion(row.available) || '最新'}
              </Button>
            ) : canInstall ? (
              <Button size="sm" className="rounded-full" disabled={busy} onClick={() => onInstall?.(row)}>
                {busy && <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />}
                安装
              </Button>
            ) : null}
            {onUninstall && (
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={busy}
                onClick={() => onUninstall?.(row)}
              >
                卸载
              </Button>
            )}
          </div>

          {/* 版本速览 */}
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs">
            <span className="text-muted-foreground">{cleanVersion(row.version) || '未知版本'}</span>
            {row.available && (
              <>
                <ArrowRight className="size-3 text-primary" />
                <Badge className="h-5 bg-primary/12 px-2 text-[11px] text-primary hover:bg-primary/12">
                  {cleanVersion(row.available)}
                </Badge>
              </>
            )}
          </div>

          {/* 详情字段 */}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          )}
          {error && !loading && <p className="text-xs leading-relaxed text-destructive">{error}</p>}
          {detail && !loading && (
            <div className="space-y-3 text-xs">
              {detail.fields.map((f, i) => {
                const label = KEY_LABELS[f.key] ?? f.key
                if (label === '版本' || label === '标签') return null // 已在头部展示的省略
                const first = f.value.split('\n')[0]
                const isUrl = URL_LABELS.has(label) && /^https?:\/\//.test(first)
                return (
                  <div key={i}>
                    <p className="mb-0.5 text-[11px] text-muted-foreground">{label}</p>
                    {isUrl ? (
                      <a
                        href={first}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 break-all text-primary hover:underline"
                      >
                        {first.length > 48 ? first.slice(0, 48) + '…' : first}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ) : (
                      <p className="leading-relaxed break-words break-all whitespace-pre-line">{f.value || '—'}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
