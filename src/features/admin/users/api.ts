import type { Session } from '@supabase/supabase-js';
interface ErrorResponse {
    error?: string;
}
export interface AdminUserRole {
    code: string;
    name: string;
    assigned_at: string | null;
}
export interface AdminUserListItem {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    cpf: string | null;
    whatsapp_number: string | null;
    address: string | null;
    address_number: string | null;
    address_complement: string | null;
    postal_code: string | null;
    state: string | null;
    province: string | null;
    city: string | null;
    timezone: string;
    locale: string;
    created_at: string;
    updated_at: string;
    roles: AdminUserRole[];
}
export type AdminAssignableRoleCode = 'aluno' | 'criador' | 'admin';
export interface CreateAdminUserInput {
    email: string;
    fullName?: string;
    password?: string;
    roleCode: AdminAssignableRoleCode;
}
export interface CreateAdminUserResponse {
    user_id: string;
    email: string;
    role_code: AdminAssignableRoleCode;
    temporary_password: string | null;
    message: string;
}
export interface ResetAdminUserPasswordResponse {
    user_id: string;
    email: string;
    temporary_password: string | null;
    message: string;
}
export interface UpdateAdminUserRoleResponse {
    user_id: string;
    email: string;
    role_code: AdminAssignableRoleCode;
    message: string;
}
export interface UpdateAdminUserResponse {
    user_id: string;
    email: string;
    role_code: AdminAssignableRoleCode | null;
    message: string;
}
export interface UpdateAdminUserInput {
    email?: string;
    fullName?: string | null;
    password?: string;
    roleCode?: AdminAssignableRoleCode;
    avatarUrl?: string | null;
    cpf?: string | null;
    whatsappNumber?: string | null;
    address?: string | null;
    addressNumber?: string | null;
    addressComplement?: string | null;
    postalCode?: string | null;
    state?: string | null;
    province?: string | null;
    city?: string | null;
    timezone?: string;
    locale?: string;
}
export interface DeleteAdminUserResponse {
    user_id: string;
    email: string;
    message: string;
}
export interface LoginAsAdminUserResponse {
    user_id: string;
    email: string;
    action_link: string;
    message: string;
}
export function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Erro inesperado.';
}
export async function fetchAdminUsers(session: Session) {
    const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
    });
    const data = (await response
        .json()
        .catch(() => null)) as ErrorResponse | {
        users?: AdminUserListItem[];
    } | null;
    if (!response.ok) {
        throw new Error((data as ErrorResponse | null)?.error ?? 'Não foi possível carregar os usuários.');
    }
    return (data as {
        users?: AdminUserListItem[];
    } | null)?.users ?? [];
}
export async function createAdminUser(payload: CreateAdminUserInput, session: Session) {
    const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
    });
    const data = (await response
        .json()
        .catch(() => null)) as ErrorResponse | CreateAdminUserResponse | null;
    if (!response.ok) {
        throw new Error((data as ErrorResponse | null)?.error ?? 'Não foi possível criar o usuário.');
    }
    return data as CreateAdminUserResponse;
}
export async function resetAdminUserPassword(userId: string, session: Session) {
    const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
    });
    const data = (await response
        .json()
        .catch(() => null)) as ErrorResponse | ResetAdminUserPasswordResponse | null;
    if (!response.ok) {
        throw new Error((data as ErrorResponse | null)?.error ?? 'Não foi possível redefinir a senha do usuário.');
    }
    return data as ResetAdminUserPasswordResponse;
}
export async function updateAdminUserRole(userId: string, roleCode: AdminAssignableRoleCode, session: Session) {
    return updateAdminUser(userId, { roleCode }, session);
}
export async function updateAdminUser(userId: string, payload: UpdateAdminUserInput, session: Session) {
    const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            userId,
            ...payload,
        }),
    });
    const data = (await response
        .json()
        .catch(() => null)) as ErrorResponse | UpdateAdminUserResponse | null;
    if (!response.ok) {
        throw new Error((data as ErrorResponse | null)?.error ?? 'Não foi possível atualizar o usuário.');
    }
    return data as UpdateAdminUserResponse;
}
export async function deleteAdminUser(userId: string, session: Session) {
    const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
    });
    const data = (await response
        .json()
        .catch(() => null)) as ErrorResponse | DeleteAdminUserResponse | null;
    if (!response.ok) {
        throw new Error((data as ErrorResponse | null)?.error ?? 'Não foi possível excluir o usuário.');
    }
    return data as DeleteAdminUserResponse;
}
export async function loginAsAdminUser(userId: string, session: Session) {
    const response = await fetch('/api/admin/users?task=impersonate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
    });
    const data = (await response
        .json()
        .catch(() => null)) as ErrorResponse | LoginAsAdminUserResponse | null;
    if (!response.ok) {
        throw new Error((data as ErrorResponse | null)?.error ?? 'Não foi possível logar como o usuário.');
    }
    return data as LoginAsAdminUserResponse;
}
