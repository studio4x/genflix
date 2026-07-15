import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/app/providers/auth-provider';
import { PasswordField } from '@/components/forms/password-field';
import { Button } from '@/components/ui/button';
import { fetchCreatorPayoutProfile, fetchCreatorPublicProfile, upsertCreatorPayoutProfile, upsertCreatorPublicProfile, type PixKeyType, } from '@/features/creator/profile/api';
function slugifyPublicTitle(value: string) {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
export function CreatorProfilePage() {
    const { profile, user, updatePassword, updateProfile } = useAuth();
    const [fullName, setFullName] = useState('');
    const [timezone, setTimezone] = useState('America/Sao_Paulo');
    const [locale, setLocale] = useState('pt-BR');
    const [newPassword, setNewPassword] = useState('');
    const [payoutName, setPayoutName] = useState('');
    const [document, setDocument] = useState('');
    const [pixKeyType, setPixKeyType] = useState<PixKeyType | ''>('');
    const [pixKey, setPixKey] = useState('');
    const [publicTitle, setPublicTitle] = useState('');
    const [publicLongBio, setPublicLongBio] = useState('');
    const [profileMessage, setProfileMessage] = useState<string | null>(null);
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
    const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isSavingPayout, setIsSavingPayout] = useState(false);
    useEffect(() => {
        setFullName(profile?.full_name ?? '');
        setTimezone(profile?.timezone ?? 'America/Sao_Paulo');
        setLocale(profile?.locale ?? 'pt-BR');
    }, [profile]);
    useEffect(() => {
        let isMounted = true;
        async function loadPayoutProfile() {
            if (!user?.id)
                return;
            try {
                const [payoutProfile, publicProfile] = await Promise.all([
                    fetchCreatorPayoutProfile(user.id),
                    fetchCreatorPublicProfile(user.id),
                ]);
                if (!isMounted) {
                    return;
                }
                if (payoutProfile) {
                    setPayoutName(payoutProfile.payout_name ?? '');
                    setDocument(payoutProfile.document ?? '');
                    setPixKeyType(payoutProfile.pix_key_type ?? '');
                    setPixKey(payoutProfile.pix_key ?? '');
                }
                setPublicTitle(publicProfile?.public_title ?? profile?.full_name ?? '');
                setPublicLongBio(publicProfile?.public_long_bio ?? publicProfile?.public_short_bio ?? '');
            }
            catch (error) {
                if (isMounted) {
                    setPayoutMessage(error instanceof Error ? error.message : 'Não foi possível carregar os dados de repasse.');
                }
            }
        }
        void loadPayoutProfile();
        return () => {
            isMounted = false;
        };
    }, [user?.id, profile?.avatar_url, profile?.full_name]);
    const publicSlug = slugifyPublicTitle(publicTitle || profile?.full_name || '');
    async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSavingProfile(true);
        setProfileMessage(null);
        try {
            await updateProfile({
                full_name: fullName.trim() || null,
                timezone,
                locale,
            });
            setProfileMessage('Perfil atualizado com sucesso.');
        }
        catch (error) {
            setProfileMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.');
        }
        finally {
            setIsSavingProfile(false);
        }
    }
    async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSavingPassword(true);
        setPasswordMessage(null);
        try {
            await updatePassword(newPassword);
            setNewPassword('');
            setPasswordMessage('Senha atualizada com sucesso.');
        }
        catch (error) {
            setPasswordMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.');
        }
        finally {
            setIsSavingPassword(false);
        }
    }
    async function handlePayoutSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user?.id)
            return;
        setIsSavingPayout(true);
        setPayoutMessage(null);
        try {
            await upsertCreatorPayoutProfile({
                userId: user.id,
                payoutName,
                document,
                pixKeyType,
                pixKey,
            });
            setPayoutMessage('Dados de repasse PIX atualizados com sucesso.');
        }
        catch (error) {
            setPayoutMessage(error instanceof Error ? error.message : 'Não foi possível atualizar os dados de repasse.');
        }
        finally {
            setIsSavingPayout(false);
        }
    }
    async function handlePublicProfileSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user?.id)
            return;
        setPayoutMessage(null);
        try {
            await upsertCreatorPublicProfile({
                userId: user.id,
                publicSlug,
                publicTitle,
                publicShortBio: '',
                publicLongBio,
                publicAreas: [],
                publicEducation: '',
                publicExperience: '',
                publicWebsiteUrl: '',
                publicInstagramUrl: '',
                publicLinkedinUrl: '',
                publicYoutubeUrl: '',
            });
            setPayoutMessage('Perfil público atualizado com sucesso.');
        }
        catch (error) {
            setPayoutMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil público.');
        }
    }
    return (<div className="space-y-6">
      <header className="border-b border-[#D8E6EB] pb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Minha conta</p>
        <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Dados do autor</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
          Atualize seus dados de exibição e segurança da conta de autor.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={(event) => void handleProfileSubmit(event)} className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
          <h2 className="font-readex text-xl font-semibold text-[#15323b]">Dados do perfil</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nome</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]" placeholder="Seu nome"/>
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">E-mail</span>
              <input value={profile?.email ?? ''} disabled className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white/70 px-4 text-sm font-semibold text-[#5F7077] outline-none"/>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Fuso horário</span>
                <input value={timezone} onChange={(event) => setTimezone(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"/>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Idioma</span>
                <input value={locale} onChange={(event) => setLocale(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"/>
              </label>
            </div>
          </div>
          {profileMessage ? <p className="mt-4 text-sm font-semibold text-[#5f7077]">{profileMessage}</p> : null}
          <Button type="submit" disabled={isSavingProfile} className="mt-5 h-12 rounded-2xl bg-[#1398B7] px-6 font-black text-white hover:bg-[#0A3640]">
            {isSavingProfile ? 'Salvando...' : 'Salvar perfil'}
          </Button>
        </form>

        <div className="space-y-5">
          <form onSubmit={(event) => void handlePasswordSubmit(event)} className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
            <h2 className="font-readex text-xl font-semibold text-[#15323b]">Seguranca</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nova senha</span>
                <PasswordField value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]" placeholder="Digite a nova senha" required/>
              </label>
            </div>
            {passwordMessage ? <p className="mt-4 text-sm font-semibold text-[#5f7077]">{passwordMessage}</p> : null}
            <Button type="submit" disabled={isSavingPassword} className="mt-5 h-12 rounded-2xl bg-[#15323b] px-6 font-black text-white hover:bg-[#0d252d]">
              {isSavingPassword ? 'Atualizando...' : 'Atualizar senha'}
            </Button>
          </form>
        </div>
      </section>

      <form onSubmit={(event) => void handlePayoutSubmit(event)} className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Repasse de comissão</p>
            <h2 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">Dados PIX do autor</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
              As comissões ficam disponíveis para repasse em até 30 dias após a venda. Se a compra for estornada, a comissão também será cancelada ou ajustada.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nome do favorecido</span>
            <input value={payoutName} onChange={(event) => setPayoutName(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]" placeholder="Nome completo ou razão social"/>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">CPF/CNPJ</span>
            <input value={document} onChange={(event) => setDocument(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]" placeholder="Documento do favorecido"/>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Tipo de chave PIX</span>
            <select value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value as PixKeyType | '')} className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]">
              <option value="">Selecione</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Chave aleatória</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Chave PIX</span>
            <input value={pixKey} onChange={(event) => setPixKey(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]" placeholder="Digite a chave PIX"/>
          </label>
        </div>

        {payoutMessage ? <p className="mt-4 text-sm font-semibold text-[#5f7077]">{payoutMessage}</p> : null}
        <Button type="submit" disabled={isSavingPayout} className="mt-5 h-12 rounded-2xl bg-[#1398B7] px-6 font-black text-white hover:bg-[#0A3640]">
          {isSavingPayout ? 'Salvando...' : 'Salvar dados PIX'}
        </Button>
      </form>

      <form onSubmit={(event) => void handlePublicProfileSubmit(event)} className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Perfil público</p>
            <h2 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">Dados do autor</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
              Esses dois campos alimentam a apresentação pública do autor e a relação de autores nos cursos.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nome público</span>
            <input value={publicTitle} onChange={(event) => setPublicTitle(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]" placeholder="Nome exibido na página pública"/>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Sobre o autor</span>
            <textarea value={publicLongBio} onChange={(event) => setPublicLongBio(event.target.value)} className="mt-2 min-h-28 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#1398B7]" placeholder="Biografia detalhada do autor"/>
          </label>
        </div>

        <Button type="submit" className="mt-5 h-12 rounded-2xl bg-[#1398B7] px-6 font-black text-white hover:bg-[#0A3640]">
          Salvar perfil público
        </Button>
      </form>
    </div>);
}
