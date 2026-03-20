import { useAuth } from '@/app/providers/auth-provider'

export function AdminDashboardPage() {
  const { profile } = useAuth()

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold text-slate-900">Dashboard admin</h2>
      <p className="text-sm text-slate-600">
        Usuario autenticado: {profile?.full_name ?? profile?.email ?? 'admin'}.
      </p>
      <p className="text-sm text-slate-600">
        Esta etapa contem apenas auth, perfis, papeis e layouts base.
      </p>
    </div>
  )
}
