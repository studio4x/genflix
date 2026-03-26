import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Acesso negado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Seu usuário não possui permissão para acessar esta área.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">Voltar</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
