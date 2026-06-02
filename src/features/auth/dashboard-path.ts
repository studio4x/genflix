import type { RoleCode } from '@/types/auth';
export function getDashboardPathForRoles(roles: RoleCode[]) {
    if (roles.includes('admin')) {
        return '/admin';
    }
    if (roles.includes('criador') || roles.includes('professor')) {
        return '/criador';
    }
    return '/aluno';
}
