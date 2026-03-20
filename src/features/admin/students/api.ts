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

