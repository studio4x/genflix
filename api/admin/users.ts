import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getPublicAppUrl } from '../_shared/app-url.js';
import { sendPasswordResetEmail } from '../_shared/email.js';
type ApiRequest = {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
};
type ApiResponse = {
    status: (statusCode: number) => ApiResponse;
    json: (payload: unknown) => void;
    setHeader: (name: string, value: string) => void;
};
type RoleRow = {
    id: number;
    code: string;
    name: string;
};
type RoleRelationRow = {
    user_id: string;
    created_at: string;
    roles: {
        code: string;
        name: string;
    } | {
        code: string;
        name: string;
    }[] | null;
};
type ProfileRow = {
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
};
type RecoveryLinkData = {
    properties?: {
        action_link?: string;
    } | null;
};
const assignableRoleCodes = ['aluno', 'criador', 'admin'] as const;
type AssignableRoleCode = (typeof assignableRoleCodes)[number];
const createUserSchema = z.object({
    email: z.string().email('E-mail inválido.'),
    fullName: z.string().min(2, "N?ome deve ter ao menos 2 caracteres.").max(120).optional(),
    password: z
        .string()
        .min(10, 'Senha deve ter pelo menos 10 caracteres.')
        .max(72, 'Senha deve ter no máximo 72 caracteres.')
        .regex(/[a-z]/, 'Senha deve conter letra minúscula.')
        .regex(/[A-Z]/, 'Senha deve conter letra maiúscula.')
        .regex(/\d/, 'Senha deve conter número.')
        .regex(/[^A-Za-z0-9]/, 'Senha deve conter símbolo.')
        .optional(),
    roleCode: z.enum(assignableRoleCodes),
});
const updateRoleSchema = z.object({
    userId: z.string().uuid('Usuário inválido.'),
    roleCode: z.enum(assignableRoleCodes),
});
const updateUserSchema = z.object({
    userId: z.string().uuid('Usuário inválido.'),
    email: z.string().email('E-mail inválido.').optional(),
    fullName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(120).nullable().optional(),
    password: z
        .string()
        .min(10, 'Senha deve ter pelo menos 10 caracteres.')
        .max(72, 'Senha deve ter no máximo 72 caracteres.')
        .regex(/[a-z]/, 'Senha deve conter letra minúscula.')
        .regex(/[A-Z]/, 'Senha deve conter letra maiúscula.')
        .regex(/\d/, 'Senha deve conter número.')
        .regex(/[^A-Za-z0-9]/, 'Senha deve conter símbolo.')
        .optional(),
    roleCode: z.enum(assignableRoleCodes).optional(),
    avatarUrl: z.string().url('Avatar inválido.').nullable().optional(),
    cpf: z.string().trim().min(1).max(11).nullable().optional(),
    whatsappNumber: z.string().trim().min(1).max(11).nullable().optional(),
    address: z.string().trim().min(1).max(255).nullable().optional(),
    addressNumber: z.string().trim().min(1).max(40).nullable().optional(),
    addressComplement: z.string().trim().min(1).max(120).nullable().optional(),
    postalCode: z.string().trim().min(1).max(8).nullable().optional(),
    state: z.string().trim().min(1).max(2).nullable().optional(),
    province: z.string().trim().min(1).max(120).nullable().optional(),
    city: z.string().trim().min(1).max(120).nullable().optional(),
    timezone: z.string().trim().min(1).max(120).optional(),
    locale: z.string().trim().min(1).max(20).optional(),
});
const resetPasswordSchema = z.object({
    userId: z.string().uuid('Usuário inválido.'),
});
const deleteUserSchema = z.object({
    userId: z.string().uuid('Usuário inválido.'),
});
function getHeaderValue(value: string | string[] | undefined) {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && value.length > 0) {
        return value[0];
    }
    return null;
}
function getBearerToken(authHeader: string | null) {
    if (!authHeader) {
        return null;
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return null;
    }
    return token.trim();
}
function parseBody(rawBody: unknown) {
    if (!rawBody) {
        return null;
    }
    if (typeof rawBody === 'string') {
        try {
            return JSON.parse(rawBody) as Record<string, unknown>;
        }
        catch {
            return null;
        }
    }
    if (typeof rawBody === 'object') {
        return rawBody as Record<string, unknown>;
    }
    return null;
}
function createTemporaryPassword() {
    const token = randomBytes(9).toString('base64url');
    return `Genflix#${token}9a`;
}
function getRequestOrigin() {
    return getPublicAppUrl();
}
function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
    res.status(statusCode);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(payload);
}
async function createAdminClient(req: ApiRequest, res: ApiResponse) {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        jsonResponse(res, 500, { error: 'Configuração ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.' });
        return null;
    }
    const bearerToken = getBearerToken(getHeaderValue(req.headers.authorization) ?? getHeaderValue(req.headers.Authorization));
    if (!bearerToken) {
        jsonResponse(res, 401, { error: 'Token de acesso ausente.' });
        return null;
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    const requesterResult = await adminClient.auth.getUser(bearerToken);
    if (requesterResult.error || !requesterResult.data.user) {
        jsonResponse(res, 401, { error: 'Token inválido ou expirado.' });
        return null;
    }
    const requesterRolesResult = await adminClient
        .from('user_roles')
        .select('roles(code)')
        .eq('user_id', requesterResult.data.user.id);
    if (requesterRolesResult.error) {
        jsonResponse(res, 500, { error: 'Não foi possível validar o perfil do solicitante.' });
        return null;
    }
    const requesterRoles = ((requesterRolesResult.data as Array<{
        roles: {
            code: string;
        } | {
            code: string;
        }[] | null;
    }> | null) ?? [])
        .flatMap((relation) => {
        if (!relation.roles) {
            return [];
        }
        return Array.isArray(relation.roles) ? relation.roles : [relation.roles];
    })
        .map((role) => role.code);
    if (!requesterRoles.includes('admin')) {
        jsonResponse(res, 403, { error: 'Apenas administradores podem acessar usuários.' });
        return null;
    }
    return {
        adminClient,
        requesterId: requesterResult.data.user.id,
    };
}
function normalizeAssignableRoleCode(roleCode: AssignableRoleCode) {
    if (roleCode === 'aluno') {
        return 'student';
    }
    return roleCode;
}
function getManagedRoleCodes(roleCode: AssignableRoleCode) {
    if (roleCode === 'admin') {
        return ['admin', 'criador', 'professor'];
    }
    if (roleCode === 'criador') {
        return ['admin', 'criador', 'professor'];
    }
    return ['admin', 'criador', 'professor', 'student'];
}
async function loadRoleRows(adminClient: SupabaseClient) {
    const result = await adminClient
        .from('roles')
        .select('id, code, name')
        .in('code', ['admin', 'student', 'criador', 'professor']);
    if (result.error) {
        throw result.error;
    }
    return (result.data as RoleRow[] | null) ?? [];
}
function createRoleMap(roleRows: RoleRow[]) {
    return new Map(roleRows.map((role) => [role.code, role]));
}
function sortRolesByPriority(roleA: {
    code: string;
}, roleB: {
    code: string;
}) {
    const priority = (code: string) => {
        if (code === 'admin')
            return 0;
        if (code === 'criador' || code === 'professor')
            return 1;
        if (code === 'student' || code === 'aluno')
            return 2;
        return 3;
    };
    return priority(roleA.code) - priority(roleB.code);
}
async function handleListUsers(req: ApiRequest, res: ApiResponse) {
    const context = await createAdminClient(req, res);
    if (!context) {
        return;
    }
    const { adminClient } = context;
    const [profilesResult, rolesResult] = await Promise.all([
        adminClient
            .from('profiles')
            .select('id, email, full_name, avatar_url, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city, timezone, locale, created_at, updated_at'),
        adminClient
            .from('user_roles')
            .select('user_id, created_at, roles(code, name)'),
    ]);
    if (profilesResult.error || rolesResult.error) {
        jsonResponse(res, 500, { error: 'Não foi possível carregar os usuários.' });
        return;
    }
    const profiles = (profilesResult.data as ProfileRow[] | null) ?? [];
    const roleRelations = (rolesResult.data as RoleRelationRow[] | null) ?? [];
    const usersById = new Map(profiles.map((profile) => [
        profile.id,
        {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            cpf: profile.cpf,
            whatsapp_number: profile.whatsapp_number,
            address: profile.address,
            address_number: profile.address_number,
            address_complement: profile.address_complement,
            postal_code: profile.postal_code,
            state: profile.state,
            province: profile.province,
            city: profile.city,
            timezone: profile.timezone,
            locale: profile.locale,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
            roles: [] as Array<{
                code: string;
                name: string;
                assigned_at: string | null;
            }>,
        },
    ]));
    for (const relation of roleRelations) {
        const user = usersById.get(relation.user_id);
        if (!user || !relation.roles) {
            continue;
        }
        const roles = Array.isArray(relation.roles) ? relation.roles : [relation.roles];
        for (const role of roles) {
            user.roles.push({
                code: role.code,
                name: role.name,
                assigned_at: relation.created_at ?? null,
            });
        }
    }
    const users = Array.from(usersById.values())
        .map((user) => ({
        ...user,
        roles: user.roles.sort(sortRolesByPriority),
    }))
        .sort((userA, userB) => {
        const labelA = (userA.full_name?.trim() || userA.email || userA.id).toLocaleLowerCase('pt-BR');
        const labelB = (userB.full_name?.trim() || userB.email || userB.id).toLocaleLowerCase('pt-BR');
        return labelA.localeCompare(labelB, 'pt-BR');
    });
    jsonResponse(res, 200, { users });
}
async function ensureRoleAssignment(adminClient: SupabaseClient, roleMap: Map<string, RoleRow>, userId: string, roleCode: AssignableRoleCode) {
    const normalizedRoleCode = normalizeAssignableRoleCode(roleCode);
    const targetRole = roleMap.get(normalizedRoleCode);
    if (!targetRole) {
        throw new Error(`Regra ${normalizedRoleCode} não encontrada.`);
    }
    const managedRoleCodes = getManagedRoleCodes(roleCode);
    const managedRoleIds = managedRoleCodes
        .map((code) => roleMap.get(code)?.id)
        .filter((roleId): roleId is number => typeof roleId === 'number');
    if (managedRoleIds.length > 0) {
        const deleteResult = await adminClient
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .in('role_id', managedRoleIds);
        if (deleteResult.error) {
            throw deleteResult.error;
        }
    }
    const insertResult = await adminClient.from('user_roles').upsert({
        user_id: userId,
        role_id: targetRole.id,
    }, {
        onConflict: 'user_id,role_id',
        ignoreDuplicates: true,
    });
    if (insertResult.error) {
        throw insertResult.error;
    }
}
function normalizeTextInput(value: unknown) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeDigitsInput(value: unknown, maxLength: number) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const digits = value.replace(/\D/g, '').slice(0, maxLength);
    return digits.length > 0 ? digits : null;
}
function normalizeStateInput(value: unknown) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim().toUpperCase().slice(0, 2);
    return normalized.length > 0 ? normalized : null;
}
function normalizeEmailInput(value: unknown) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}
async function handleCreateUser(req: ApiRequest, res: ApiResponse) {
    const context = await createAdminClient(req, res);
    if (!context) {
        return;
    }
    const { adminClient } = context;
    const parsedBody = parseBody(req.body);
    if (!parsedBody) {
        jsonResponse(res, 400, { error: 'Body inválido.' });
        return;
    }
    const validationResult = createUserSchema.safeParse({
        email: typeof parsedBody.email === 'string' ? parsedBody.email.trim().toLowerCase() : undefined,
        fullName: typeof parsedBody.fullName === 'string' ? parsedBody.fullName.trim() || undefined : undefined,
        password: typeof parsedBody.password === 'string' ? parsedBody.password.trim() || undefined : undefined,
        roleCode: parsedBody.roleCode,
    });
    if (!validationResult.success) {
        jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados inválidos.' });
        return;
    }
    const payload = validationResult.data;
    const generatedPassword = payload.password ? null : createTemporaryPassword();
    const passwordToUse = payload.password ?? generatedPassword;
    const roleRows = await loadRoleRows(adminClient);
    const roleMap = createRoleMap(roleRows);
    const createdUserResult = await adminClient.auth.admin.createUser({
        email: payload.email,
        password: passwordToUse,
        email_confirm: true,
        user_metadata: payload.fullName ? { full_name: payload.fullName } : undefined,
    });
    if (createdUserResult.error || !createdUserResult.data.user) {
        jsonResponse(res, 400, {
            error: createdUserResult.error?.message ?? 'Não foi possível criar o usuário.',
        });
        return;
    }
    const createdUser = createdUserResult.data.user;
    try {
        await ensureRoleAssignment(adminClient, roleMap, createdUser.id, payload.roleCode);
    }
    catch (assignmentError) {
        jsonResponse(res, 500, {
            error: assignmentError instanceof Error ? assignmentError.message : 'Não foi possível associar a regra do usuário.',
        });
        return;
    }
    const profileUpsertResult = await adminClient.from('profiles').upsert({
        id: createdUser.id,
        email: createdUser.email ?? payload.email,
        full_name: payload.fullName ?? null,
    }, { onConflict: 'id' });
    if (profileUpsertResult.error) {
        jsonResponse(res, 500, { error: 'Usuário criado, mas falhou ao salvar o perfil.' });
        return;
    }
    jsonResponse(res, 201, {
        user_id: createdUser.id,
        email: createdUser.email ?? payload.email,
        role_code: payload.roleCode,
        temporary_password: generatedPassword,
        message: 'Usuário criado com sucesso.',
    });
}
async function handleUpdateUser(req: ApiRequest, res: ApiResponse) {
    const context = await createAdminClient(req, res);
    if (!context) {
        return;
    }
    const { adminClient } = context;
    const parsedBody = parseBody(req.body);
    if (!parsedBody) {
        jsonResponse(res, 400, { error: 'Body inválido.' });
        return;
    }
    const hasEmail = Object.prototype.hasOwnProperty.call(parsedBody, 'email');
    const hasFullName = Object.prototype.hasOwnProperty.call(parsedBody, 'fullName');
    const hasPassword = Object.prototype.hasOwnProperty.call(parsedBody, 'password');
    const hasRoleCode = Object.prototype.hasOwnProperty.call(parsedBody, 'roleCode');
    const hasAvatarUrl = Object.prototype.hasOwnProperty.call(parsedBody, 'avatarUrl');
    const hasCpf = Object.prototype.hasOwnProperty.call(parsedBody, 'cpf');
    const hasWhatsappNumber = Object.prototype.hasOwnProperty.call(parsedBody, 'whatsappNumber');
    const hasAddress = Object.prototype.hasOwnProperty.call(parsedBody, 'address');
    const hasAddressNumber = Object.prototype.hasOwnProperty.call(parsedBody, 'addressNumber');
    const hasAddressComplement = Object.prototype.hasOwnProperty.call(parsedBody, 'addressComplement');
    const hasPostalCode = Object.prototype.hasOwnProperty.call(parsedBody, 'postalCode');
    const hasState = Object.prototype.hasOwnProperty.call(parsedBody, 'state');
    const hasProvince = Object.prototype.hasOwnProperty.call(parsedBody, 'province');
    const hasCity = Object.prototype.hasOwnProperty.call(parsedBody, 'city');
    const hasTimezone = Object.prototype.hasOwnProperty.call(parsedBody, 'timezone');
    const hasLocale = Object.prototype.hasOwnProperty.call(parsedBody, 'locale');
    const validationResult = updateUserSchema.safeParse({
        userId: typeof parsedBody.userId === 'string' ? parsedBody.userId.trim() : undefined,
        ...(hasEmail ? { email: normalizeEmailInput(parsedBody.email) } : {}),
        ...(hasFullName ? { fullName: normalizeTextInput(parsedBody.fullName) } : {}),
        ...(hasPassword ? { password: typeof parsedBody.password === 'string' ? parsedBody.password.trim() || undefined : undefined } : {}),
        ...(hasRoleCode ? { roleCode: parsedBody.roleCode } : {}),
        ...(hasAvatarUrl ? { avatarUrl: normalizeTextInput(parsedBody.avatarUrl) } : {}),
        ...(hasCpf ? { cpf: normalizeDigitsInput(parsedBody.cpf, 11) } : {}),
        ...(hasWhatsappNumber ? { whatsappNumber: normalizeDigitsInput(parsedBody.whatsappNumber, 11) } : {}),
        ...(hasAddress ? { address: normalizeTextInput(parsedBody.address) } : {}),
        ...(hasAddressNumber ? { addressNumber: normalizeTextInput(parsedBody.addressNumber) } : {}),
        ...(hasAddressComplement ? { addressComplement: normalizeTextInput(parsedBody.addressComplement) } : {}),
        ...(hasPostalCode ? { postalCode: normalizeDigitsInput(parsedBody.postalCode, 8) } : {}),
        ...(hasState ? { state: normalizeStateInput(parsedBody.state) } : {}),
        ...(hasProvince ? { province: normalizeTextInput(parsedBody.province) } : {}),
        ...(hasCity ? { city: normalizeTextInput(parsedBody.city) } : {}),
        ...(hasTimezone ? { timezone: typeof parsedBody.timezone === 'string' ? parsedBody.timezone.trim() || undefined : undefined } : {}),
        ...(hasLocale ? { locale: typeof parsedBody.locale === 'string' ? parsedBody.locale.trim() || undefined : undefined } : {}),
    });
    if (!validationResult.success) {
        jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados inválidos.' });
        return;
    }
    const payload = validationResult.data;
    const userResult = await adminClient
        .from('profiles')
        .select('id, email, full_name, avatar_url, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city, timezone, locale, created_at, updated_at')
        .eq('id', payload.userId)
        .maybeSingle();
    if (userResult.error) {
        jsonResponse(res, 500, { error: 'Não foi possível localizar o usuário.' });
        return;
    }
    if (!userResult.data) {
        jsonResponse(res, 404, { error: 'Usuário não encontrado.' });
        return;
    }
    const currentProfile = userResult.data as ProfileRow;
    const roleRows = await loadRoleRows(adminClient);
    const roleMap = createRoleMap(roleRows);
    if (hasEmail || hasPassword || hasFullName) {
        const authUpdateResult = await adminClient.auth.admin.updateUserById(payload.userId, {
            ...(hasEmail && payload.email ? { email: payload.email } : {}),
            ...(hasPassword && payload.password ? { password: payload.password } : {}),
            ...(hasFullName
                ? { user_metadata: { full_name: payload.fullName } }
                : {}),
        });
        if (authUpdateResult.error || !authUpdateResult.data.user) {
            jsonResponse(res, 400, {
                error: authUpdateResult.error?.message ?? 'Não foi possível atualizar o acesso do usuário.',
            });
            return;
        }
    }
    const profileUpdatePayload = {
        ...(payload.email ? { email: payload.email } : {}),
        ...(hasFullName ? { full_name: payload.fullName } : {}),
        ...(hasAvatarUrl ? { avatar_url: payload.avatarUrl } : {}),
        ...(hasCpf ? { cpf: payload.cpf } : {}),
        ...(hasWhatsappNumber ? { whatsapp_number: payload.whatsappNumber } : {}),
        ...(hasAddress ? { address: payload.address } : {}),
        ...(hasAddressNumber ? { address_number: payload.addressNumber } : {}),
        ...(hasAddressComplement ? { address_complement: payload.addressComplement } : {}),
        ...(hasPostalCode ? { postal_code: payload.postalCode } : {}),
        ...(hasState ? { state: payload.state } : {}),
        ...(hasProvince ? { province: payload.province } : {}),
        ...(hasCity ? { city: payload.city } : {}),
        ...(payload.timezone ? { timezone: payload.timezone } : {}),
        ...(payload.locale ? { locale: payload.locale } : {}),
    };
    const profileChanged = Object.keys(profileUpdatePayload).length > 0;
    if (profileChanged) {
        const profileUpdateResult = await adminClient
            .from('profiles')
            .update(profileUpdatePayload)
            .eq('id', payload.userId)
            .select('id, email, full_name, avatar_url, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city, timezone, locale, created_at, updated_at')
            .maybeSingle();
        if (profileUpdateResult.error || !profileUpdateResult.data) {
            jsonResponse(res, 500, {
                error: profileUpdateResult.error?.message ?? 'Não foi possível atualizar o perfil do usuário.',
            });
            return;
        }
    }
    if (payload.roleCode) {
        try {
            await ensureRoleAssignment(adminClient, roleMap, payload.userId, payload.roleCode);
        }
        catch (assignmentError) {
            jsonResponse(res, 500, {
                error: assignmentError instanceof Error ? assignmentError.message : 'Não foi possível atualizar a regra do usuário.',
            });
            return;
        }
    }
    const refreshedUserResult = profileChanged
        ? await adminClient
            .from('profiles')
            .select('id, email, full_name, avatar_url, cpf, whatsapp_number, address, address_number, address_complement, postal_code, state, province, city, timezone, locale, created_at, updated_at')
            .eq('id', payload.userId)
            .maybeSingle()
        : { data: currentProfile, error: null };
    if (refreshedUserResult.error || !refreshedUserResult.data) {
        jsonResponse(res, 500, { error: 'Não foi possível concluir a atualização do usuário.' });
        return;
    }
    jsonResponse(res, 200, {
        user_id: payload.userId,
        email: refreshedUserResult.data.email,
        role_code: payload.roleCode ?? null,
        message: 'Usuário atualizado com sucesso.',
    });
}
async function handleUpdateUserRole(req: ApiRequest, res: ApiResponse) {
    const context = await createAdminClient(req, res);
    if (!context) {
        return;
    }
    const { adminClient } = context;
    const parsedBody = parseBody(req.body);
    if (!parsedBody) {
        jsonResponse(res, 400, { error: 'Body inválido.' });
        return;
    }
    const validationResult = updateRoleSchema.safeParse({
        userId: typeof parsedBody.userId === 'string' ? parsedBody.userId.trim() : undefined,
        roleCode: parsedBody.roleCode,
    });
    if (!validationResult.success) {
        jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados inválidos.' });
        return;
    }
    const roleRows = await loadRoleRows(adminClient);
    const roleMap = createRoleMap(roleRows);
    const { userId, roleCode } = validationResult.data;
    const userResult = await adminClient
        .from('profiles')
        .select('id, email, full_name, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();
    if (userResult.error) {
        jsonResponse(res, 500, { error: 'Não foi possível localizar o usuário.' });
        return;
    }
    if (!userResult.data) {
        jsonResponse(res, 404, { error: 'Usuário não encontrado.' });
        return;
    }
    try {
        await ensureRoleAssignment(adminClient, roleMap, userId, roleCode);
    }
    catch (assignmentError) {
        jsonResponse(res, 500, {
            error: assignmentError instanceof Error ? assignmentError.message : 'Não foi possível atualizar a regra do usuário.',
        });
        return;
    }
    jsonResponse(res, 200, {
        user_id: userId,
        email: userResult.data.email,
        role_code: roleCode,
        message: 'Regra atualizada com sucesso.',
    });
}
async function handleResetUserPassword(req: ApiRequest, res: ApiResponse) {
    const context = await createAdminClient(req, res);
    if (!context) {
        return;
    }
    const { adminClient } = context;
    const parsedBody = parseBody(req.body);
    if (!parsedBody) {
        jsonResponse(res, 400, { error: 'Body inválido.' });
        return;
    }
    const validationResult = resetPasswordSchema.safeParse({
        userId: typeof parsedBody.userId === 'string' ? parsedBody.userId.trim() : undefined,
    });
    if (!validationResult.success) {
        jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados inválidos.' });
        return;
    }
    const { userId } = validationResult.data;
    const authUserResult = await adminClient.auth.admin.getUserById(userId);
    if (authUserResult.error || !authUserResult.data.user?.email) {
        jsonResponse(res, 404, { error: 'Usuário não encontrado ou sem e-mail cadastrado.' });
        return;
    }
    const profileResult = await adminClient
        .from('profiles')
        .select('id, email, full_name, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();
    if (profileResult.error) {
        jsonResponse(res, 500, { error: 'Não foi possível localizar o perfil do usuário.' });
        return;
    }
    const email = profileResult.data?.email ?? authUserResult.data.user.email;
    const linkResult = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
            redirectTo: `${getRequestOrigin()}/redefinir-senha`,
        },
    });
    if (linkResult.error) {
        jsonResponse(res, 400, {
            error: linkResult.error.message ?? 'Não foi possível gerar o link de redefinição.',
        });
        return;
    }
    const linkData = linkResult.data as RecoveryLinkData;
    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
        jsonResponse(res, 500, { error: 'O Supabase não retornou um link de redefinição válido.' });
        return;
    }
    const metadataFullName = typeof authUserResult.data.user.user_metadata?.full_name === 'string'
        ? authUserResult.data.user.user_metadata.full_name
        : null;
    try {
        await sendPasswordResetEmail({
            to: email,
            fullName: profileResult.data?.full_name ?? metadataFullName,
            actionLink,
        });
    }
    catch (emailError) {
        jsonResponse(res, 500, {
            error: emailError instanceof Error ? emailError.message : 'Não foi possível enviar o e-mail de redefinição.',
        });
        return;
    }
    jsonResponse(res, 200, {
        user_id: userId,
        email,
        temporary_password: null,
        message: 'E-mail de redefinição enviado com sucesso.',
    });
}
async function handleDeleteUser(req: ApiRequest, res: ApiResponse) {
    const context = await createAdminClient(req, res);
    if (!context) {
        return;
    }
    const { adminClient, requesterId } = context;
    const parsedBody = parseBody(req.body);
    if (!parsedBody) {
        jsonResponse(res, 400, { error: 'Body inválido.' });
        return;
    }
    const validationResult = deleteUserSchema.safeParse({
        userId: typeof parsedBody.userId === 'string' ? parsedBody.userId.trim() : undefined,
    });
    if (!validationResult.success) {
        jsonResponse(res, 400, { error: validationResult.error.issues[0]?.message ?? 'Dados inválidos.' });
        return;
    }
    const { userId } = validationResult.data;
    if (userId === requesterId) {
        jsonResponse(res, 400, { error: 'Você não pode excluir seu próprio usuário.' });
        return;
    }
    const userResult = await adminClient
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .maybeSingle();
    if (userResult.error) {
        jsonResponse(res, 500, { error: 'Não foi possível localizar o usuário.' });
        return;
    }
    if (!userResult.data) {
        jsonResponse(res, 404, { error: 'Usuário não encontrado.' });
        return;
    }
    const userRolesResult = await adminClient
        .from('user_roles')
        .select('roles(code)')
        .eq('user_id', userId);
    if (userRolesResult.error) {
        jsonResponse(res, 500, { error: 'Não foi possível validar as regras do usuário.' });
        return;
    }
    const userRoleCodes = ((userRolesResult.data as Array<{
        roles: {
            code: string;
        } | {
            code: string;
        }[] | null;
    }> | null) ?? [])
        .flatMap((relation) => {
        if (!relation.roles) {
            return [];
        }
        return Array.isArray(relation.roles) ? relation.roles : [relation.roles];
    })
        .map((role) => role.code);
    if (userRoleCodes.includes('admin')) {
        const adminCountResult = await adminClient
            .from('user_roles')
            .select('user_id, roles!inner(code)', { count: 'exact', head: true })
            .eq('roles.code', 'admin');
        if (adminCountResult.error) {
            jsonResponse(res, 500, { error: "N\u00E3o foi poss\u00EDvel validar os administradores restntes." });
            return;
        }
        const remainingAdmins = adminCountResult.count ?? 0;
        if (remainingAdmins <= 1) {
            jsonResponse(res, 400, { error: 'Não é possível excluir o último administrador.' });
            return;
        }
    }
    const deleteAuthResult = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthResult.error) {
        jsonResponse(res, 400, {
            error: deleteAuthResult.error.message ?? 'Não foi possível excluir o usuário.',
        });
        return;
    }
    jsonResponse(res, 200, {
        user_id: userId,
        email: userResult.data.email,
        message: 'Usuário excluído com sucesso.',
    });
}
export default async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method === 'GET') {
        await handleListUsers(req, res);
        return;
    }
    if (req.method === 'POST') {
        await handleCreateUser(req, res);
        return;
    }
    if (req.method === 'PUT') {
        await handleUpdateUser(req, res);
        return;
    }
    if (req.method === 'PATCH') {
        await handleResetUserPassword(req, res);
        return;
    }
    if (req.method === 'DELETE') {
        await handleDeleteUser(req, res);
        return;
    }
    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
    res.status(405).json({ error: 'Método não permitido.' });
}
