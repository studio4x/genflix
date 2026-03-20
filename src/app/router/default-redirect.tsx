import { Navigate } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'

export function DefaultRedirect() {
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

  if (roles.includes('admin')) {
    return <Navigate to="/admin" replace />
  }

  return <Navigate to="/aluno" replace />
}
