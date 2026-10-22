import { NavLink, Outlet } from 'react-router-dom'
import { Building2, Filter, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from './ui'

const NAV = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/leads', label: 'Leads', icon: Filter, end: false },
  { to: '/clients', label: 'Clientes', icon: Building2, end: false },
]

export function Layout() {
  const { user, signOut } = useAuth()
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
          {NAV.map(({ to, label, icon: Icon, end }) => (
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
