import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Buildings, Funnel, MagnifyingGlass, type Icon } from '@phosphor-icons/react'
import { api, qs } from '../lib/api'
import { useDebounced } from '../lib/useDebounced'
import type { Client, Lead, Paged } from '../lib/types'

export interface Command {
  id: string
  group: string
  label: string
  icon: Icon
  run: () => void
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Props {
  open: boolean
  onClose: () => void
  commands: Command[]
}

/** Paleta de comandos (Ctrl/⌘ + K): navegar, criar e buscar leads e clientes sem tirar a mão do teclado. */
export function CommandPalette({ open, onClose, commands }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const listId = useId()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const q = useDebounced(query.trim(), 200)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    if (!open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const leads = useQuery({
    queryKey: ['palette-leads', q],
    queryFn: () => api.get<Paged<Lead>>(`/api/leads${qs({ search: q, pageSize: 5 })}`),
    enabled: open && q.length >= 2,
  })
  const clients = useQuery({
    queryKey: ['palette-clients', q],
    queryFn: () => api.get<Paged<Client>>(`/api/clients${qs({ search: q, pageSize: 5 })}`),
    enabled: open && q.length >= 2,
  })

  const items = useMemo<Command[]>(() => {
    const needle = normalize(query.trim())
    const own = commands.filter((c) => normalize(c.label).includes(needle))
    const found: Command[] = []
    if (q.length >= 2) {
      for (const l of leads.data?.items ?? [])
        found.push({ id: `lead-${l.id}`, group: 'Leads', label: l.company, icon: Funnel, run: () => navigate('/leads', { state: { leadId: l.id } }) })
      for (const c of clients.data?.items ?? [])
        found.push({ id: `client-${c.id}`, group: 'Clientes', label: c.name, icon: Buildings, run: () => navigate(`/clients/${c.id}`) })
    }
    return [...own, ...found]
  }, [commands, query, q, leads.data, clients.data, navigate])

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const item of items) map.set(item.group, [...(map.get(item.group) ?? []), item])
    return [...map.entries()]
  }, [items])

  const safeActive = Math.min(active, Math.max(items.length - 1, 0))

  function run(item: Command | undefined) {
    if (!item) return
    onClose()
    item.run()
  }

  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label="Paleta de comandos"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <>
          <div className="palette-input">
            <MagnifyingGlass size={18} aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={items[safeActive] ? `${listId}-${safeActive}` : undefined}
              placeholder="Buscar lead, cliente ou página…"
              aria-label="Buscar lead, cliente ou página"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((i) => Math.min(i + 1, items.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((i) => Math.max(i - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  run(items[safeActive])
                }
              }}
            />
            <kbd className="kbd">Esc</kbd>
          </div>
          <div className="palette-list" role="listbox" id={listId} aria-label="Resultados">
            {items.length === 0 ? (
              <p className="palette-empty">{q.length >= 2 && (leads.isPending || clients.isPending) ? 'Buscando…' : 'Nada encontrado.'}</p>
            ) : (
              groups.map(([group, list]) => (
                <div key={group} role="group" aria-label={group}>
                  <div className="palette-group">{group}</div>
                  {list.map((item) => {
                    const index = items.indexOf(item)
                    const IconComponent = item.icon
                    return (
                      <button
                        key={item.id}
                        id={`${listId}-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === safeActive}
                        className="palette-item"
                        onMouseMove={() => setActive(index)}
                        onClick={() => run(item)}
                      >
                        <IconComponent size={18} aria-hidden />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </dialog>
  )
}
