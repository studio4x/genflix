import type { Session } from '@supabase/supabase-js'

import type { CreateStudentInput } from './schemas'

interface ErrorResponse {
  error?: string
}

export interface CreateStudentResponse {
  user_id: string
  email: string
  temporary_password: string | null
  message: string
}

export interface AdminStudentListItem {
  id: string
  email: string
  full_name: string | null
  timezone: string
  locale: string
  created_at: string
  updated_at: string
  enrolled_courses_count: number
  completed_courses_count: number
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Erro inesperado.'
}

export async function createStudent(
  payload: CreateStudentInput,
  session: Session,
) {
  const response = await fetch('/api/admin/students', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  const data = (await response
    .json()
    .catch(() => null)) as ErrorResponse | CreateStudentResponse | null

  if (!response.ok) {
    throw new Error(
      (data as ErrorResponse | null)?.error ?? 'Nao foi possivel criar aluno.',
    )
  }

  return data as CreateStudentResponse
}

export async function fetchStudents(session: Session) {
  const response = await fetch('/api/admin/students', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  const data = (await response
    .json()
    .catch(() => null)) as ErrorResponse | { students?: AdminStudentListItem[] } | null

  if (!response.ok) {
    throw new Error(
      (data as ErrorResponse | null)?.error ?? 'Nao foi possivel carregar os alunos.',
    )
  }

  return (data as { students?: AdminStudentListItem[] } | null)?.students ?? []
}
