import type { Session } from '@supabase/supabase-js';

const IMPERSONATION_STORAGE_KEY = 'genflix:impersonation-session';

export type ImpersonatedUserInfo = {
  id: string;
  email: string | null;
  fullName: string | null;
};

export type ImpersonationSessionState = {
  adminSession: {
    accessToken: string;
    refreshToken: string;
  };
  adminUserId: string;
  adminEmail: string | null;
  adminFullName: string | null;
  impersonatedUserId: string;
  impersonatedEmail: string | null;
  impersonatedFullName: string | null;
  startedAt: string;
};

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function createImpersonationSessionState(session: Session, impersonatedUser: ImpersonatedUserInfo): ImpersonationSessionState {
  return {
    adminSession: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    },
    adminUserId: session.user.id,
    adminEmail: session.user.email ?? null,
    adminFullName: typeof session.user.user_metadata?.full_name === 'string'
      ? session.user.user_metadata.full_name
      : null,
    impersonatedUserId: impersonatedUser.id,
    impersonatedEmail: impersonatedUser.email,
    impersonatedFullName: impersonatedUser.fullName,
    startedAt: new Date().toISOString(),
  };
}

export function readImpersonationSessionState() {
  if (!canUseSessionStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ImpersonationSessionState> | null;
    if (!parsed) {
      return null;
    }

    if (
      typeof parsed.adminSession?.accessToken !== 'string' ||
      typeof parsed.adminSession?.refreshToken !== 'string' ||
      typeof parsed.adminUserId !== 'string' ||
      typeof parsed.impersonatedUserId !== 'string' ||
      typeof parsed.startedAt !== 'string'
    ) {
      return null;
    }

    return {
      adminSession: {
        accessToken: parsed.adminSession.accessToken,
        refreshToken: parsed.adminSession.refreshToken,
      },
      adminUserId: parsed.adminUserId,
      adminEmail: typeof parsed.adminEmail === 'string' ? parsed.adminEmail : null,
      adminFullName: typeof parsed.adminFullName === 'string' ? parsed.adminFullName : null,
      impersonatedUserId: parsed.impersonatedUserId,
      impersonatedEmail: typeof parsed.impersonatedEmail === 'string' ? parsed.impersonatedEmail : null,
      impersonatedFullName: typeof parsed.impersonatedFullName === 'string' ? parsed.impersonatedFullName : null,
      startedAt: parsed.startedAt,
    } satisfies ImpersonationSessionState;
  }
  catch {
    return null;
  }
}

export function writeImpersonationSessionState(state: ImpersonationSessionState) {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(state));
}

export function clearImpersonationSessionState() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
}
