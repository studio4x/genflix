import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from '@/services/supabase/client'
import type { Profile, RoleCode } from '@/types/auth'

interface AuthContextValue {
  isLoading: boolean
  user: User | null
  session: Session | null
  profile: Profile | null
  roles: RoleCode[]
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

type RoleRow = { code: string }
type RoleRelationRow = { roles: RoleRow | RoleRow[] | null }

function extractRoles(data: RoleRelationRow[]): RoleCode[] {
  const roleCodes = data
    .flatMap((item) => {
      if (!item.roles) {
        return []
      }
      return Array.isArray(item.roles) ? item.roles : [item.roles]
    })
    .map((role) => role.code)
    .filter((code): code is RoleCode => code === 'admin' || code === 'student')

  return Array.from(new Set(roleCodes))
}

async function loadProfileAndRoles(userId: string) {
  const [profileResult, rolesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, timezone, locale')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('roles(code)')
      .eq('user_id', userId),
  ])

  if (profileResult.error) {
    throw profileResult.error
  }

  if (rolesResult.error) {
    throw rolesResult.error
  }

  const profile = profileResult.data as Profile | null
  const roles = extractRoles((rolesResult.data as RoleRelationRow[]) ?? [])

  return { profile, roles }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<RoleCode[]>([])
  const syncVersionRef = useRef(0)

  const syncAuthState = useCallback(async (nextSession: Session | null) => {
    const syncVersion = ++syncVersionRef.current
    setIsLoading(true)
    setSession(nextSession)
    setUser(nextSession?.user ?? null)

    if (!nextSession?.user) {
      if (syncVersion === syncVersionRef.current) {
        setProfile(null)
        setRoles([])
        setIsLoading(false)
      }
      return
    }

    setProfile(null)
    setRoles([])

    try {
      const context = await loadProfileAndRoles(nextSession.user.id)
      if (syncVersion === syncVersionRef.current) {
        setProfile(context.profile)
        setRoles(context.roles)
      }
    } catch {
      if (syncVersion === syncVersionRef.current) {
        setProfile(null)
        setRoles([])
      }
    } finally {
      if (syncVersion === syncVersionRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function initialize() {
      const result = await supabase.auth.getSession()
      if (!isMounted) {
        return
      }
      await syncAuthState(result.data.session)
    }

    initialize().catch(() => setIsLoading(false))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [syncAuthState])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      throw result.error
    }
  }, [])

  const signOut = useCallback(async () => {
    const result = await supabase.auth.signOut()
    if (result.error) {
      throw result.error
    }
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/redefinir-senha`
    const result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (result.error) {
      throw result.error
    }
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const result = await supabase.auth.updateUser({ password: newPassword })
    if (result.error) {
      throw result.error
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      user,
      session,
      profile,
      roles,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [isLoading, profile, requestPasswordReset, roles, session, signIn, signOut, updatePassword, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
