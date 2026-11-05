import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getProfile } from '../../lib/api'
import type { Profile } from '../../lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: unknown
  retry: () => void
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [sessionError, setSessionError] = useState<unknown>(null)
  const currentId = useRef<string | null>(null)
  const queryClient = useQueryClient()
  useEffect(() => {
    let active = true
    let receivedEvent = false
    const apply = (next: Session | null) => {
      if (!active) return
      if (currentId.current !== (next?.user.id ?? null)) {
        void queryClient.cancelQueries()
        queryClient.clear()
        currentId.current = next?.user.id ?? null
      }
      setSession(next)
      setInitializing(false)
    }
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      receivedEvent = true
      apply(next)
    })
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || receivedEvent) return
        setSessionError(error)
        apply(data.session)
      })
      .catch((error) => {
        if (active) {
          setSessionError(error)
          setInitializing(false)
        }
      })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])
  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: ({ signal }) => getProfile(session!.user.id, signal),
    enabled: Boolean(session),
    retry: 1,
  })
  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    await queryClient.cancelQueries()
    queryClient.clear()
    setSession(null)
  }
  return (
    <AuthContext.Provider
      value={{
        session,
        profile: profileQuery.data ?? null,
        loading: initializing || (Boolean(session) && profileQuery.isPending),
        error: sessionError ?? profileQuery.error,
        retry: () => {
          setSessionError(null)
          void profileQuery.refetch()
        },
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider missing')
  return auth
}
