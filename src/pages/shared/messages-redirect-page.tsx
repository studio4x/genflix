import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
export function MessagesRedirectPage() {
    const { roles } = useAuth();
    const location = useLocation();
    const suffix = location.search || '';
    if (roles.includes('admin')) {
        return <Navigate to={`/admin/mensagens${suffix}`} replace/>;
    }
    if (roles.includes('criador') || roles.includes('professor')) {
        return <Navigate to={`/criador/mensagens${suffix}`} replace/>;
    }
    return <Navigate to={`/aluno/mensagens${suffix}`} replace/>;
}
