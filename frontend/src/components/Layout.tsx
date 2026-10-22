import { NavLink, Outlet } from 'react-router-dom'
import { Building2, Filter, LayoutDashboard, LogOut, Users, Wallet } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from './ui'

const NAV = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true, need: null },
  { to: '/leads', label: 'Leads', icon: Filter, end: false, need: null },
  { to: '/clients', label: 'Clientes', icon: Building2, end: false, need: null },
  { to: '/finance', label: 'Financeiro', icon: Wallet, end: false, need: 'finance' },
  { to: '/users', label: 'Usuários', icon: Users, end: false, need: 'admin' },
] as const

export function Layout() {
  const { user, signOut, canFinance, isAdmin } = useAuth()
  if (!user) return null

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            N
          </span>
          <span className="brand-name">Noxen CRM</span>
        </div>
        <nav aria-label="Principal" className="nav">
          {NAV.filter((n) => n.need === null || (n.need === 'finance' && canFinance) || (n.need === 'admin' && isAdmin)).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
              <Icon size={20} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-user">
          <Avatar name={user.fullName} />
          <div className="sidebar-user-info">
            <strong>{user.fullName}</strong>
            <span>{user.roles.join(', ')}</span>
          </div>
          <button type="button" className="icon-btn icon-btn-dark" aria-label="Sair" onClick={() => void signOut()}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="main" id="conteudo">
        <Outlet />
      </main>
    </div>
  )
}
