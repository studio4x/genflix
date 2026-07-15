import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useAuth } from '@/app/providers/auth-provider';
import { PasswordField } from '@/components/forms/password-field';
import { Button } from '@/components/ui/button';
import { uploadProfileAvatar } from '@/features/account/avatar-api';
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
const AVATAR_CROP_SIZE = 320;
type AvatarCropDraft = {
    file: File;
    sourceUrl: string;
    naturalWidth: number;
    naturalHeight: number;
    zoom: number;
    offsetX: number;
    offsetY: number;
};
function clampAvatarOffset(value: number, displayedSize: number) {
    const maxOffset = Math.max(0, (displayedSize - AVATAR_CROP_SIZE) / 2);
    return Math.min(Math.max(value, -maxOffset), maxOffset);
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
    const [publicProfileMessage, setPublicProfileMessage] = useState<string | null>(null);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isSavingPayout, setIsSavingPayout] = useState(false);
    const [isSavingPublicProfile, setIsSavingPublicProfile] = useState(false);
    const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarCropDraft, setAvatarCropDraft] = useState<AvatarCropDraft | null>(null);
    const cropDragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
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
        setIsSavingPublicProfile(true);
        setPublicProfileMessage(null);
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
            setPublicProfileMessage('Perfil público atualizado com sucesso.');
        }
        catch (error) {
            setPublicProfileMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil público.');
        }
        finally {
            setIsSavingPublicProfile(false);
        }
    }
    function closeAvatarCrop() {
        if (avatarCropDraft?.sourceUrl.startsWith('blob:')) {
            URL.revokeObjectURL(avatarCropDraft.sourceUrl);
        }
        cropDragRef.current = null;
        setAvatarCropDraft(null);
    }
    function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !user?.id) {
            return;
        }
        if (!file.type.startsWith('image/')) {
            setAvatarError('Selecione uma imagem válida para o avatar.');
            return;
        }
        setAvatarMessage(null);
        setAvatarError(null);
        closeAvatarCrop();
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== 'string') {
                setAvatarError('Não foi possível carregar a imagem selecionada.');
                return;
            }
            setAvatarCropDraft({
                file,
                sourceUrl: reader.result,
                naturalWidth: 0,
                naturalHeight: 0,
                zoom: 1,
                offsetX: 0,
                offsetY: 0,
            });
        };
        reader.onerror = () => setAvatarError('Não foi possível ler a imagem selecionada.');
        reader.readAsDataURL(file);
    }
    function handleAvatarImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
        const image = event.currentTarget;
        setAvatarCropDraft((current) => current ? {
            ...current,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
        } : current);
    }
    function handleCropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (!avatarCropDraft?.naturalWidth || isUploadingAvatar) {
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        cropDragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            offsetX: avatarCropDraft.offsetX,
            offsetY: avatarCropDraft.offsetY,
        };
    }
    function handleCropPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        const drag = cropDragRef.current;
        if (!drag || !avatarCropDraft?.naturalWidth) {
            return;
        }
        const baseScale = Math.max(AVATAR_CROP_SIZE / avatarCropDraft.naturalWidth, AVATAR_CROP_SIZE / avatarCropDraft.naturalHeight);
        const displayedWidth = avatarCropDraft.naturalWidth * baseScale * avatarCropDraft.zoom;
        const displayedHeight = avatarCropDraft.naturalHeight * baseScale * avatarCropDraft.zoom;
        setAvatarCropDraft((current) => current ? {
            ...current,
            offsetX: clampAvatarOffset(drag.offsetX + event.clientX - drag.startX, displayedWidth),
            offsetY: clampAvatarOffset(drag.offsetY + event.clientY - drag.startY, displayedHeight),
        } : current);
    }
    function handleCropPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
        if (cropDragRef.current) {
            cropDragRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        }
    }
    function handleAvatarZoomChange(value: number) {
        setAvatarCropDraft((current) => {
            if (!current?.naturalWidth) {
                return current;
            }
            const nextZoom = Math.min(Math.max(value, 1), 3);
            const baseScale = Math.max(AVATAR_CROP_SIZE / current.naturalWidth, AVATAR_CROP_SIZE / current.naturalHeight);
            return {
                ...current,
                zoom: nextZoom,
                offsetX: clampAvatarOffset(current.offsetX, current.naturalWidth * baseScale * nextZoom),
                offsetY: clampAvatarOffset(current.offsetY, current.naturalHeight * baseScale * nextZoom),
            };
        });
    }
    async function handleAvatarCropSubmit() {
        if (!avatarCropDraft?.naturalWidth || !user?.id) {
            return;
        }
        setIsUploadingAvatar(true);
        setAvatarError(null);
        try {
            const image = new Image();
            image.src = avatarCropDraft.sourceUrl;
            await image.decode();
            const baseScale = Math.max(AVATAR_CROP_SIZE / image.naturalWidth, AVATAR_CROP_SIZE / image.naturalHeight);
            const scaledImage = baseScale * avatarCropDraft.zoom;
            const cropSourceSize = AVATAR_CROP_SIZE / scaledImage;
            const cropCenterX = image.naturalWidth / 2 - avatarCropDraft.offsetX / scaledImage;
            const cropCenterY = image.naturalHeight / 2 - avatarCropDraft.offsetY / scaledImage;
            const sourceX = Math.min(Math.max(cropCenterX - cropSourceSize / 2, 0), image.naturalWidth - cropSourceSize);
            const sourceY = Math.min(Math.max(cropCenterY - cropSourceSize / 2, 0), image.naturalHeight - cropSourceSize);
            const canvas = globalThis.document.createElement('canvas');
            canvas.width = AVATAR_CROP_SIZE;
            canvas.height = AVATAR_CROP_SIZE;
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Não foi possível preparar o recorte do avatar.');
            }
            context.drawImage(image, sourceX, sourceY, cropSourceSize, cropSourceSize, 0, 0, AVATAR_CROP_SIZE, AVATAR_CROP_SIZE);
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (!blob) {
                throw new Error('Não foi possível gerar a imagem recortada.');
            }
            const croppedFile = new File([blob], `${avatarCropDraft.file.name.replace(/\.[^.]+$/, '')}-avatar.png`, { type: 'image/png' });
            const asset = await uploadProfileAvatar(croppedFile, user.id);
            await updateProfile({ avatar_url: asset.publicUrl });
            setAvatarMessage('Avatar atualizado com sucesso.');
            closeAvatarCrop();
        }
        catch (error) {
            setAvatarError(error instanceof Error ? error.message : 'Não foi possível atualizar o avatar.');
        }
        finally {
            setIsUploadingAvatar(false);
        }
    }
    const avatarCropLayout = avatarCropDraft?.naturalWidth
        ? (() => {
            const baseScale = Math.max(AVATAR_CROP_SIZE / avatarCropDraft.naturalWidth, AVATAR_CROP_SIZE / avatarCropDraft.naturalHeight);
            return {
                width: avatarCropDraft.naturalWidth * baseScale * avatarCropDraft.zoom,
                height: avatarCropDraft.naturalHeight * baseScale * avatarCropDraft.zoom,
            };
        })()
        : null;
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

        <article className="mt-5 rounded-[24px] border border-[#D8E6EB] bg-white p-5">
          <h3 className="font-readex text-lg font-semibold text-[#15323b]">Avatar do autor</h3>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar atual do autor" className="h-24 w-24 rounded-[24px] border border-[#D8E6EB] object-cover shadow-sm" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#1398B7] to-[#0A3640] text-xl font-black text-white">
                {(fullName || profile?.email || 'CR').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium leading-6 text-[#6d7f84]">Essa imagem será usada como avatar do autor.</p>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void handleAvatarChange(event)} disabled={isUploadingAvatar} className="block w-full cursor-pointer rounded-2xl border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] file:mr-4 file:rounded-xl file:border-0 file:bg-[#1398B7] file:px-4 file:py-2 file:font-black file:text-white hover:file:bg-[#0A3640]" />
              {isUploadingAvatar ? <p className="text-sm font-semibold text-[#5f7077]">Enviando avatar...</p> : null}
              {avatarMessage ? <p className="text-sm font-semibold text-[#5f7077]">{avatarMessage}</p> : null}
              {avatarError ? <p className="text-sm font-semibold text-red-600">{avatarError}</p> : null}
            </div>
          </div>
        </article>

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

        {publicProfileMessage ? <p className="mt-4 text-sm font-semibold text-[#5f7077]">{publicProfileMessage}</p> : null}
        <Button type="submit" disabled={isSavingPublicProfile} className="mt-5 h-12 rounded-2xl bg-[#1398B7] px-6 font-black text-white hover:bg-[#0A3640] disabled:cursor-not-allowed disabled:opacity-60">
          {isSavingPublicProfile ? 'Salvando...' : 'Salvar perfil público'}
        </Button>
      </form>

      {avatarCropDraft ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#061b21]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
          <div className="w-full max-w-lg rounded-[28px] border border-[#D8E6EB] bg-white p-5 shadow-[0_30px_90px_rgba(6,27,33,0.24)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Avatar do autor</p>
                <h2 id="avatar-crop-title" className="mt-2 font-readex text-xl font-semibold text-[#15323b]">Recorte e enquadramento</h2>
                <p className="mt-2 text-sm leading-6 text-[#6d7f84]">Arraste a imagem para posicionar e use o zoom para ajustar o enquadramento quadrado.</p>
              </div>
              <button type="button" onClick={closeAvatarCrop} disabled={isUploadingAvatar} className="rounded-full border border-[#D8E6EB] px-3 py-1 text-sm font-bold text-[#5F7077] hover:bg-[#F2F7F9] disabled:cursor-not-allowed disabled:opacity-50">Fechar</button>
            </div>

            <div
              className="relative mx-auto mt-5 h-80 w-80 max-w-full touch-none overflow-hidden rounded-[28px] bg-[#10242b] ring-4 ring-[#D9F0F5] select-none"
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
              aria-label="Área de recorte do avatar"
            >
              <img
                src={avatarCropDraft.sourceUrl}
                alt="Prévia do recorte do avatar"
                onLoad={handleAvatarImageLoad}
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={avatarCropLayout ? {
                    width: avatarCropLayout.width,
                    height: avatarCropLayout.height,
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${avatarCropDraft.offsetX}px, ${avatarCropDraft.offsetY}px)`,
                } : { visibility: 'hidden' }}
              />
              {!avatarCropLayout ? <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white/80">Carregando imagem...</div> : null}
              <div className="pointer-events-none absolute inset-0 rounded-[28px] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(6,27,33,0.28)]" />
            </div>

            <label className="mt-6 block">
              <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">
                <span>Zoom</span>
                <span>{avatarCropDraft.zoom.toFixed(1)}x</span>
              </div>
              <input type="range" min="1" max="3" step="0.05" value={avatarCropDraft.zoom} onChange={(event) => handleAvatarZoomChange(Number(event.target.value))} disabled={!avatarCropLayout || isUploadingAvatar} className="mt-3 w-full accent-[#1398B7]" />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={closeAvatarCrop} disabled={isUploadingAvatar}>Cancelar</Button>
              <Button type="button" className="rounded-2xl bg-[#1398B7] font-black text-white hover:bg-[#0A3640]" onClick={() => void handleAvatarCropSubmit()} disabled={!avatarCropLayout || isUploadingAvatar}>
                {isUploadingAvatar ? 'Enviando...' : 'Usar este recorte'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>);
}
