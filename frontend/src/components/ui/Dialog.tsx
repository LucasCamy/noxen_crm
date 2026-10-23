import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'
import { IconButton } from './Button'
import { ICON } from './icons'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** Formulários longos abrem num painel lateral (sheet), mantendo o contexto da tela. Os demais ficam no centro. */
  wide?: boolean
  children: ReactNode
}

const EXIT_MS = 200

/**
 * Diálogo nativo (<dialog data-lenis-prevent>): foco preso, Esc fecha, fundo inerte. A entrada e a saída são transições CSS
 * (interrompíveis); o conteúdo continua montado por um instante na saída para não "piscar" vazio.
 */
export function Dialog({ open, onClose, title, description, wide, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const frozen = useRef<ReactNode>(children)
  const pressedOnBackdrop = useRef(false)
  const [visible, setVisible] = useState(open)

  if (open) frozen.current = children

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      setVisible(true)
      if (!dialog.open) dialog.showModal()
      return
    }
    if (dialog.open) dialog.close()
    const timer = window.setTimeout(() => setVisible(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <dialog
      ref={ref}
      className={cn('dialog', wide && 'dialog-sheet')}
      aria-labelledby={titleId}
      onClose={onClose}
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === ref.current
      }}
      onClick={(e) => {
        // só fecha se o clique começou e terminou no fundo (selecionar texto e soltar fora não fecha)
        if (e.target === ref.current && pressedOnBackdrop.current) onClose()
      }}
    >
      {(open || visible) && (
        <div className="dialog-inner">
          <header className="dialog-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <IconButton label="Fechar" onClick={onClose}>
              <X size={ICON.chrome} />
            </IconButton>
          </header>
          {frozen.current}
        </div>
      )}
    </dialog>
  )
}
