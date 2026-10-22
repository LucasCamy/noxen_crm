import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useIsFetching } from '@tanstack/react-query'
import {
  BookOpen,
  Buildings,
  CalendarBlank,
  ChatText,
  FilmSlate,
  Funnel,
  Lightbulb,
  MagnifyingGlass,
  Monitor,
  Moon,
  Palette,
  Plus,
  SignOut,
  SquaresFour,
  Sun,
  Users,
  Wallet,
  type Icon,
} from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext'
import { useTheme, type ThemeChoice } from '../lib/theme'
import { Avatar, ICON, IconButton, Skeleton } from './ui'
import { CommandPalette, type Command } from './CommandPalette'

/** Esqueleto mostrado enquanto o código de uma rota é baixado; mantém título e conteúdo no lugar para não haver salto de layout. */
function RouteFallback() {
  return (
    <div role="status" aria-live="polite" aria-label="Carregando página">
      <div className="page-header" aria-hidden>
        <div className="page-header-text">
          <Skeleton h={28} w={180} r={8} />
          <Skeleton h={14} w={280} />
        </div>
      </div>
      <div className="skeleton-stack" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} h={40} />
        ))}
      </div>
    </div>
  )
}

type Need = 'finance' | 'admin' | null
interface NavEntry {
  to: string
  label: string
  icon: Icon
  end?: boolean
  need: Need
}

const NAV_GROUPS: { label: string; items: NavEntry[] }[] = [
  {
    label: 'Geral',
    items: [
      { to: '/', label: 'Painel', icon: SquaresFour, end: true, need: null },
      { to: '/planning', label: 'Planejamento', icon: CalendarBlank, need: null },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { to: '/leads', label: 'Leads', icon: Funnel, need: null },
      { to: '/clients', label: 'Clientes', icon: Buildings, need: null },
      { to: '/finance', label: 'Financeiro', icon: Wallet, need: 'finance' },
      { to: '/scripts', label: 'Scripts', icon: ChatText, need: null },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { to: '/contents', label: 'Conteúdos', icon: FilmSlate, need: null },
      { to: '/studio', label: 'Estúdio', icon: Palette, need: null },
      { to: '/ideas', label: 'Ideias', icon: Lightbulb, need: null },
    ],
  },
  {
    label: 'Agência',
    items: [
      { to: '/knowledge', label: 'Base estratégica', icon: BookOpen, need: null },
      { to: '/users', label: 'Usuários', icon: Users, need: 'admin' },
    ],
  },
]

const THEME_CYCLE: Record<ThemeChoice, { next: ThemeChoice; icon: Icon; label: string }> = {
  system: { next: 'light', icon: Monitor, label: 'Tema: automático (segue o sistema). Trocar para claro' },
  light: { next: 'dark', icon: Sun, label: 'Tema: claro. Trocar para escuro' },
  dark: { next: 'system', icon: Moon, label: 'Tema: escuro. Trocar para automático' },
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function Layout() {
  const { user, signOut, canFinance, isAdmin, canWrite } = useAuth()
  const { choice, setChoice } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const fetching = useIsFetching()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  const visible = (n: NavEntry) => n.need === null || (n.need === 'finance' && canFinance) || (n.need === 'admin' && isAdmin)
  const groups = useMemo(() => NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length > 0), [canFinance, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Título da aba e foco no conteúdo a cada troca de página (leitores de tela e teclado).
  useEffect(() => {
    const all = NAV_GROUPS.flatMap((g) => g.items)
    const match = all.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to) && n.to !== '/'))
    document.title = `${pathname.startsWith('/clients/') ? 'Cliente' : (match?.label ?? 'Noxen CRM')} · Noxen CRM`
    if (firstRender.current) firstRender.current = false
    else mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const commands = useMemo<Command[]>(() => {
    const go: Command[] = groups.flatMap((g) => g.items.map((n) => ({ id: `go-${n.to}`, group: 'Ir para', label: n.label, icon: n.icon, run: () => navigate(n.to) })))
    const create: Command[] = canWrite
      ? [
          { id: 'new-lead', group: 'Criar', label: 'Novo lead', icon: Plus, run: () => navigate('/leads', { state: { action: 'new' } }) },
          { id: 'new-client', group: 'Criar', label: 'Novo cliente', icon: Plus, run: () => navigate('/clients', { state: { action: 'new' } }) },
        ]
      : []
    const other: Command[] = [
      { id: 'new-task', group: 'Criar', label: 'Nova tarefa', icon: Plus, run: () => navigate('/planning', { state: { action: 'new-task' } }) },
      { id: 'theme', group: 'Aparência', label: 'Alternar tema', icon: THEME_CYCLE[choice].icon, run: () => setChoice(THEME_CYCLE[choice].next) },
      { id: 'logout', group: 'Conta', label: 'Sair', icon: SignOut, run: () => void signOut() },
    ]
    return [...go, ...create, ...other]
  }, [groups, canWrite, navigate, choice, setChoice, signOut])

  if (!user) return null
  const theme = THEME_CYCLE[choice]
  const ThemeIcon = theme.icon

  return (
    <div className="shell">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {fetching > 0 && <div className="fetch-bar" aria-hidden />}

      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="Noxen CRM, ir para o painel">
          <span className="brand-mark" aria-hidden>
            N
          </span>
          <span className="brand-name">Noxen CRM</span>
        </Link>

        <button type="button" className="cmd-trigger" onClick={() => setPaletteOpen(true)} aria-label="Abrir busca e comandos">
          <MagnifyingGlass size={ICON.control} aria-hidden />
          <span>Buscar…</span>
          <kbd>{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
        </button>

        <nav className="nav" aria-label="Principal">
          {groups.map((g) => (
            <div key={g.label} className="nav-group" role="group" aria-label={g.label}>
              <span className="nav-label" aria-hidden>
                {g.label}
              </span>
              {g.items.map(({ to, label, icon: IconComponent, end }) => (
                <NavLink key={to} to={to} end={end} className="nav-item" title={label}>
                  <IconComponent size={ICON.chrome} aria-hidden />
                  <span className="nav-text">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <Avatar name={user.fullName} />
            <div className="user-chip-info">
              <strong>{user.fullName}</strong>
              <span>{user.roles.join(', ')}</span>
            </div>
            <IconButton label={theme.label} onClick={() => setChoice(theme.next)}>
              <ThemeIcon size={ICON.chrome} />
            </IconButton>
            <IconButton label="Sair" onClick={() => void signOut()}>
              <SignOut size={ICON.chrome} />
            </IconButton>
          </div>
        </div>
      </aside>

      <main className="main" id="conteudo" ref={mainRef} tabIndex={-1}>
        <div className="main-inner">
          <div className="page" key={pathname}>
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  )
}
