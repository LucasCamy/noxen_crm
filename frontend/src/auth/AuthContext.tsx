import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as session from '../lib/api'
import type { UserInfo } from '../lib/types'

type Status = 'loading' | 'anonymous' | 'authenticated'

interface AuthValue {
  status: Status
  user: UserInfo | null
  /** Admin e Comercial escrevem em leads e clientes; Marketing só lê. */
  canWrite: boolean
  isAdmin: boolean
  /** Cobranças e lançamentos: Admin e Comercial (Marketing não vê o financeiro). */
  canFinance: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let active = true
    session.setAuthLostHandler(() => {
      setUser(null)
      setStatus('anonymous')
      queryClient.clear()
    })
    session.restoreSession().then((restored) => {
      if (!active) return
      setUser(restored)
      setStatus(restored ? 'authenticated' : 'anonymous')
    })
    return () => {
      active = false
      session.setAuthLostHandler(null)
    }
  }, [queryClient])

  const signIn = useCallback(async (email: string, password: string) => {
    const logged = await session.login(email, password)
    setUser(logged)
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(async () => {
    await session.logout()
    queryClient.clear()
    setUser(null)
    setStatus('anonymous')
  }, [queryClient])

  const value = useMemo<AuthValue>(() => {
    const roles = user?.roles ?? []
    return {
      status,
      user,
      canWrite: roles.includes('Admin') || roles.includes('Comercial'),
      isAdmin: roles.includes('Admin'),
      canFinance: roles.includes('Admin') || roles.includes('Comercial'),
      signIn,
      signOut,
    }
  }, [status, user, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
