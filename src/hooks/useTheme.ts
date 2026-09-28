import { useEffect, useState } from 'react'

/** 暗色模式：localStorage 持久化 + 同步原生窗口背景 */
export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('winget-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('winget-theme', dark ? 'dark' : 'light')
    window.winget?.setNativeDark?.(dark)
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}

/** 防抖值 */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
