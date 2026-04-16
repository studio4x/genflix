import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  createAdminUser,
  fetchAdminUsers,
  toErrorMessage,
  updateAdminUserRole,
  type AdminAssignableRoleCode,
  type AdminUserListItem,
  type AdminUserRole,
  type CreateAdminUserResponse,
} from '@/features/admin/users/api'
import { createAdminUserFormSchema } from '@/features/admin/users/schemas'
import { toTranslatedAuthError } from '@/features/auth/auth-error-messages'
import { supabase } from '@/services/supabase/client'

type RoleFilter = 'all' | AdminAssignableRoleCode | 'without-role'

interface UserFormState {
  email: string
  fullName: string
  password: string
  roleCode: AdminAssignableRoleCode
}

interface PasswordResetFeedback {
  email: string
}

const initialForm: UserFormState = {
  email: '',
  fullName: '',
  password: '',
  roleCode: 'aluno',
}

const roleOptions: Array<{
  code: AdminAssignableRoleCode
  title: string
  description: string
}> = [
  {
    code: 'aluno',
    title: 'Aluno',
    description: 'Acessa cursos liberados, aulas, quizzes e progresso.',
  },
  {
    code: 'criador',
    title: 'Criador',
    description: 'Acompanha relatorios dos cursos vinculados e edita o proprio perfil.',
  },
  {
    code: 'admin',
    title: 'Admin',
    description: 'Acesso completo ao painel administrativo da plataforma.',
  },
]

const roleFilters: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'admin', label: 'Admins' },
  { value: 'aluno', label: 'Alunos' },
  { value: 'criador', label: 'Criadores' },
  { value: 'without-role', label: 'Sem role' },
]

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Não informado'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Não informado'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function getRoleBadgeClass(roleCode: string) {
  if (roleCode === 'admin') {
    return 'border-[#D9F0F5] bg-[#E8F6FA] text-[#1398B7]'
  }
  if (roleCode === 'criador' || roleCode === 'professor') {
    return 'border-[#c7ddff] bg-[#eff6ff] text-[#1d4ed8]'
  }
  if (roleCode === 'aluno' || roleCode === 'student') {
    return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
  }
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function getRoleLabel(role: AdminUserRole) {
  if (role.code === 'student') {
    return 'Aluno legado'
  }
  if (role.code === 'professor') {
    return 'Criador legado'
  }
  return role.name || role.code
}

function userMatchesRoleFilter(user: AdminUserListItem, roleFilter: RoleFilter) {
  if (roleFilter === 'all') {
    return true
  }
  if (roleFilter === 'without-role') {
    return user.roles.length === 0
  }
  if (roleFilter === 'aluno') {
    return user.roles.some((role) => role.code === 'aluno' || role.code === 'student')
  }
  if (roleFilter === 'criador') {
    return user.roles.some((role) => role.code === 'criador' || role.code === 'professor')
  }
  return user.roles.some((role) => role.code === roleFilter)
}

function getPrimaryRoleLabel(roleCode: AdminAssignableRoleCode) {
  return roleOptions.find((role) => role.code === roleCode)?.title ?? roleCode
}

export function AdminUsersPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [form, setForm] = useState<UserFormState>(initialForm)
  const [created, setCreated] = useState<CreateAdminUserResponse | null>(null)
  const [passwordResetFeedback, setPasswordResetFeedback] = useState<PasswordResetFeedback | null>(null)
  const [editingRoleUser, setEditingRoleUser] = useState<AdminUserListItem | null>(null)
  const [roleEditCode, setRoleEditCode] = useState<AdminAssignableRoleCode>('aluno')
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  async function loadUsers() {
    if (!session) {
      setUsers([])
      setError('Sessão expirada. Faça login novamente.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchAdminUsers(session)
      setUsers(result)
    } catch (loadError) {
      setError(toErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const summary = useMemo(() => {
    return users.reduce(
      (accumulator, user) => {
        const roleCodes = new Set(user.roles.map((role) => role.code))
        return {
          total: accumulator.total + 1,
          admins: accumulator.admins + (roleCodes.has('admin') ? 1 : 0),
          alunos: accumulator.alunos + (roleCodes.has('aluno') || roleCodes.has('student') ? 1 : 0),
          criadores: accumulator.criadores + (roleCodes.has('criador') || roleCodes.has('professor') ? 1 : 0),
          semRole: accumulator.semRole + (roleCodes.size === 0 ? 1 : 0),
        }
      },
      {
        total: 0,
        admins: 0,
        alunos: 0,
        criadores: 0,
        semRole: 0,
      },
    )
  }, [users])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.email.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
        user.id.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
        (user.full_name ?? '').toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
        user.roles.some((role) => `${role.code} ${role.name}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch))

      return matchesSearch && userMatchesRoleFilter(user, roleFilter)
    })
  }, [roleFilter, search, users])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!session) {
      setFormError('Sessão expirada. Faça login novamente.')
      return
    }

    const parsed = createAdminUserFormSchema.safeParse({
      email: form.email.trim().toLowerCase(),
      fullName: form.fullName.trim() || undefined,
      password: form.password.trim() || undefined,
      roleCode: form.roleCode,
    })

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    setIsSubmitting(true)
    setFormError(null)
    setCreated(null)
    setPasswordResetFeedback(null)

    try {
      const result = await createAdminUser(parsed.data, session)
      setCreated(result)
      setForm(initialForm)
      await loadUsers()
    } catch (submitError) {
      setFormError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetUserPassword(user: AdminUserListItem) {
    if (!session) {
      setError('Sessão expirada. Faça login novamente.')
      return
    }

    if (!user.email) {
      setError('Este usuário não possui e-mail cadastrado para redefinição.')
      return
    }

    const shouldSendResetEmail = window.confirm(
      `Enviar um e-mail de redefinição de senha para ${user.full_name?.trim() || user.email}? O próprio usuário criará a nova senha pelo link recebido.`,
    )

    if (!shouldSendResetEmail) {
      return
    }

    setResettingUserId(user.id)
    setError(null)
    setPasswordResetFeedback(null)

    try {
      const result = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      if (result.error) {
        throw result.error
      }
      setPasswordResetFeedback({ email: user.email })
    } catch (resetError) {
      setError(toErrorMessage(toTranslatedAuthError(resetError, 'Não foi possível enviar a redefinição de senha.')))
    } finally {
      setResettingUserId(null)
    }
  }

  function startRoleEdit(user: AdminUserListItem) {
    const roleCodes = new Set(user.roles.map((role) => role.code))
    const currentRole: AdminAssignableRoleCode = roleCodes.has('admin')
      ? 'admin'
      : roleCodes.has('criador') || roleCodes.has('professor')
        ? 'criador'
        : 'aluno'

    setEditingRoleUser(user)
    setRoleEditCode(currentRole)
    setPasswordResetFeedback(null)
  }

  async function handleUpdateRole() {
    if (!session) {
      setError('Sessao expirada. Faca login novamente.')
      return
    }

    if (!editingRoleUser) {
      return
    }

    const targetUser = editingRoleUser
    setUpdatingRoleUserId(targetUser.id)
    setError(null)

    try {
      await updateAdminUserRole(targetUser.id, roleEditCode, session)
      setEditingRoleUser(null)
      await loadUsers()
    } catch (roleError) {
      setError(toErrorMessage(roleError))
    } finally {
      setUpdatingRoleUserId(null)
    }
  }

  async function copyText(value: string, onCopied: () => void) {
    try {
      await navigator.clipboard.writeText(value)
      onCopied()
    } catch {
      setError('Não foi possível copiar automaticamente. Copie manualmente.')
    }
  }

  return (
    <div className="space-y-7 pb-8">
      <header className="flex flex-col gap-3 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#1398B7]">Admin / Usuários</p>
          <h2 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">
            Usuários e Regras
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-medium text-[#6d7a80]">
            Cadastre usuarios como aluno, criador ou admin e acompanhe as roles atribuidas em um unico lugar.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadUsers()}
          disabled={isLoading}
          className="rounded-2xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]"
        >
          {isLoading ? 'Atualizando...' : 'Atualizar lista'}
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-[26px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Usuários</p>
          <p className="mt-3 text-3xl font-black text-[#15323b]">{summary.total}</p>
        </article>
        <article className="rounded-[26px] border border-[#D9F0F5] bg-[#E8F6FA] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1398B7]">Admins</p>
          <p className="mt-3 text-3xl font-black text-[#0A3640]">{summary.admins}</p>
        </article>
        <article className="rounded-[26px] border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Alunos</p>
          <p className="mt-3 text-3xl font-black text-emerald-800">{summary.alunos}</p>
        </article>
        <article className="rounded-[26px] border border-blue-100 bg-blue-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Criadores</p>
          <p className="mt-3 text-3xl font-black text-blue-800">{summary.criadores}</p>
        </article>
        <article className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Sem role</p>
          <p className="mt-3 text-3xl font-black text-slate-800">{summary.semRole}</p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="rounded-[30px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block">
              <span className="sr-only">Buscar usuário</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-semibold text-[#163138] outline-none transition focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                placeholder="Buscar por nome, e-mail, ID ou role"
              />
            </label>

            <label className="block">
              <span className="sr-only">Filtrar por role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-black text-[#163138] outline-none transition focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
              >
                {roleFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {passwordResetFeedback ? (
            <div className="mt-5 rounded-[26px] border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">E-mail enviado</p>
                  <p className="mt-1 text-sm font-bold text-emerald-900">
                    Enviamos um link de redefinição para {passwordResetFeedback.email}.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPasswordResetFeedback(null)}
                  className="rounded-2xl border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                >
                  Fechar
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[30px] border border-[#D8E6EB] bg-[#F2F7F9] p-5 shadow-sm">
          {created ? (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Usuário criado</p>
                <h3 className="mt-1 font-readex text-xl font-semibold text-emerald-950">
                  {getPrimaryRoleLabel(created.role_code)} cadastrado
                </h3>
                <p className="mt-2 text-sm font-semibold text-emerald-800">{created.email}</p>
              </div>

              {created.temporary_password ? (
                <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Senha de acesso</p>
                  <code className="mt-2 block overflow-x-auto rounded-xl bg-emerald-50 px-3 py-2 font-mono text-sm font-black text-emerald-800">
                    {created.temporary_password}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void copyText(created.temporary_password ?? '', () => undefined)}
                    className="mt-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                  >
                    Copiar senha
                  </Button>
                </div>
              ) : (
                <p className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm font-bold text-emerald-800">
                  Senha definida manualmente no cadastro.
                </p>
              )}

              <Button
                type="button"
                onClick={() => setCreated(null)}
                className="w-full rounded-2xl bg-[#15323b] hover:bg-[#0f252d]"
              >
                Cadastrar outro usuário
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Novo usuário</p>
                <h3 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Cadastrar acesso</h3>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Tipo de usuário</span>
                <div className="grid gap-2">
                  {roleOptions.map((role) => {
                    const isSelected = form.roleCode === role.code
                    return (
                      <button
                        key={role.code}
                        type="button"
                        onClick={() => setForm((previous) => ({ ...previous, roleCode: role.code }))}
                        className={`rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-[#1398B7] bg-white shadow-[0_12px_28px_rgba(19,152,183,0.12)]'
                            : 'border-[#D8E6EB] bg-white/70 hover:border-[#1398B7]/40'
                        }`}
                      >
                        <span className="font-readex text-sm font-semibold text-[#15323b]">{role.title}</span>
                        <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#6d7a80]">
                          {role.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">E-mail</span>
                <input
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                  type="email"
                  placeholder="nome@email.com"
                  value={form.email}
                  onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nome completo</span>
                <input
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                  type="text"
                  placeholder="Ex: Joana Lima"
                  value={form.fullName}
                  onChange={(event) => setForm((previous) => ({ ...previous, fullName: event.target.value }))}
                  maxLength={120}
                />
              </label>

              <label className="block space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Senha</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">Gerada se vazio</span>
                </div>
                <input
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                  type="text"
                  placeholder="Ex: GenFlix@2026!"
                  value={form.password}
                  onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                />
              </label>

              {formError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {formError}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-2xl bg-[#1398B7] font-black hover:bg-[#0A3640]"
              >
                {isSubmitting ? 'Processando...' : 'Cadastrar usuário'}
              </Button>
            </form>
          )}
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {editingRoleUser ? (
        <section className="rounded-[30px] border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-700">Editar role</p>
              <h3 className="mt-1 font-readex text-xl font-semibold text-blue-950">
                {editingRoleUser.full_name?.trim() || editingRoleUser.email}
              </h3>
              <p className="mt-1 text-sm font-semibold text-blue-900">{editingRoleUser.email}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={roleEditCode}
                onChange={(event) => setRoleEditCode(event.target.value as AdminAssignableRoleCode)}
                className="h-12 min-w-[220px] rounded-2xl border border-blue-200 bg-white px-4 text-sm font-black text-[#15323b] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                {roleOptions.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.title}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                onClick={() => void handleUpdateRole()}
                disabled={updatingRoleUserId === editingRoleUser.id}
                className="h-12 rounded-2xl bg-blue-700 px-5 font-black hover:bg-blue-800"
              >
                {updatingRoleUserId === editingRoleUser.id ? 'Salvando...' : 'Salvar role'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRoleUser(null)}
                className="h-12 rounded-2xl border-blue-200 bg-white font-black text-blue-900 hover:bg-blue-100"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-sm">
        <div className="border-b border-[#D8E6EB] px-5 py-4">
          <p className="text-sm font-bold text-[#6d7a80]">
            {filteredUsers.length} usuário(s) encontrado(s)
          </p>
        </div>

        {isLoading ? (
          <div className="flex h-44 items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#1398B7] border-t-transparent" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-sm font-bold text-[#5F7077]">
            Nenhum usuário encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#D8E6EB]">
              <thead className="bg-[#F2F7F9]">
                <tr>
                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Usuário</th>
                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Roles</th>
                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Criado em</th>
                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">ID</th>
                  <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF4F6]">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="align-top transition-colors hover:bg-[#F2F7F9]">
                    <td className="px-5 py-5">
                      <div className="min-w-[240px]">
                        <p className="font-readex text-base font-semibold text-[#15323b]">
                          {user.full_name?.trim() || 'Usuário sem nome'}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#6d7a80]">{user.email || 'E-mail não informado'}</p>
                        <p className="mt-1 text-xs font-bold text-[#5F7077]">Atualizado em {formatDateTime(user.updated_at)}</p>
                      </div>
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex min-w-[260px] flex-wrap gap-2">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={`${user.id}-${role.code}`}
                              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getRoleBadgeClass(role.code)}`}
                              title={role.assigned_at ? `Atribuída em ${formatDateTime(role.assigned_at)}` : undefined}
                            >
                              {getRoleLabel(role)}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                            Sem role
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-5 text-sm font-bold text-[#5f7077]">
                      {formatDateTime(user.created_at)}
                    </td>
                    <td className="px-5 py-5">
                      <code className="block min-w-[240px] break-all rounded-2xl bg-[#F2F7F9] px-3 py-2 text-xs font-bold text-[#5F7077]">
                        {user.id}
                      </code>
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex min-w-[270px] flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startRoleEdit(user)}
                          disabled={updatingRoleUserId === user.id}
                          className="rounded-2xl border-[#c7ddff] text-[#1d4ed8] hover:bg-blue-50 hover:text-[#1e40af]"
                        >
                          Editar role
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleResetUserPassword(user)}
                          disabled={resettingUserId === user.id}
                          className="rounded-2xl border-cyan-200 text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800"
                        >
                          {resettingUserId === user.id ? 'Redefinindo...' : 'Redefinir senha'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
