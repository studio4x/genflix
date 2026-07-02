import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/forms/password-field';
import { brazilStateOptions, useBrazilCities } from '@/features/address/brazil-address';
import { formatCpf, isValidCpf, normalizeCpfDigits } from '@/features/document/cpf';
import type { AdminAssignableRoleCode, AdminUserListItem, UpdateAdminUserInput } from '@/features/admin/users/api';

const roleOptions: Array<{
  code: AdminAssignableRoleCode;
  title: string;
  description: string;
}> = [
  {
    code: 'aluno',
    title: 'Aluno',
    description: 'Acessa cursos liberados, aulas, quizzes e progresso.',
  },
  {
    code: 'criador',
    title: 'Autor',
    description: 'Acompanha relatórios e edita informações vinculadas ao perfil.',
  },
  {
    code: 'admin',
    title: 'Admin',
    description: 'Acesso completo ao painel administrativo da plataforma.',
  },
];

const localeOptions = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (United States)' },
];

const timezoneOptions = [
  { value: 'America/Sao_Paulo', label: 'Brasília (UTC-03:00)' },
  { value: 'America/Recife', label: 'Recife (UTC-03:00)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-04:00)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-05:00)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-02:00)' },
];

function normalizeFullName(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits.length > 0 ? digits : null;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : '';
  }
  const ddd = digits.slice(0, 2);
  const remaining = digits.slice(2);
  const firstPartLength = digits.length > 10 ? 5 : 4;
  if (remaining.length <= firstPartLength) {
    return `(${ddd}) ${remaining}`;
  }
  return `(${ddd}) ${remaining.slice(0, firstPartLength)}-${remaining.slice(firstPartLength)}`;
}

function formatPostalCode(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizePostalCode(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 0 ? digits : null;
}

function normalizeStateCode(value: string) {
  const trimmed = value.trim().toUpperCase().slice(0, 2);
  return trimmed.length > 0 ? trimmed : null;
}

function getPrimaryRoleCode(user: AdminUserListItem) {
  return (
    user.roles.find((role) => role.code === 'admin')?.code ??
    user.roles.find((role) => role.code === 'criador' || role.code === 'professor')?.code ??
    user.roles.find((role) => role.code === 'aluno' || role.code === 'student')?.code ??
    user.roles[0]?.code ??
    'aluno'
  ) as AdminAssignableRoleCode;
}

export function AdminUserEditModal({
  error,
  isSaving,
  user,
  onClose,
  onSubmit,
}: {
  error: string | null;
  isSaving: boolean;
  user: AdminUserListItem;
  onClose: () => void;
  onSubmit: (payload: UpdateAdminUserInput) => Promise<void>;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleCode, setRoleCode] = useState<AdminAssignableRoleCode>('aluno');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [cpf, setCpf] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [state, setState] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [locale, setLocale] = useState('pt-BR');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [formError, setFormError] = useState<string | null>(null);
  const { cities, isLoadingCities } = useBrazilCities(state);

  useEffect(() => {
    setFullName(user.full_name ?? '');
    setEmail(user.email ?? '');
    setPassword('');
    setRoleCode(getPrimaryRoleCode(user));
    setAvatarUrl(user.avatar_url ?? '');
    setCpf(formatCpf(user.cpf ?? ''));
    setWhatsappNumber(formatPhone(user.whatsapp_number ?? ''));
    setAddress(user.address ?? '');
    setAddressNumber(user.address_number ?? '');
    setAddressComplement(user.address_complement ?? '');
    setPostalCode(formatPostalCode(user.postal_code ?? ''));
    setState(user.state ?? '');
    setProvince(user.province ?? '');
    setCity(user.city ?? '');
    setLocale(user.locale ?? 'pt-BR');
    setTimezone(user.timezone ?? 'America/Sao_Paulo');
    setFormError(null);
  }, [user]);

  useEffect(() => {
    if (!state) {
      setCity('');
      return;
    }

    if (city && !cities.some((option) => option.value === city)) {
      setCity('');
    }
  }, [cities, city, state]);

  const summaryLabel = useMemo(() => user.full_name?.trim() || user.email, [user.email, user.full_name]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFormError('Informe um e-mail válido.');
      return;
    }

    if (password) {
      const passwordChecks = [
        [password.length >= 10, 'Senha deve ter pelo menos 10 caracteres.'],
        [password.length <= 72, 'Senha deve ter no máximo 72 caracteres.'],
        [/[a-z]/.test(password), 'Senha deve conter letra minúscula.'],
        [/[A-Z]/.test(password), 'Senha deve conter letra maiúscula.'],
        [/\d/.test(password), 'Senha deve conter número.'],
        [/[^A-Za-z0-9]/.test(password), 'Senha deve conter símbolo.'],
      ] as const;
      const passwordError = passwordChecks.find(([isValid]) => !isValid)?.[1] ?? null;
      if (passwordError) {
        setFormError(passwordError);
        return;
      }
    }

    const normalizedCpf = normalizeCpfDigits(cpf);
    if (normalizedCpf && !isValidCpf(normalizedCpf)) {
      setFormError('CPF inválido.');
      return;
    }

    try {
      await onSubmit({
        email: normalizedEmail,
        fullName: normalizeFullName(fullName),
        password: password.trim() || undefined,
        roleCode,
        avatarUrl: normalizeText(avatarUrl),
        cpf: normalizedCpf || null,
        whatsappNumber: normalizePhone(whatsappNumber),
        address: normalizeText(address),
        addressNumber: normalizeText(addressNumber),
        addressComplement: normalizeText(addressComplement),
        postalCode: normalizePostalCode(postalCode),
        state: normalizeStateCode(state),
        province: normalizeText(province),
        city: city.trim() || null,
        timezone,
        locale,
      });
    }
    catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar o usuário.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-user-edit-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-[1024px] flex-col overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-[0_30px_90px_rgba(6,27,33,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[#F2F8FA] px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Usuários</p>
            <h2 id="admin-user-edit-modal-title" className="mt-2 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
              Editar usuário
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5F7077]">
              Atualize todos os campos do cadastro, perfil, acesso e preferências em um só lugar.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8E6EB] text-[#5F7077] transition-colors hover:bg-white"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="grid gap-0 overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" onSubmit={(event) => void handleSubmit(event)}>
          <div className="border-b border-[#D8E6EB] bg-[#F7FBFC] px-6 py-5 lg:border-b-0 lg:border-r">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Resumo</p>
            <h3 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">{summaryLabel}</h3>
            <p className="mt-2 text-sm font-semibold text-[#5F7077]">{user.email}</p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">ID</p>
                <p className="mt-1 break-all text-sm font-semibold text-[#15323b]">{user.id}</p>
              </div>
              <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Criado em</p>
                <p className="mt-1 text-sm font-semibold text-[#15323b]">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(user.created_at))}</p>
              </div>
              <div className="rounded-2xl border border-[#D8E6EB] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Atualizado em</p>
                <p className="mt-1 text-sm font-semibold text-[#15323b]">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(user.updated_at))}</p>
              </div>
            </div>

            {user.avatar_url ? (
              <div className="mt-5 overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white">
                <img src={user.avatar_url} alt="Avatar do usuário" className="h-44 w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div className="px-6 py-6">
            <div className="space-y-6">
              <section className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Acesso</p>
                  <h3 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Login e permissão</h3>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Tipo de usuário</span>
                  <div className="grid gap-2">
                    {roleOptions.map((role) => {
                      const isSelected = roleCode === role.code;
                      return (
                        <button
                          key={role.code}
                          type="button"
                          onClick={() => setRoleCode(role.code)}
                          className={`rounded-2xl border p-4 text-left transition ${isSelected ? 'border-[#1398B7] bg-white shadow-[0_12px_28px_rgba(19,152,183,0.12)]' : 'border-[#D8E6EB] bg-white/70 hover:border-[#1398B7]/40'}`}
                        >
                          <span className="font-readex text-sm font-semibold text-[#15323b]">{role.title}</span>
                          <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#6d7a80]">{role.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">E-mail</span>
                  <input
                    className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="nome@email.com"
                  />
                </label>

                <label className="block space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nova senha</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1398B7]">Opcional</span>
                  </div>
                  <PasswordField
                    className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Deixe em branco para manter a senha atual"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Idioma</span>
                    <select
                      value={locale}
                      onChange={(event) => setLocale(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#163138] outline-none transition focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    >
                      {localeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Fuso horário</span>
                    <select
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#163138] outline-none transition focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    >
                      {timezoneOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Perfil</p>
                  <h3 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Dados públicos e contato</h3>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nome completo</span>
                  <input
                    className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Nome de exibição"
                    maxLength={120}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Avatar URL</span>
                  <input
                    className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    type="url"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">CPF</span>
                    <input
                      className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                      type="text"
                      inputMode="numeric"
                      value={cpf}
                      onChange={(event) => setCpf(formatCpf(event.target.value))}
                      placeholder="000.000.000-00"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Celular</span>
                    <input
                      className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                      type="tel"
                      inputMode="tel"
                      value={whatsappNumber}
                      onChange={(event) => setWhatsappNumber(formatPhone(event.target.value))}
                      placeholder="(99) 99999-9999"
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Endereço</p>
                  <h3 className="mt-1 font-readex text-xl font-semibold text-[#15323b]">Localização e entrega</h3>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">CEP</span>
                  <input
                    className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    type="text"
                    value={postalCode}
                    onChange={(event) => setPostalCode(formatPostalCode(event.target.value))}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Estado</span>
                    <select
                      value={state}
                      onChange={(event) => {
                        setState(event.target.value);
                        setCity('');
                      }}
                      className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#163138] outline-none transition focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    >
                      <option value="">Selecione</option>
                      {brazilStateOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Cidade</span>
                    <select
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      disabled={!state || isLoadingCities}
                      className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#163138] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    >
                      <option value="">
                        {!state ? 'Selecione o estado' : isLoadingCities ? 'Carregando cidades...' : 'Selecione a cidade'}
                      </option>
                      {cities.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Bairro</span>
                  <input
                    className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    type="text"
                    value={province}
                    onChange={(event) => setProvince(event.target.value)}
                    placeholder="Centro"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Endereço</span>
                  <input
                    className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                    type="text"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Rua, avenida, praça..."
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Número</span>
                    <input
                      className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                      type="text"
                      value={addressNumber}
                      onChange={(event) => setAddressNumber(event.target.value)}
                      placeholder="123"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Complemento</span>
                    <input
                      className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#163138] outline-none transition placeholder:text-[#5F7077] focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                      type="text"
                      value={addressComplement}
                      onChange={(event) => setAddressComplement(event.target.value)}
                      placeholder="Apto, bloco..."
                    />
                  </label>
                </div>
              </section>
            </div>

            {formError ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{formError}</div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{error}</div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#D8E6EB] pt-5 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="h-11 rounded-2xl bg-[#1398B7] px-5 font-black hover:bg-[#0A3640]">
                {isSaving ? 'Salvando...' : 'Salvar usuário'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
