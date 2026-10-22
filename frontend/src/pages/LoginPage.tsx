import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'
import { Check } from '@phosphor-icons/react'
import { Button, ErrorNote, TextField } from '../components/ui'

export function LoginPage() {
  const { status, signIn } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'authenticated') return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError('E-mail ou senha inválidos.')
      else if (err instanceof ApiError && err.status === 423)
        setError('Conta bloqueada por tentativas inválidas. Tente de novo em 15 minutos.')
      else if (err instanceof ApiError) setError(err.message)
      else setError('Não foi possível conectar ao servidor. Verifique sua conexão.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <section className="login-brand" aria-hidden>
        <div className="brand">
          <span className="brand-mark">N</span>
          <span className="brand-name">Noxen CRM</span>
        </div>
        <div className="login-pitch">
          <h2>Mais clientes, mais faturamento.</h2>
          <ul className="login-points">
            <li>
              <Check size={16} weight="bold" aria-hidden />
              <span>Funil de prospecção e follow-ups sem esquecer ninguém.</span>
            </li>
            <li>
              <Check size={16} weight="bold" aria-hidden />
              <span>Carteira, mensalidades e MRR em tempo real.</span>
            </li>
            <li>
              <Check size={16} weight="bold" aria-hidden />
              <span>Agenda, conteúdos e metas da equipe no mesmo lugar.</span>
            </li>
          </ul>
        </div>
        <small className="muted">Noxen Assessoria, Campo Grande (MS)</small>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={onSubmit} noValidate>
          <h1>Entrar</h1>
          <p className="login-sub">Use o e-mail e a senha cadastrados pelo administrador.</p>
          {error && (
            <ErrorNote message={error} />
          )}
          <TextField
            label="E-mail"
            type="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@noxen.com.br"
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="primary" block loading={busy} disabled={!email || !password}>
            Entrar
          </Button>
        </form>
      </section>
    </div>
  )
}
