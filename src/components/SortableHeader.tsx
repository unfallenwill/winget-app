import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc'
export interface SortState<K extends string> {
  key: K
  dir: SortDir
}

interface SortableHeaderProps {
  columns: { key: string; label: string; className?: string; sortable?: boolean }[]
  sort: SortState<string>
  onSort: (key: string) => void
}

export function SortableHeader({ columns, sort, onSort }: SortableHeaderProps) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {columns.map((col) => (
          <TableHead key={col.key} className={cn(col.className)}>
            {col.sortable === false ? (
              col.label
            ) : (
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1 font-medium transition-colors hover:text-foreground"
                onClick={() => onSort(col.key)}
              >
                {col.label}
                {sort.key === col.key ? (
                  sort.dir === 'asc' ? (
                    <ArrowUp className="size-3" />
                  ) : (
                    <ArrowDown className="size-3" />
                  )
                ) : (
                  <ArrowUpDown className="size-3 opacity-30" />
                )}
              </button>
            )}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}
