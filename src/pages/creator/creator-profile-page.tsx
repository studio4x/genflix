import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { PasswordField } from '@/components/forms/password-field'
import { Button } from '@/components/ui/button'
import { uploadProfileAvatar } from '@/features/account/avatar-api'
import {
  fetchCreatorPayoutProfile,
  upsertCreatorPayoutProfile,
  type PixKeyType,
} from '@/features/creator/profile/api'

export function CreatorProfilePage() {
  const { profile, user, updatePassword, updateProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  const [locale, setLocale] = useState('pt-BR')
  const [newPassword, setNewPassword] = useState('')
  const [payoutName, setPayoutName] = useState('')
  const [document, setDocument] = useState('')
  const [pixKeyType, setPixKeyType] = useState<PixKeyType | ''>('')
  const [pixKey, setPixKey] = useState('')
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState(0)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isSavingPayout, setIsSavingPayout] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name ?? '')
    setTimezone(profile?.timezone ?? 'America/Sao_Paulo')
    setLocale(profile?.locale ?? 'pt-BR')
  }, [profile])

  useEffect(() => {
    let isMounted = true

    async function loadPayoutProfile() {
      if (!user?.id) return

      try {
        const payoutProfile = await fetchCreatorPayoutProfile(user.id)
        if (!isMounted || !payoutProfile) return

        setPayoutName(payoutProfile.payout_name ?? '')
        setDocument(payoutProfile.document ?? '')
        setPixKeyType(payoutProfile.pix_key_type ?? '')
        setPixKey(payoutProfile.pix_key ?? '')
        setDefaultCommissionPercent(payoutProfile.default_commission_percent ?? 0)
      } catch (error) {
        if (isMounted) {
          setPayoutMessage(error instanceof Error ? error.message : 'Não foi possível carregar os dados de repasse.')
        }
      }
    }

    void loadPayoutProfile()

    return () => {
      isMounted = false
    }
  }, [user?.id])

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingProfile(true)
    setProfileMessage(null)

    try {
      await updateProfile({
        full_name: fullName.trim() || null,
        timezone,
        locale,
      })
      setProfileMessage('Perfil atualizado com sucesso.')
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingPassword(true)
    setPasswordMessage(null)

    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setPasswordMessage('Senha atualizada com sucesso.')
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.')
    } finally {
      setIsSavingPassword(false)
    }
  }

  async function handlePayoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user?.id) return

    setIsSavingPayout(true)
    setPayoutMessage(null)

    try {
      await upsertCreatorPayoutProfile({
        userId: user.id,
        payoutName,
        document,
        pixKeyType,
        pixKey,
        defaultCommissionPercent,
      })
      setPayoutMessage('Dados de repasse PIX atualizados com sucesso.')
    } catch (error) {
      setPayoutMessage(error instanceof Error ? error.message : 'Não foi possível atualizar os dados de repasse.')
    } finally {
      setIsSavingPayout(false)
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setAvatarMessage(null)
    setAvatarError(null)

    if (!file || !user?.id) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setAvatarError('Selecione uma imagem valida para o avatar.')
      return
    }

    setIsUploadingAvatar(true)

    try {
      const asset = await uploadProfileAvatar(file, user.id)
      await updateProfile({ avatar_url: asset.publicUrl })
      setAvatarMessage('Avatar atualizado com sucesso.')
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'N?o foi possivel atualizar o avatar.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-[#D8E6EB] pb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Minha conta</p>
        <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Dados do criador</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
          Atualize seus dados de exibição e segurança da conta de criador.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={(event) => void handleProfileSubmit(event)}
          className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5"
        >
          <h2 className="font-readex text-xl font-semibold text-[#15323b]">Dados do perfil</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nome</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
                placeholder="Seu nome"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">E-mail</span>
              <input
                value={profile?.email ?? ''}
                disabled
                className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white/70 px-4 text-sm font-semibold text-[#5F7077] outline-none"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Fuso horário</span>
                <input
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Idioma</span>
                <input
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
                />
              </label>
            </div>
          </div>
          {profileMessage ? <p className="mt-4 text-sm font-semibold text-[#5f7077]">{profileMessage}</p> : null}
          <Button
            type="submit"
            disabled={isSavingProfile}
            className="mt-5 h-12 rounded-2xl bg-[#1398B7] px-6 font-black text-white hover:bg-[#0A3640]"
          >
            {isSavingProfile ? 'Salvando...' : 'Salvar perfil'}
          </Button>
        </form>

        <div className="space-y-5">
          <article className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
            <h2 className="font-readex text-xl font-semibold text-[#15323b]">Avatar</h2>
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar atual do criador"
                  className="h-24 w-24 rounded-[28px] border border-[#D8E6EB] object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#1398B7] to-[#0A3640] text-xl font-black text-white shadow-sm">
                  {(fullName || profile?.email || 'CR').slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="flex-1 space-y-3">
                <p className="text-sm font-medium leading-6 text-[#6d7f84]">
                  Envie uma imagem para aparecer no seu dashboard de criador e nas areas da conta.
                </p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void handleAvatarChange(event)}
                  className="block w-full cursor-pointer rounded-2xl border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] file:mr-4 file:rounded-xl file:border-0 file:bg-[#1398B7] file:px-4 file:py-2 file:font-black file:text-white hover:file:bg-[#0A3640]"
                  disabled={isUploadingAvatar}
                />
                <p className="text-xs font-semibold text-[#6d7f84]">
                  Formatos recomendados: JPG, PNG, WEBP ou GIF.
                </p>
                {avatarMessage ? <p className="text-sm font-semibold text-[#5f7077]">{avatarMessage}</p> : null}
                {avatarError ? <p className="text-sm font-semibold text-red-600">{avatarError}</p> : null}
              </div>
            </div>
          </article>

          <form
            onSubmit={(event) => void handlePasswordSubmit(event)}
            className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5"
          >
            <h2 className="font-readex text-xl font-semibold text-[#15323b]">Seguranca</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nova senha</span>
                <PasswordField
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={8}
                  className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
                  placeholder="Digite a nova senha"
                  required
                />
              </label>
            </div>
            {passwordMessage ? <p className="mt-4 text-sm font-semibold text-[#5f7077]">{passwordMessage}</p> : null}
            <Button
              type="submit"
              disabled={isSavingPassword}
              className="mt-5 h-12 rounded-2xl bg-[#15323b] px-6 font-black text-white hover:bg-[#0d252d]"
            >
              {isSavingPassword ? 'Atualizando...' : 'Atualizar senha'}
            </Button>
          </form>
        </div>
      </section>

      <form
        onSubmit={(event) => void handlePayoutSubmit(event)}
        className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Repasse de comissão</p>
            <h2 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">Dados PIX do criador</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
              As comissões ficam disponíveis para repasse em até 30 dias após a venda. Se a compra for estornada, a comissão também será cancelada ou ajustada.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nome do favorecido</span>
            <input
              value={payoutName}
              onChange={(event) => setPayoutName(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
              placeholder="Nome completo ou razão social"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">CPF/CNPJ</span>
            <input
              value={document}
              onChange={(event) => setDocument(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
              placeholder="Documento do favorecido"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Tipo de chave PIX</span>
            <select
              value={pixKeyType}
              onChange={(event) => setPixKeyType(event.target.value as PixKeyType | '')}
              className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
            >
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
            <input
              value={pixKey}
              onChange={(event) => setPixKey(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
              placeholder="Digite a chave PIX"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Comissão padrão (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={defaultCommissionPercent}
              onChange={(event) => setDefaultCommissionPercent(Number(event.target.value || 0))}
              className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold outline-none focus:border-[#1398B7]"
            />
          </label>
        </div>

        {payoutMessage ? <p className="mt-4 text-sm font-semibold text-[#5f7077]">{payoutMessage}</p> : null}
        <Button
          type="submit"
          disabled={isSavingPayout}
          className="mt-5 h-12 rounded-2xl bg-[#1398B7] px-6 font-black text-white hover:bg-[#0A3640]"
        >
          {isSavingPayout ? 'Salvando...' : 'Salvar dados PIX'}
        </Button>
      </form>
    </div>
  )
}
