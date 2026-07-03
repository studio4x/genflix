import { useState } from 'react';
import { ArrowLeftRight, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';

export function ImpersonationBanner({ className }: {
  className?: string;
}) {
  const { impersonation, isImpersonating, profile, restoreAdminSession } = useAuth();
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isImpersonating || !impersonation) {
    return null;
  }

  const impersonatedLabel = profile?.full_name?.trim() || profile?.email?.trim() || 'este usuário';
  const adminLabel = impersonation.adminFullName?.trim() || impersonation.adminEmail?.trim() || 'admin';

  async function handleRestoreAdminSession() {
    setIsRestoring(true);
    setError(null);

    try {
      await restoreAdminSession();
    }
    catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Não foi possível voltar para o admin.');
      setIsRestoring(false);
    }
  }

  return (
    <div className={`border-b border-[#BEE3EA] bg-[linear-gradient(90deg,#E8F6FA_0%,#F2FBFD_100%)] px-4 py-3 text-[#15323b] ${className ?? ''}`}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 rounded-[22px] border border-[#BEE3EA] bg-white/85 px-4 py-3 shadow-[0_12px_36px_rgba(10,54,64,0.08)] backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">
                Modo de acesso temporário
              </p>
              <p className="mt-1 text-sm font-semibold text-[#15323b]">
                Você está logado como <span className="font-black">{impersonatedLabel}</span>.
              </p>
              <p className="mt-1 text-xs font-medium text-[#5F7077]">
                Quando terminar a validação, volte para a conta admin original: <span className="font-bold text-[#15323b]">{adminLabel}</span>.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={() => void handleRestoreAdminSession()}
              disabled={isRestoring}
              className="h-11 rounded-2xl bg-[#1398B7] px-4 font-black text-white hover:bg-[#0A3640]"
            >
              {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeftRight className="mr-2 h-4 w-4" />}
              {isRestoring ? 'Restaurando...' : 'Voltar ao usuário admin'}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
