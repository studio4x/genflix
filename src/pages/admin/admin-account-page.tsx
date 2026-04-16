import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'

export function AdminAccountPage() {
  const { profile, updatePassword, updateProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  const [locale, setLocale] = useState('pt-BR')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name ?? '')
    setTimezone(profile?.timezone ?? 'America/Sao_Paulo')
    setLocale(profile?.locale ?? 'pt-BR')
  }, [profile])

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
      setProfileMessage('Dados atualizados com sucesso.')
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Não foi possível atualizar os dados.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordMessage(null)

    if (newPassword.length < 8) {
      setPasswordMessage('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage('As senhas não conferem.')
      return
    }

    setIsSavingPassword(true)

    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Senha atualizada com sucesso.')
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.')
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-[#D8E6EB] pb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Minha Conta</p>
        <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Minha Conta</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
          Atualize seus dados pessoais e mantenha uma senha segura para administrar a GenFlix.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={(event) => void handleProfileSubmit(event)}
          className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Dados pessoais</p>
          <h2 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">Perfil administrativo</h2>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nome</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7] focus:ring-4 focus:ring-[#E8F6FA]"
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
                  className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7] focus:ring-4 focus:ring-[#E8F6FA]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Idioma</span>
                <input
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7] focus:ring-4 focus:ring-[#E8F6FA]"
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
            {isSavingProfile ? 'Salvando...' : 'Salvar dados'}
          </Button>
        </form>

        <form
          onSubmit={(event) => void handlePasswordSubmit(event)}
          className="rounded-[28px] border border-[#D8E6EB] bg-[#F2F7F9] p-5"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Seguranca</p>
          <h2 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">Trocar senha</h2>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Nova senha</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7] focus:ring-4 focus:ring-[#E8F6FA]"
                placeholder="Digite a nova senha"
                required
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Confirmar senha</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                className="mt-2 h-12 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7] focus:ring-4 focus:ring-[#E8F6FA]"
                placeholder="Repita a nova senha"
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
      </section>
    </div>
  )
}
