import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cleanVersion, type WingetRow, type WingetShow } from '@/types'

interface PackageDetailDialogProps {
  row: WingetRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** show 键 → 中文标签（未知键原样显示） */
const KEY_LABELS: Record<string, string> = {
  版本: '版本',
  Version: '版本',
  发布者: '发布者',
  Publisher: '发布者',
  '发布服务器 URL': '发布者主页',
  'Publisher Url': '发布者主页',
  '发布服务器支持 URL': '支持页面',
  'Publisher Support Url': '支持页面',
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
  '版权 URL': '版权链接',
  'Copyright Url': '版权链接',
  '发行说明 URL': '发行说明',
  'Release Notes Url': '发行说明',
  文档: '文档',
  标记: '标签',
  Tags: '标签',
  '安装程序类型': '安装器类型',
  'Installer Type': '安装器类型',
  '安装程序 URL': '安装包下载',
  'Installer Url': '安装包下载',
  '安装程序 SHA256': 'SHA256',
  'Installer SHA256': 'SHA256',
}

const URL_KEYS = new Set(['主页', '许可证链接', '发行说明', '发布者主页', '支持页面', '文档', '安装包下载', '版权链接'])

export function PackageDetailDialog({ row, open, onOpenChange }: PackageDetailDialogProps) {
  const [detail, setDetail] = useState<WingetShow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !row) return
    if (!row.id) {
      setError('该条目缺少包 ID，无法加载详情')
      return
    }
    let cancelled = false
    setDetail(null)
    setError('')
    setLoading(true)
    window.winget
      .show(row.id)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(String((err as Error).message || err)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, row])

  if (!row) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2 text-lg">
            {detail?.title || row.name}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{row.id}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-3">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          )}
          {error && !loading && <p className="text-sm text-destructive">加载详情失败：{error}</p>}
          {detail && !loading && (
            <div className="space-y-1 text-sm">
              {detail.fields.map((f, i) => {
                const label = KEY_LABELS[f.key] ?? f.key
                const isUrl = URL_KEYS.has(label) && /^https?:\/\//.test(f.value.split('\n')[0])
                return (
                  <div key={i} className="grid grid-cols-[110px_1fr] gap-2 py-1.5">
                    <span className="shrink-0 text-muted-foreground">{label}</span>
                    <div className="min-w-0">
                      {isUrl ? (
                        <a
                          href={f.value.split('\n')[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 break-all text-primary hover:underline"
                        >
                          {f.value.split('\n')[0]}
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="break-words whitespace-pre-line">{f.value || '—'}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        <Separator />
        <DialogFooter className="text-xs text-muted-foreground">
          <span>
            当前版本 {cleanVersion(row.version) || '未知'}
            {row.available ? ` · 可更新至 ${cleanVersion(row.available)}` : ''}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
