import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { ClientsPage } from './pages/ClientsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ContentsPage } from './pages/ContentsPage'
import { FinancePage } from './pages/FinancePage'
import { IdeasPage } from './pages/IdeasPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { LeadsPage } from './pages/LeadsPage'
import { LoginPage } from './pages/LoginPage'
import { PlanningPage } from './pages/PlanningPage'
import { ScriptsPage } from './pages/ScriptsPage'
import { StudioPage } from './pages/StudioPage'
import { UsersPage } from './pages/UsersPage'

function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <p className="loading loading-full">Carregando…</p>
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Layout />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<DashboardPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="planning" element={<PlanningPage />} />
        <Route path="contents" element={<ContentsPage />} />
        <Route path="ideas" element={<IdeasPage />} />
        <Route path="studio" element={<StudioPage />} />
        <Route path="scripts" element={<ScriptsPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
