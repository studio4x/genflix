import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase/client';
import { clearPasswordRecoveryState, hasPasswordRecoveryUrl, markPasswordRecoveryState, readPasswordRecoveryState, } from '@/features/auth/password-recovery-state';
import { toTranslatedAuthError } from '@/features/auth/auth-error-messages';
import type { Profile, RoleCode, UpdateProfileInput } from '@/types/auth';
interface AuthContextValue {
    isLoading: boolean;
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    roles: RoleCode[];
    signIn: (email: string, password: string) => Promise<void>;
    signInWithMagicLink: (email: string) => Promise<void>;
    signUp: (fullName: string, email: string, password: string) => Promise<{
        needsEmailConfirmation: boolean;
        userId: string | null;
        accessToken: string | null;
    }>;
    signOut: () => Promise<void>;
    requestPasswordReset: (email: string) => Promise<void>;
    updatePassword: (newPassword: string) => Promise<void>;
    completePasswordRecovery: (newPassword: string) => Promise<void>;
    isPasswordRecoverySession: boolean;
    refreshProfile: () => Promise<void>;
    updateProfile: (payload: UpdateProfileInput) => Promise<Profile>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
type RoleRow = {
    code: string;
};
type RoleRelationRow = {
    roles: RoleRow | RoleRow[] | null;
};
const KNOWN_ROLE_CODES = new Set<RoleCode>(['admin', 'student', 'aluno', 'professor', 'criador']);
function extractRoles(data: RoleRelationRow[]): RoleCode[] {
    const roleCodes = data
        .flatMap((item) => {
        if (!item.roles) {
            return [];
        }
        return Array.isArray(item.roles) ? item.roles : [item.roles];
    })
        .map((role) => role.code)
        .filter((code): code is RoleCode => KNOWN_ROLE_CODES.has(code as RoleCode));
    return Array.from(new Set(roleCodes));
}
async function loadProfileAndRoles(userId: string) {
    const [profileResult, rolesResult] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city, timezone, locale')
            .eq('id', userId)
            .maybeSingle(),
        supabase
            .from('user_roles')
            .select('roles(code)')
            .eq('user_id', userId),
    ]);
    if (profileResult.error) {
        throw profileResult.error;
    }
    if (rolesResult.error) {
        throw rolesResult.error;
    }
    const profile = profileResult.data as Profile | null;
    const roles = extractRoles((rolesResult.data as RoleRelationRow[]) ?? []);
    return { profile, roles };
}
async function loadProfile(userId: string) {
    const profileResult = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city, timezone, locale')
        .eq('id', userId)
        .maybeSingle();
    if (profileResult.error) {
        throw profileResult.error;
    }
    return profileResult.data as Profile | null;
}
async function syncProfileNameFromMetadata(userId: string, profile: Profile | null, user: User) {
    const metadataName = typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name.trim()
        : '';
    if (!metadataName || profile?.full_name?.trim()) {
        return profile;
    }
    const updateResult = await supabase
        .from('profiles')
        .update({ full_name: metadataName })
        .eq('id', userId)
        .select('id, email, full_name, avatar_url, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city, timezone, locale')
        .single();
    if (updateResult.error) {
        return profile;
    }
    return updateResult.data as Profile;
}
export function AuthProvider({ children }: {
    children: ReactNode;
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [roles, setRoles] = useState<RoleCode[]>([]);
    const [isPasswordRecoverySession, setIsPasswordRecoverySession] = useState(() => readPasswordRecoveryState());
    const syncVersionRef = useRef(0);
    const currentUserIdRef = useRef<string | null>(null);
    const hasResolvedContextRef = useRef(false);
    const syncAuthState = useCallback(async (nextSession: Session | null, event?: AuthChangeEvent) => {
        const syncVersion = ++syncVersionRef.current;
        const nextUserId = nextSession?.user?.id ?? null;
        const isSessionResyncForSameUser = (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED') &&
            !!nextUserId &&
            nextUserId === currentUserIdRef.current &&
            hasResolvedContextRef.current;
        if (!isSessionResyncForSameUser) {
            setIsLoading(true);
        }
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        currentUserIdRef.current = nextUserId;
        if (isSessionResyncForSameUser) {
            return;
        }
        if (!nextSession?.user) {
            if (syncVersion === syncVersionRef.current) {
                setProfile(null);
                setRoles([]);
                hasResolvedContextRef.current = false;
                setIsLoading(false);
            }
            return;
        }
        setProfile(null);
        setRoles([]);
        try {
            const context = await loadProfileAndRoles(nextSession.user.id);
            const hydratedProfile = await syncProfileNameFromMetadata(nextSession.user.id, context.profile, nextSession.user);
            if (syncVersion === syncVersionRef.current) {
                setProfile(hydratedProfile);
                setRoles(context.roles);
                hasResolvedContextRef.current = true;
            }
        }
        catch {
            if (syncVersion === syncVersionRef.current) {
                setProfile(null);
                setRoles([]);
                hasResolvedContextRef.current = false;
            }
        }
        finally {
            if (syncVersion === syncVersionRef.current) {
                setIsLoading(false);
            }
        }
    }, []);
    useEffect(() => {
        let isMounted = true;
        async function initialize() {
            if (hasPasswordRecoveryUrl()) {
                markPasswordRecoveryState();
                setIsPasswordRecoverySession(true);
            }
            const result = await supabase.auth.getSession();
            if (!isMounted) {
                return;
            }
            await syncAuthState(result.data.session);
        }
        initialize().catch(() => setIsLoading(false));
        const { data: { subscription }, } = supabase.auth.onAuthStateChange((event, nextSession) => {
            if (event === 'PASSWORD_RECOVERY') {
                markPasswordRecoveryState();
                setIsPasswordRecoverySession(true);
            }
            void syncAuthState(nextSession, event);
        });
        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [syncAuthState]);
    const signIn = useCallback(async (email: string, password: string) => {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) {
            throw toTranslatedAuthError(result.error, 'Não foi possível entrar.');
        }
    }, []);
    const signInWithMagicLink = useCallback(async (email: string) => {
        const result = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
                shouldCreateUser: false,
            },
        });
        if (result.error) {
            throw toTranslatedAuthError(result.error, 'Não foi possível enviar o link de acesso.');
        }
    }, []);
    const signUp = useCallback(async (fullName: string, email: string, password: string) => {
        const result = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/login`,
                data: {
                    full_name: fullName.trim(),
                },
            },
        });
        if (result.error) {
            throw toTranslatedAuthError(result.error, 'Não foi possível criar a conta.');
        }
        if (result.data.user?.id && result.data.session && fullName.trim()) {
            await supabase
                .from('profiles')
                .update({ full_name: fullName.trim() })
                .eq('id', result.data.user.id);
        }
        return {
            needsEmailConfirmation: !result.data.session,
            userId: result.data.user?.id ?? null,
            accessToken: result.data.session?.access_token ?? null,
        };
    }, []);
    const signOut = useCallback(async () => {
        const result = await supabase.auth.signOut();
        if (result.error) {
            throw toTranslatedAuthError(result.error, 'Não foi possível sair da conta.');
        }
    }, []);
    const requestPasswordReset = useCallback(async (email: string) => {
        const response = await fetch('/api/auth/password-reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });
        const payload = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;
        if (!response.ok) {
            throw new Error(payload?.error ?? 'Não foi possível enviar o e-mail de recuperação.');
        }
    }, []);
    const updatePassword = useCallback(async (newPassword: string) => {
        const result = await supabase.auth.updateUser({ password: newPassword });
        if (result.error) {
            throw toTranslatedAuthError(result.error, 'Não foi possível atualizar a senha.');
        }
    }, []);
    const completePasswordRecovery = useCallback(async (newPassword: string) => {
        const result = await supabase.auth.updateUser({ password: newPassword });
        if (result.error) {
            throw toTranslatedAuthError(result.error, 'Não foi possível redefinir a senha.');
        }
        clearPasswordRecoveryState();
        setIsPasswordRecoverySession(false);
    }, []);
    const refreshProfile = useCallback(async () => {
        if (!currentUserIdRef.current) {
            setProfile(null);
            return;
        }
        const nextProfile = await loadProfile(currentUserIdRef.current);
        setProfile(nextProfile);
    }, []);
    const updateProfile = useCallback(async (payload: UpdateProfileInput) => {
        if (!currentUserIdRef.current) {
            throw new Error('Usuário não autenticado.');
        }
        const nextPayload = {
            ...(Object.prototype.hasOwnProperty.call(payload, 'full_name')
                ? { full_name: payload.full_name }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'avatar_url')
                ? { avatar_url: payload.avatar_url }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'cpf')
                ? { cpf: payload.cpf }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'address')
                ? { address: payload.address }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'address_number')
                ? { address_number: payload.address_number }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'address_complement')
                ? { address_complement: payload.address_complement }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'postal_code')
                ? { postal_code: payload.postal_code }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'state')
                ? { state: payload.state }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'province')
                ? { province: payload.province }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'city')
                ? { city: payload.city }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'timezone')
                ? { timezone: payload.timezone }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'locale')
                ? { locale: payload.locale }
                : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, 'whatsapp_number')
                ? { whatsapp_number: payload.whatsapp_number }
                : {}),
        };
        if (Object.keys(nextPayload).length === 0) {
            throw new Error('Nenhuma alteracao de perfil foi informada.');
        }
        const result = await supabase
            .from('profiles')
            .update(nextPayload)
            .eq('id', currentUserIdRef.current)
            .select('id, email, full_name, avatar_url, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city, timezone, locale')
            .single();
        if (result.error) {
            throw result.error;
        }
        const nextProfile = result.data as Profile;
        setProfile(nextProfile);
        return nextProfile;
    }, []);
    const value = useMemo<AuthContextValue>(() => ({
        isLoading,
        user,
        session,
        profile,
        roles,
        signIn,
        signInWithMagicLink,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
        completePasswordRecovery,
        isPasswordRecoverySession,
        refreshProfile,
        updateProfile,
    }), [
        isLoading,
        profile,
        refreshProfile,
        requestPasswordReset,
        roles,
        session,
        signIn,
        signInWithMagicLink,
        signOut,
        signUp,
        completePasswordRecovery,
        isPasswordRecoverySession,
        updatePassword,
        updateProfile,
        user,
    ]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
