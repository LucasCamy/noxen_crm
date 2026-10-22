import { useClients } from '../lib/queries'
import { SelectField } from './ui'

/** Seleção de cliente (até 100 mais recentes por nome). `value` vazio = nenhum. */
export function ClientSelect({ label = 'Cliente (opcional)', value, onChange }: { label?: string; value: string; onChange: (e: { target: { value: string } }) => void }) {
  const clients = useClients('', '', 1, 100)
  return (
    <SelectField label={label} value={value} onChange={onChange}>
      <option value="">Nenhum</option>
      {clients.data?.items.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </SelectField>
  )
}
