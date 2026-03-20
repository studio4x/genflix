import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'

export function AdminDashboardPage() {
  const { profile } = useAuth()

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold text-slate-900">Dashboard admin</h2>
      <p className="text-sm text-slate-600">
        Usuario autenticado: {profile?.full_name ?? profile?.email ?? 'admin'}.
      </p>
      <p className="text-sm text-slate-600">
        Sprint 2 em andamento: CRUD de cursos, modulos, aulas e materiais.
      </p>
      <div className="pt-2">
        <Button type="button" asChild>
          <Link to="/admin/cursos">Ir para cursos</Link>
        </Button>
      </div>
    </div>
  )
}
