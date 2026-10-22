import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import { IconButton } from './ui'

type Kind = 'success' | 'error'
interface ToastItem {
  id: number
  kind: Kind
  message: string
  leaving: boolean
}

const LEAVE_MS = 130
const ToastContext = createContext<((message: string, kind?: Kind) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), LEAVE_MS)
  }, [])

  const push = useCallback(
    (message: string, kind: Kind = 'success') => {
      const id = nextId.current++
      setItems((list) => [...list.slice(-3), { id, kind, message, leaving: false }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )
  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}${t.leaving ? ' leaving' : ''}`}>
            {t.kind === 'error' ? <WarningCircle size={18} weight="fill" aria-hidden /> : <CheckCircle size={18} weight="fill" aria-hidden />}
            <span>{t.message}</span>
            <IconButton label="Fechar aviso" onClick={() => dismiss(t.id)}>
              <X size={16} />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
