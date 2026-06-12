import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { PasswordField } from '@/components/forms/password-field';
import { Button } from '@/components/ui/button';
import { brazilStateOptions, useBrazilCities } from '@/features/address/brazil-address';
import { useBrazilCepLookup } from '@/features/address/brazil-cep';
import { uploadProfileAvatar } from '@/features/account/avatar-api';
import { formatCpf, isValidCpf, normalizeCpfDigits } from '@/features/document/cpf';
const localeOptions = [
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'en-US', label: 'English (United States)' },
];
const timezoneOptions = [
    { value: 'America/Sao_Paulo', label: 'Brasília (UTC-03:00)' },
    { value: 'America/Recife', label: 'Recife (UTC-03:00)' },
    { value: 'America/Manaus', label: 'Manaus (UTC-04:00)' },
    { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-05:00)' },
    { value: 'America/Noronha', label: "Fernando de N?oronha (UTC-02:00)" },
];
function normalizeFullName(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeText(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '';
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
function normalizeStateCode(value: string) {
    return value.trim().toUpperCase().slice(0, 2);
}
export function StudentAccountPage() {
    const { profile, updatePassword, updateProfile, user } = useAuth();
    const [fullName, setFullName] = useState('');
    const [cpf, setCpf] = useState('');
    const [whatsAppNumber, setWhatsAppNumber] = useState('');
    const [address, setAddress] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [addressComplement, setAddressComplement] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [state, setState] = useState('');
    const [province, setProvince] = useState('');
    const [city, setCity] = useState('');
    const [locale, setLocale] = useState('pt-BR');
    const [timezone, setTimezone] = useState('America/Sao_Paulo');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileMessage, setProfileMessage] = useState<string | null>(null);
    const [cpfFieldError, setCpfFieldError] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
    const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const { cities, isLoadingCities } = useBrazilCities(state);
    const { address: cepAddress, addressError: cepError, isLoadingAddress: isLoadingCepAddress, } = useBrazilCepLookup(postalCode);
    useEffect(() => {
        if (!profile) {
            return;
        }
        setFullName(profile.full_name ?? '');
        setCpf(formatCpf(profile.cpf ?? ''));
        setWhatsAppNumber(formatPhone(profile.whatsapp_number ?? ''));
        setAddress(profile.address ?? '');
        setAddressNumber(profile.address_number ?? '');
        setAddressComplement(profile.address_complement ?? '');
        setPostalCode(formatPostalCode(profile.postal_code ?? ''));
        setState(normalizeStateCode(profile.state ?? ''));
        setProvince(profile.province ?? '');
        setCity(profile.city ?? '');
        setLocale(profile.locale);
        setTimezone(profile.timezone);
    }, [profile]);
    useEffect(() => {
        if (!cepAddress) {
            return;
        }
        setAddress(cepAddress.street);
        setProvince(cepAddress.district);
        setState(cepAddress.stateCode);
        setCity(cepAddress.cityCode);
    }, [cepAddress]);
    const hasProfileChanges = useMemo(() => {
        if (!profile) {
            return false;
        }
        return (normalizeFullName(fullName) !== profile.full_name ||
            normalizeCpfDigits(cpf) !== normalizeCpfDigits(profile.cpf ?? '') ||
            whatsAppNumber.replace(/\D/g, '') !== (profile.whatsapp_number ?? '').replace(/\D/g, '') ||
            normalizeText(address) !== (profile.address ?? '') ||
            normalizeText(addressNumber) !== (profile.address_number ?? '') ||
            normalizeText(addressComplement) !== (profile.address_complement ?? '') ||
            postalCode.replace(/\D/g, '') !== (profile.postal_code ?? '').replace(/\D/g, '') ||
            normalizeStateCode(state) !== (profile.state ?? '') ||
            normalizeText(province) !== (profile.province ?? '') ||
            city.replace(/\D/g, '') !== (profile.city ?? '').replace(/\D/g, '') ||
            locale !== profile.locale ||
            timezone !== profile.timezone);
    }, [
        address,
        addressComplement,
        addressNumber,
        city,
        cpf,
        fullName,
        locale,
        postalCode,
        profile,
        state,
        province,
        timezone,
        whatsAppNumber,
    ]);
    async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setProfileError(null);
        setProfileMessage(null);
        setCpfFieldError(false);
        if (!profile) {
            setProfileError('Perfil do aluno não carregado.');
            return;
        }
        const normalizedCpf = normalizeCpfDigits(cpf);
        if (normalizedCpf.length > 0 && !isValidCpf(normalizedCpf)) {
            setCpfFieldError(true);
            setProfileError('CPF inválido.');
            return;
        }
        setIsSavingProfile(true);
        try {
            await updateProfile({
                full_name: normalizeFullName(fullName),
                cpf: normalizedCpf || null,
                whatsapp_number: whatsAppNumber.replace(/\D/g, '') || null,
                address: normalizeText(address) || null,
                address_number: normalizeText(addressNumber) || null,
                address_complement: normalizeText(addressComplement) || null,
                postal_code: postalCode.replace(/\D/g, '') || null,
                state: normalizeStateCode(state) || null,
                province: normalizeText(province) || null,
                city: city.replace(/\D/g, '') || null,
                locale,
                timezone,
            });
            setProfileMessage('Dados atualizados com sucesso.');
        }
        catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'Falha ao atualizar os dados.';
            setProfileError(message);
            setCpfFieldError(message === 'CPF inválido.');
        }
        finally {
            setIsSavingProfile(false);
        }
    }
    async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPasswordError(null);
        setPasswordMessage(null);
        if (password.length < 8) {
            setPasswordError('A senha precisa ter pelo menos 8 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            setPasswordError('As senhas não conferem.');
            return;
        }
        setIsSavingPassword(true);
        try {
            await updatePassword(password);
            setPassword('');
            setConfirmPassword('');
            setPasswordMessage('Senha atualizada com sucesso.');
        }
        catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'Falha ao atualizar a senha.';
            setPasswordError(message);
        }
        finally {
            setIsSavingPassword(false);
        }
    }
    async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        setAvatarMessage(null);
        setAvatarError(null);
        if (!file || !user?.id) {
            return;
        }
        if (!file.type.startsWith('image/')) {
            setAvatarError('Selecione uma imagem valida para o avatar.');
            return;
        }
        setIsUploadingAvatar(true);
        try {
            const asset = await uploadProfileAvatar(file, user.id);
            await updateProfile({ avatar_url: asset.publicUrl });
            setAvatarMessage('Avatar atualizado com sucesso.');
        }
        catch (uploadError) {
            setAvatarError(uploadError instanceof Error ? uploadError.message : 'Falha ao enviar o avatar.');
        }
        finally {
            setIsUploadingAvatar(false);
        }
    }
    return (<div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-slate-100 pb-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Minha Conta
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">Gerencie seus dados</h2>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              Atualize suas informações de perfil e reforce a segurança da sua conta sem sair da área do aluno.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">E-mail</p>
            <p className="mt-2 break-all text-sm font-bold text-slate-800">{profile?.email ?? '-'}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Acesso</p>
            <p className="mt-2 text-sm font-bold text-slate-800">Aluno</p>
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <form onSubmit={handleProfileSubmit} className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Perfil</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Dados pessoais</h3>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">
              Editável
            </span>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">Nome completo</span>
              <input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Como você deseja aparecer na plataforma"/>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">CPF</span>
              <input className={`h-12 w-full rounded-2xl border bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:bg-white ${cpfFieldError ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-400'}`} type="text" inputMode="numeric" value={cpf} onChange={(event) => {
            setCpfFieldError(false);
            setCpf(formatCpf(event.target.value));
        }} placeholder="000.000.000-00" autoComplete="off" aria-invalid={cpfFieldError || undefined}/>
              <p className={`text-xs font-medium ${cpfFieldError ? 'text-red-600' : 'text-slate-500'}`}>
                {cpfFieldError ? 'CPF inválido.' : 'O CPF sera usado no checkout e na validacao cadastral da conta.'}
              </p>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Celular</span>
              <input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" type="tel" inputMode="tel" value={whatsAppNumber} onChange={(event) => setWhatsAppNumber(formatPhone(event.target.value))} placeholder="(99) 99999-9999" autoComplete="tel"/>
              <p className="text-xs font-medium text-slate-500">
                Esse numero podera ser usado nas notificacoes e no checkout da compra.
              </p>
            </label>

            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">CEP</span>
              <input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" type="text" value={postalCode} onChange={(event) => setPostalCode(formatPostalCode(event.target.value))} placeholder="00000-000" inputMode="numeric" autoComplete="postal-code"/>
              <p className="text-xs font-medium text-slate-500">
                {isLoadingCepAddress ? 'Buscando endereco pelo CEP...' : cepError || "Digite o CEP para preencher os dados automticamente."}
              </p>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Estado</span>
              <select className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" value={state} onChange={(event) => {
            setState(event.target.value);
            setCity('');
        }} autoComplete="address-level1">
                <option value="">Selecione</option>
                {brazilStateOptions.map((option) => (<option key={option.value} value={option.value}>
                    {option.label}
                  </option>))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Cidade</span>
              <select className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60" value={city} onChange={(event) => setCity(event.target.value)} disabled={!state || isLoadingCities} autoComplete="address-level2">
                <option value="">
                  {!state ? "Selecione o est?do" : isLoadingCities ? 'Carregando cidades...' : 'Selecione a cidade'}
                </option>
                {cities.map((option) => (<option key={option.value} value={option.value}>
                    {option.label}
                  </option>))}
              </select>
            </label>

            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">Endereço</span>
              <input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" type="text" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Rua, avenida, praça..." autoComplete="address-line1"/>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Número</span>
              <input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" type="text" value={addressNumber} onChange={(event) => setAddressNumber(event.target.value)} placeholder="123" autoComplete="address-line2"/>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Complemento</span>
              <input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" type="text" value={addressComplement} onChange={(event) => setAddressComplement(event.target.value)} placeholder="Apto, bloco..." autoComplete="address-line3"/>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Bairro</span>
              <input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" type="text" value={province} onChange={(event) => setProvince(event.target.value)} placeholder="Centro" autoComplete="address-level3"/>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Idioma</span>
              <select className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" value={locale} onChange={(event) => setLocale(event.target.value)}>
                {localeOptions.map((option) => (<option key={option.value} value={option.value}>
                    {option.label}
                  </option>))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Fuso horário</span>
              <select className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                {timezoneOptions.map((option) => (<option key={option.value} value={option.value}>
                    {option.label}
                  </option>))}
              </select>
            </label>

            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">E-mail</span>
              <input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500 outline-none" type="email" value={profile?.email ?? ''} readOnly disabled/>
              <p className="text-xs font-medium text-slate-500">O e-mail atual é exibido para referência. Nest? versão, a alteração permanece centralizada no fluxo administrativo.
              </p>
            </label>
          </div>

          {profileMessage ? (<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {profileMessage}
            </div>) : null}
          {profileError ? (<div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {profileError}
            </div>) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-500">
              Atualize seu nome de exibição e preferências locais para refletir essas mudanças em toda a área do aluno.
            </p>
            <Button type="submit" disabled={!hasProfileChanges || isSavingProfile} className="h-12 rounded-2xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700">
              {isSavingProfile ? 'Salvando...' : 'Salvar dados'}
            </Button>
          </div>
        </form>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Avatar</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Foto de perfil</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Envie uma imagem para personalizar sua conta no dashboard e nos atalhos do aluno.
                </p>
              </div>

              {profile?.avatar_url ? (<img src={profile.avatar_url} alt="Avatar atual do aluno" className="h-20 w-20 rounded-[24px] border border-slate-200 object-cover shadow-sm"/>) : (<div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#1398B7] to-[#0A3640] text-xl font-black text-white shadow-sm">
                  {(fullName || profile?.email || 'AL').slice(0, 2).toUpperCase()}
                </div>)}
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-bold text-slate-700">Nova imagem</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void handleAvatarChange(event)} className="block w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-bold file:text-white hover:file:bg-blue-700" disabled={isUploadingAvatar}/>
              </label>

              <p className="text-xs font-medium text-slate-500">
                Formatos recomendados: JPG, PNG, WEBP ou GIF.
              </p>

              {avatarMessage ? (<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {avatarMessage}
                </div>) : null}

              {avatarError ? (<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {avatarError}
                </div>) : null}
            </div>
          </article>

          <form onSubmit={handlePasswordSubmit} className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Segurança</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Trocar senha</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Use uma senha forte com pelo menos 8 caracteres para proteger o seu acesso.
              </p>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-bold text-slate-700">Nova senha</span>
                <PasswordField className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" required/>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-slate-700">Confirmar nova senha</span>
                <PasswordField className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova senha" required/>
              </label>
            </div>

            {passwordMessage ? (<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {passwordMessage}
              </div>) : null}
            {passwordError ? (<div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {passwordError}
              </div>) : null}

            <Button type="submit" disabled={isSavingPassword} className="mt-6 h-12 w-full rounded-2xl bg-slate-900 font-bold text-white hover:bg-slate-800">
              {isSavingPassword ? 'Atualizando...' : 'Atualizar senha'}
            </Button>
          </form>

          <article className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Acesso rápido</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight">Voltar para a jornada</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              Depois de atualizar seu perfil, retorne ao painel principal ou abra seus cursos para continuar os treinamentos.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/aluno/dashboard" className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-black text-slate-900 transition-colors hover:bg-slate-100">
                Ir para dashboard
              </Link>
              <Link to="/aluno/cursos" className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-black text-white transition-colors hover:bg-white/15">
                Ver cursos
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>);
}
