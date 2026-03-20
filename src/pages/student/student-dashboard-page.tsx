import { useAuth } from '@/app/providers/auth-provider'

export function StudentDashboardPage() {
  const { profile } = useAuth()

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold text-slate-900">Dashboard do aluno</h2>
      <p className="text-sm text-slate-600">
        Bem-vindo, {profile?.full_name ?? profile?.email ?? 'aluno'}.
      </p>
      <p className="text-sm text-slate-600">
        Nesta sprint, apenas a base de autenticacao e permissao foi implementada.
      </p>
    </div>
  )
}
