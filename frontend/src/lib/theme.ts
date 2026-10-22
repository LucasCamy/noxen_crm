import { useCallback, useSyncExternalStore } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'noxen.theme'

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const listeners = new Set<() => void>()

function apply(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}

/** Preferência de tema (sistema, claro ou escuro). O script /theme-init.js aplica a escolha antes da primeira pintura. */
export function useTheme(): { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } {
  const choice = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => 'system' as ThemeChoice,
  )
  const setChoice = useCallback((c: ThemeChoice) => {
    try {
      if (c === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, c)
    } catch {
      /* sem storage: vale só nesta sessão */
    }
    apply(c)
    listeners.forEach((l) => l())
  }, [])
  return { choice, setChoice }
}
