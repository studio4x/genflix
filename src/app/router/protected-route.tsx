import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import type { RoleCode } from '@/types/auth'

interface ProtectedRouteProps {
  allowedRoles?: RoleCode[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isLoading, user, roles } = useAuth()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.some((role) => roles.includes(role))
  ) {
    return <Navigate to="/nao-autorizado" replace />
  }

  return <Outlet />
}
