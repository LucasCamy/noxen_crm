import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { BRAZILIAN_STATES } from '../lib/domain'
import { fromDateTimeLocal, parseMoney, toDateTimeLocal } from '../lib/format'
import type { Client, ClientInput, UserLookup } from '../lib/types'
import { ErrorNote, SelectField, TextAreaField, TextField } from './ui'
import { useToast } from './Toast'

interface Values {
  name: string
  legalName: string
  cnpj: string
  segment: string
  city: string
  state: string
  contactName: string
  contactWhatsapp: string
  implementationFee: string
  monthlyFee: string
  dueDay: string
  nextMeeting: string
  responsibleId: string
  notes: string
}

const money = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','))

function toValues(c: Client | undefined, defaultResponsible: string): Values {
  return {
    name: c?.name ?? '',
    legalName: c?.legalName ?? '',
    cnpj: c?.cnpj ?? '',
    segment: c?.segment ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
    contactName: c?.contactName ?? '',
    contactWhatsapp: c?.contactWhatsapp ?? '',
    implementationFee: money(c?.implementationFee),
    monthlyFee: money(c?.monthlyFee),
    dueDay: String(c?.dueDay ?? 10),
    nextMeeting: toDateTimeLocal(c?.nextMeeting),
    responsibleId: c?.responsibleId ?? defaultResponsible,
    notes: c?.notes ?? '',
  }
}

interface Props {
  client?: Client
  users: UserLookup[]
  currentUserId: string
  canWrite: boolean
  onSaved: (client: Client) => void
  onCancel?: () => void
}

export function ClientForm({ client, users, currentUserId, canWrite, onSaved, onCancel }: Props) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => toValues(client, currentUserId))
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({})
  const set = <K extends keyof Values>(key: K) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  const save = useMutation({
    mutationFn: (body: ClientInput) =>
      client ? api.put<Client>(`/api/clients/${client.id}`, { ...body, version: client.version }) : api.post<Client>('/api/clients', body),
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['client', saved.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
      toast(client ? 'Cliente atualizado.' : 'Cliente cadastrado.')
      onSaved(saved)
    },
    onError: async (err) => {
      if (err instanceof ApiError && err.status === 409 && client) {
        await queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      }
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    const implementationFee = parseMoney(values.implementationFee) ?? 0
    const monthlyFee = parseMoney(values.monthlyFee)
    if (values.name.trim() === '') next.name = 'Informe o nome.'
    if (monthlyFee === null || monthlyFee < 0) next.monthlyFee = 'Informe a mensalidade.'
    if (implementationFee < 0) next.implementationFee = 'Não pode ser negativo.'
    const cnpjDigits = values.cnpj.replace(/\D/g, '')
    if (cnpjDigits !== '' && cnpjDigits.length !== 14) next.cnpj = 'O CNPJ precisa ter 14 dígitos.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const blank = (s: string) => (s.trim() === '' ? null : s.trim())
    save.mutate({
      name: values.name.trim(),
      legalName: blank(values.legalName),
      cnpj: cnpjDigits === '' ? null : cnpjDigits,
      segment: blank(values.segment),
      city: blank(values.city),
      state: blank(values.state),
      contactName: blank(values.contactName),
      contactWhatsapp: blank(values.contactWhatsapp),
      implementationFee,
      monthlyFee: monthlyFee!,
      dueDay: Number(values.dueDay),
      nextMeeting: fromDateTimeLocal(values.nextMeeting),
      responsibleId: blank(values.responsibleId),
      notes: blank(values.notes),
    })
  }

  const conflict = save.error instanceof ApiError && save.error.status === 409

  return (
    <form onSubmit={onSubmit} className="dialog-form" noValidate>
      <fieldset disabled={!canWrite || save.isPending} className="form-grid">
        <legend className="sr-only">Dados do cliente</legend>
        <div className="span-2">
          <TextField label="Nome" required maxLength={200} value={values.name} onChange={set('name')} error={errors.name} autoFocus={!client} />
        </div>
        <TextField label="Razão social" maxLength={200} value={values.legalName} onChange={set('legalName')} />
        <TextField label="CNPJ" inputMode="numeric" maxLength={18} value={values.cnpj} onChange={set('cnpj')} error={errors.cnpj} placeholder="00.000.000/0000-00" />
        <TextField label="Segmento" maxLength={100} value={values.segment} onChange={set('segment')} />
        <TextField label="Cidade" maxLength={100} value={values.city} onChange={set('city')} />
        <SelectField label="UF" value={values.state} onChange={set('state')}>
          <option value="">—</option>
          {BRAZILIAN_STATES.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </SelectField>
        <SelectField label="Responsável" value={values.responsibleId} onChange={set('responsibleId')}>
          <option value="">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </SelectField>
        <TextField label="Contato principal" maxLength={150} value={values.contactName} onChange={set('contactName')} />
        <TextField label="WhatsApp do contato" inputMode="tel" maxLength={30} value={values.contactWhatsapp} onChange={set('contactWhatsapp')} />
        <TextField label="Implementação (R$)" inputMode="decimal" value={values.implementationFee} onChange={set('implementationFee')} error={errors.implementationFee} />
        <TextField label="Mensalidade (R$)" inputMode="decimal" required value={values.monthlyFee} onChange={set('monthlyFee')} error={errors.monthlyFee} />
        <SelectField label="Dia de vencimento" value={values.dueDay} onChange={set('dueDay')}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </SelectField>
        <TextField label="Próxima reunião" type="datetime-local" value={values.nextMeeting} onChange={set('nextMeeting')} />
        <div className="span-2">
          <TextAreaField label="Observações" rows={3} maxLength={4000} value={values.notes} onChange={set('notes')} />
        </div>
      </fieldset>

      {conflict ? (
        <ErrorNote message="Este cliente foi alterado por outra pessoa. Os dados foram recarregados; revise e salve de novo." />
      ) : save.error ? (
        <ErrorNote message={save.error.message} />
      ) : null}

      {canWrite && (
        <footer className="dialog-footer">
          <span className="spacer" />
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : client ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
        </footer>
      )}
    </form>
  )
}
