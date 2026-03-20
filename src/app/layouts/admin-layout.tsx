import { Link, Outlet } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'

export function AdminLayout() {
  const { profile, signOut } = useAuth()

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-slate-900 text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between p-4">
          <div>
            <p className="text-sm text-slate-300">Painel admin</p>
            <h1 className="text-lg font-semibold">HomeCare Match LMS</h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-300">{profile?.email}</p>
            <Button type="button" variant="secondary" onClick={() => void signOut()}>
              Sair
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl gap-6 p-6">
        <aside className="w-64 rounded-lg border bg-white p-4">
          <nav className="flex flex-col gap-2 text-sm">
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/admin">
              Dashboard
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/admin/cursos">
              Cursos
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/admin/alunos">
              Alunos
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/admin/grupos">
              Grupos
            </Link>
          </nav>
        </aside>
        <section className="flex-1 rounded-lg border bg-white p-6">
          <Outlet />
        </section>
      </div>
    </main>
  )
}
