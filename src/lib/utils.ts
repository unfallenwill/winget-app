export { cn } from "cn"

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
