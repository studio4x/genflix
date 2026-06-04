import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  fetchAiCredentialsDiagnostics,
  saveAiCredentials,
  type AiCredentialsDiagnostics,
} from '@/features/admin/narration-settings/api';

const emptyDiagnostics: AiCredentialsDiagnostics = {
  location: 'unavailable',
  checkedAt: '',
  hasOpenAiKey: false,
  hasGeminiKey: false,
  checks: [],
};

function formatLocation(value: AiCredentialsDiagnostics['location']) {
  if (value === 'supabase') {
    return 'Supabase (Edge Function Secrets)';
  }
  if (value === 'vercel') {
    return 'Vercel (Environment Variables)';
  }
  return 'Nao identificado';
}

export function AdminNarrationCredentialsPanel() {
  const [diagnostics, setDiagnostics] = useState<AiCredentialsDiagnostics>(emptyDiagnostics);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const next = await fetchAiCredentialsDiagnostics();
        if (isMounted) {
          setDiagnostics(next);
          setOpenAiApiKey(next.openAiApiKey ?? '');
          setGeminiApiKey(next.geminiApiKey ?? '');
        }
      }
      catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar credenciais de IA.');
        }
      }
      finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const providerStatus = useMemo(() => {
    if (diagnostics.hasOpenAiKey && diagnostics.hasGeminiKey) {
      return 'OpenAI + Gemini configuradas';
    }
    if (diagnostics.hasOpenAiKey) {
      return 'Apenas OpenAI configurada';
    }
    if (diagnostics.hasGeminiKey) {
      return 'Apenas Gemini configurada';
    }
    return 'Sem credenciais de IA';
  }, [diagnostics.hasGeminiKey, diagnostics.hasOpenAiKey]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!openAiApiKey.trim() && !geminiApiKey.trim()) {
      setError('Informe ao menos uma credencial para salvar.');
      return;
    }

    setIsSaving(true);

    try {
      const result = await saveAiCredentials({
        openAiApiKey: openAiApiKey.trim() || undefined,
        geminiApiKey: geminiApiKey.trim() || undefined,
        targetLocation: 'supabase',
      });

      setDiagnostics(result.diagnostics ?? diagnostics);
      setOpenAiApiKey(result.diagnostics?.openAiApiKey ?? openAiApiKey);
      setGeminiApiKey(result.diagnostics?.geminiApiKey ?? geminiApiKey);
      setMessage('Credenciais salvas com sucesso. As funcionalidades de IA ja podem usar a configuracao atualizada.');
    }
    catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar as credenciais.');
    }
    finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Destino atual</p>
          <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
            {formatLocation(diagnostics.location)}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#5F7077]">Local onde as chaves de IA da plataforma sao gerenciadas.</p>
        </article>

        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Provedores</p>
          <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
            {providerStatus}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#5F7077]">Recomendado manter 2 IAs para fallback automatico.</p>
        </article>

        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Ultima verificacao</p>
          <p className="mt-3 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
            {diagnostics.checkedAt
              ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(diagnostics.checkedAt))
              : '--'}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#5F7077]">Status consolidado da configuracao de IA.</p>
        </article>
      </section>

      <section className="space-y-3 border border-[#D8E6EB] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Diagnostico</p>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            className="rounded-none border-[#D8E6EB]"
            onClick={async () => {
              setIsLoading(true);
              try {
                const refreshed = await fetchAiCredentialsDiagnostics();
                setDiagnostics(refreshed);
                setOpenAiApiKey(refreshed.openAiApiKey ?? '');
                setGeminiApiKey(refreshed.geminiApiKey ?? '');
              }
              catch (reloadError) {
                setError(reloadError instanceof Error ? reloadError.message : 'Nao foi possivel atualizar o diagnostico.');
              }
              finally {
                setIsLoading(false);
              }
            }}
          >
            {isLoading ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>

        <div className="space-y-2">
          {(diagnostics.checks ?? []).map((check) => (
            <article
              key={check.key}
              className={`border px-4 py-3 ${
                check.status === 'ok'
                  ? 'border-emerald-200 bg-emerald-50'
                  : check.status === 'warning'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-rose-200 bg-rose-50'
              }`}
            >
              <p className="text-sm font-black text-[#15323b]">{check.label}</p>
              <p className="mt-1 text-xs font-semibold text-[#5F7077]">{check.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <form onSubmit={(event) => void handleSave(event)} className="space-y-5 border border-[#D8E6EB] bg-white p-5 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Credenciais de IA</p>
          <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">Atualizar chaves da plataforma</h3>
          <p className="mt-2 text-sm leading-6 text-[#5F7077]">
            As funcionalidades de IA da plataforma usam OpenAI como primaria e Gemini como fallback automatico quando disponivel.
          </p>
        </div>

        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">OpenAI API Key (primaria)</span>
          <input
            type="password"
            value={openAiApiKey}
            onChange={(event) => setOpenAiApiKey(event.target.value)}
            placeholder={diagnostics.hasOpenAiKey ? 'Ja configurada (digite apenas para substituir)' : 'sk-...'}
            className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Gemini API Key (fallback)</span>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(event) => setGeminiApiKey(event.target.value)}
            placeholder={diagnostics.hasGeminiKey ? 'Ja configurada (digite apenas para substituir)' : 'AIza...'}
            className="h-11 rounded-[14px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSaving} className="rounded-none bg-[#1398B7] font-black text-white hover:bg-[#0F7E99]">
            {isSaving ? 'Salvando...' : 'Salvar credenciais de IA'}
          </Button>
        </div>
      </form>
    </div>
  );
}
