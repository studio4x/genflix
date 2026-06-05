import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { fetchCourse } from '@/features/admin/content/api'
import {
  createGroupRelease,
  createUserRelease,
  deleteCourseRelease,
  fetchAccessGroups,
  fetchCourseReleases,
  fetchProfiles,
  toErrorMessage,
  type CourseReleaseView,
} from '@/features/admin/releases/api'
import { groupReleaseSchema, userReleaseSchema } from '@/features/admin/releases/schemas'
import type { Profile } from '@/types/auth'
import type { AccessGroup, Course } from '@/types/content'

export function AdminCourseReleasesPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [groups, setGroups] = useState<AccessGroup[]>([])
  const [releases, setReleases] = useState<CourseReleaseView[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!courseId) {
      setError('Curso inválido.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [courseResult, profilesResult, groupsResult, releasesResult] = await Promise.all([
        fetchCourse(courseId),
        fetchProfiles(),
        fetchAccessGroups(),
        fetchCourseReleases(courseId),
      ])

      setCourse(courseResult)
      setProfiles(profilesResult)
      setGroups(groupsResult)
      setReleases(releasesResult)
    } catch (loadError) {
      setError(toErrorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleAddUserRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!courseId || !user) {
      setError('Dados inválidos para liberar curso.')
      return
    }

    const parsed = userReleaseSchema.safeParse({ user_id: selectedUserId })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Usuário inválido.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await createUserRelease(courseId, parsed.data, user.id)
      setSelectedUserId('')
      await loadData()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddGroupRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!courseId || !user) {
      setError('Dados inválidos para liberar curso.')
      return
    }

    const parsed = groupReleaseSchema.safeParse({ group_id: selectedGroupId })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Grupo inválido.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await createGroupRelease(courseId, parsed.data, user.id)
      setSelectedGroupId('')
      await loadData()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteRelease(release: CourseReleaseView) {
    const target =
      release.release_type === 'user'
        ? release.user_label ?? release.user_id
        : release.group_label ?? release.group_id

    const confirmed = window.confirm(`Remover liberação para ${target}`)
    if (!confirmed) {
      return
    }

    try {
      await deleteCourseRelease(release.id)
      await loadData()
    } catch (deleteError) {
      setError(toErrorMessage(deleteError))
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Link className="underline" to="/admin/cursos">
            Cursos
          </Link>
          <span>/</span>
          <span>Liberações</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Liberações do curso {course ? `"${course.title}"` : ''}
        </h2>
      </div>

      {isLoading ? <p className="text-sm text-slate-600">Carregando...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <form className="space-y-3 rounded-lg border bg-slate-50 p-4" onSubmit={handleAddUserRelease}>
          <h3 className="font-semibold text-slate-900">Liberar para usuário</h3>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            required
          >
            <option value="">Selecione o usuário</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.email}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Adicionar liberação por usuário'}
          </Button>
        </form>

        <form className="space-y-3 rounded-lg border bg-slate-50 p-4" onSubmit={handleAddGroupRelease}>
          <h3 className="font-semibold text-slate-900">Liberar para grupo</h3>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
            required
          >
            <option value="">Selecione o grupo</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Adicionar liberação por grupo'}
          </Button>
          <p className="text-xs text-slate-500">Precisa criar grupo? Use a tela de grupos.</p>
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/grupos">Abrir grupos</Link>
          </Button>
        </form>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Liberações ativas</h3>
        <div className="grid gap-3">
          {releases.map((release) => (
            <article key={release.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">
                    {release.release_type === 'user'
                      ? `Usuário: ${release.user_label ?? release.user_id}`
                      : `Grupo: ${release.group_label ?? release.group_id}`}
                  </p>
                  <p className="text-sm text-slate-600">
                    Tipo: {release.release_type} | Ativo: {release.is_active ? 'Sim' : 'Não'}
                  </p>
                </div>
                <Button type="button" variant="destructive" onClick={() => void handleDeleteRelease(release)}>
                  Remover
                </Button>
              </div>
            </article>
          ))}
          {!isLoading && releases.length === 0 ? (
            <p className="text-sm text-slate-600">Nenhuma liberação cadastrada.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
