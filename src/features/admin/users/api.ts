import type { Session } from '@supabase/supabase-js'

interface ErrorResponse {
  error?: string
}

export interface AdminUserRole {
  code: string
  name: string
  assigned_at: string | null
}

export interface AdminUserListItem {
  id: string
  email: string
  full_name: string | null
  created_at: string
  updated_at: string
  roles: AdminUserRole[]
}

export type AdminAssignableRoleCode = 'aluno' | 'criador' | 'admin'

export interface CreateAdminUserInput {
  email: string
  fullName?: string
  password?: string
  roleCode: AdminAssignableRoleCode
}

export interface CreateAdminUserResponse {
  user_id: string
  email: string
  role_code: AdminAssignableRoleCode
  temporary_password: string | null
  message: string
}

export interface ResetAdminUserPasswordResponse {
  user_id: string
  email: string
  temporary_password: string
  message: string
}

export interface UpdateAdminUserRoleResponse {
  user_id: string
  email: string
  role_code: AdminAssignableRoleCode
  message: string
}

export interface DeleteAdminUserResponse {
  user_id: string
  email: string
  message: string
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Erro inesperado.'
}

export async function fetchAdminUsers(session: Session) {
  const response = await fetch('/api/admin/users', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  const data = (await response
    .json()
    .catch(() => null)) as ErrorResponse | { users?: AdminUserListItem[] } | null

  if (!response.ok) {
    throw new Error(
      (data as ErrorResponse | null)?.error ?? 'Nao foi possivel carregar os usuarios.',
    )
  }

  return (data as { users?: AdminUserListItem[] } | null)?.users ?? []
}

export async function createAdminUser(
  payload: CreateAdminUserInput,
  session: Session,
) {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  const data = (await response
    .json()
    .catch(() => null)) as ErrorResponse | CreateAdminUserResponse | null

  if (!response.ok) {
    throw new Error(
      (data as ErrorResponse | null)?.error ?? 'Nao foi possivel criar o usuario.',
    )
  }

  return data as CreateAdminUserResponse
}

export async function resetAdminUserPassword(userId: string, session: Session) {
  const response = await fetch('/api/admin/users', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId }),
  })

  const data = (await response
    .json()
    .catch(() => null)) as ErrorResponse | ResetAdminUserPasswordResponse | null

  if (!response.ok) {
    throw new Error(
      (data as ErrorResponse | null)?.error ?? 'Nao foi possivel redefinir a senha do usuario.',
    )
  }

  return data as ResetAdminUserPasswordResponse
}

export async function updateAdminUserRole(
  userId: string,
  roleCode: AdminAssignableRoleCode,
  session: Session,
) {
  const response = await fetch('/api/admin/users', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId, roleCode }),
  })

  const data = (await response
    .json()
    .catch(() => null)) as ErrorResponse | UpdateAdminUserRoleResponse | null

  if (!response.ok) {
    throw new Error(
      (data as ErrorResponse | null)?.error ?? 'Nao foi possivel atualizar a role do usuario.',
    )
  }

  return data as UpdateAdminUserRoleResponse
}

export async function deleteAdminUser(userId: string, session: Session) {
  const response = await fetch('/api/admin/users', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId }),
  })

  const data = (await response
    .json()
    .catch(() => null)) as ErrorResponse | DeleteAdminUserResponse | null

  if (!response.ok) {
    throw new Error(
      (data as ErrorResponse | null)?.error ?? 'Nao foi possivel excluir o usuario.',
    )
  }

  return data as DeleteAdminUserResponse
}
