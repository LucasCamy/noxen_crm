import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { useCrmMutation } from '../lib/mutations'
import { useUserList } from '../lib/queries'
import type { Role, UserSummary } from '../lib/types'
import { Badge, Button, CreateButton, Dialog, ErrorNote, PageHeader, SelectField, TableSkeleton, TextField } from '../components/ui'
import { ConfirmDialog, FormFooter, useForm } from '../components/common'

const ROLE_HELP: Record<Role, string> = {
  Admin: 'Tudo, inclusive usuários e geração de mensalidades',
  Comercial: 'Leads, clientes e financeiro (leitura e escrita)',
  Marketing: 'Leitura de leads e clientes; escreve campanhas, resultados e reuniões',
}

export function UsersPage() {
  const { user, isAdmin } = useAuth()
  const { data, isPending, isError, refetch } = useUserList(isAdmin)
  const [creating, setCreating] = useState(false)
  const [deactivating, setDeactivating] = useState<UserSummary | null>(null)
  const deactivate = useCrmMutation(
    (u: UserSummary) => api.post(`/api/users/${u.id}/deactivate`),
    ['users', 'users-lookup'],
    'Usuário desativado.',
    () => setDeactivating(null),
  )

  if (!isAdmin) return <ErrorNote message="Somente administradores gerenciam usuários." />

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Quem acessa o CRM e com qual papel"
        actions={<CreateButton onClick={() => setCreating(true)}>Novo usuário</CreateButton>}
      />
      {isPending ? (
        <TableSkeleton rows={4} cols={5} label="Carregando usuários" />
      ) : isError ? (
        <ErrorNote message="Não foi possível carregar os usuários." onRetry={() => void refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">E-mail</th>
                <th scope="col">Papel</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <th scope="row">{u.fullName}</th>
                  <td>{u.email}</td>
                  <td>{u.roles.join(', ')}</td>
                  <td>
                    <Badge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Ativo' : 'Desativado'}</Badge>
                  </td>
                  <td className="row-actions">
                    {u.isActive && u.id !== user?.id && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDeactivating(u)}>
                        Desativar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} title="Novo usuário" description="A senha inicial é definida por você; peça para a pessoa guardá-la em um gerenciador de senhas.">
        {creating && <UserForm onClose={() => setCreating(false)} />}
      </Dialog>
      <ConfirmDialog
        open={!!deactivating}
        title="Desativar usuário?"
        description={deactivating ? `${deactivating.fullName} perde o acesso imediatamente para novos logins e renovações de sessão.` : undefined}
        confirmLabel="Desativar"
        danger
        busy={deactivate.isPending}
        error={deactivate.error?.message}
        onConfirm={() => deactivating && deactivate.mutate(deactivating)}
        onClose={() => setDeactivating(null)}
      />
    </>
  )
}

function UserForm({ onClose }: { onClose: () => void }) {
  const { values, bind } = useForm({ fullName: '', email: '', role: 'Comercial', password: '' })
  const [error, setError] = useState<string | undefined>()
  const create = useCrmMutation(
    () => api.post('/api/users', { email: values.email.trim(), fullName: values.fullName.trim(), password: values.password, role: values.role }),
    ['users', 'users-lookup'],
    'Usuário criado.',
    onClose,
  )
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (values.password.length < 10) return setError('A senha precisa ter ao menos 10 caracteres, com maiúscula, minúscula e número.')
    setError(undefined)
    create.mutate(undefined)
  }
  return (
    <form className="dialog-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <TextField label="Nome" required maxLength={150} autoFocus {...bind('fullName')} />
        <TextField label="E-mail" type="email" required autoComplete="off" {...bind('email')} />
        <SelectField label="Papel" {...bind('role')}>
          {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </SelectField>
        <TextField label="Senha inicial" type="password" required autoComplete="new-password" {...bind('password')} />
      </div>
      <p className="muted small">{ROLE_HELP[values.role as Role]}</p>
      {(error || create.error) && <ErrorNote message={error ?? create.error!.message} />}
      <FormFooter pending={create.isPending} submitLabel="Criar usuário" onCancel={onClose} disabled={!values.fullName.trim() || !values.email.trim() || !values.password} />
    </form>
  )
}
