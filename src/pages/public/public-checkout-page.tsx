import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { PasswordField } from '@/components/forms/password-field'
import { CourseCoverMedia } from '@/components/public/course-cover-media'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { LegalDocumentModal } from '@/components/public/legal-document-modal'
import { fetchPublicCourseDetailFromSupabase } from '@/features/public/genflix-public-content-api'
import { genflixNavLinks, getGenflixCourseDetailBySlug, type GenflixCourseDetail } from '@/features/public/genflix-site-content'
import { startCourseCheckout } from '@/features/public/courses/api'
import type { LegalDocumentKey } from '@/features/public/legal-documents'

type CheckoutAuthMode = 'login' | 'signup'

function formatPriceLabel(label: string) {
  return label.trim() || 'Investimento disponivel'
}

export function PublicCheckoutPage() {
  const { slug = '' } = useParams()
  const { isLoading, session, user, roles, profile, signIn, signUp } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const staticDetail = useMemo(() => getGenflixCourseDetailBySlug(slug), [slug])
  const [detail, setDetail] = useState<GenflixCourseDetail | null>(staticDetail)
  const [isLoadingDetail, setIsLoadingDetail] = useState(true)
  const [authMode, setAuthMode] = useState<CheckoutAuthMode>('signup')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signupFullName, setSignupFullName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupConfirmEmail, setSignupConfirmEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const [pendingContinuation, setPendingContinuation] = useState(false)
  const [openDocument, setOpenDocument] = useState<LegalDocumentKey | null>(null)

  const courseRoute = `/cursos/${slug}`
  const canContinue = Boolean(session?.access_token && detail?.id)
  const userLabel = profile?.full_name?.trim() || user?.email || 'Conta autenticada'

  useEffect(() => {
    let isMounted = true

    async function loadDetail() {
      setIsLoadingDetail(true)
      try {
        const publicDetail = await fetchPublicCourseDetailFromSupabase(slug)
        if (isMounted) {
          setDetail(publicDetail ?? staticDetail)
        }
      } catch {
        if (isMounted) {
          setDetail(staticDetail)
        }
      } finally {
        if (isMounted) {
          setIsLoadingDetail(false)
        }
      }
    }

    void loadDetail()

    return () => {
      isMounted = false
    }
  }, [slug, staticDetail])

  const handleContinue = useCallback(async () => {
    if (!detail) {
      return
    }

    setCheckoutError(null)
    setIsStartingCheckout(true)

    try {
      if (!session?.access_token) {
        throw new Error('Entre ou crie sua conta para continuar a compra.')
      }

      if (!detail.id) {
        throw new Error('Este curso ainda nao esta disponivel para checkout.')
      }

      const checkoutUrl = await startCourseCheckout(detail.id, session.access_token, {
        buyerName: profile?.full_name || user?.user_metadata?.full_name,
        buyerEmail: profile?.email || user?.email,
      })

      window.location.href = checkoutUrl
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Nao foi possivel iniciar o checkout.')
    } finally {
      setIsStartingCheckout(false)
    }
  }, [detail, profile?.email, profile?.full_name, session?.access_token, user?.email, user?.user_metadata?.full_name])

  useEffect(() => {
    if (!pendingContinuation || !canContinue || isStartingCheckout) {
      return
    }

    setPendingContinuation(false)
    void handleContinue()
  }, [canContinue, handleContinue, isStartingCheckout, pendingContinuation])

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError(null)
    setAuthMessage(null)
    setCheckoutError(null)
    setIsAuthSubmitting(true)

    try {
      await signIn(loginEmail, loginPassword)
      setAuthMessage('Login concluido. Preparando seu acesso ao checkout.')
      setPendingContinuation(true)
    } catch (submitError) {
      setAuthError(submitError instanceof Error ? submitError.message : 'Falha no login.')
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError(null)
    setAuthMessage(null)
    setCheckoutError(null)

    if (!signupFullName.trim()) {
      setAuthError('Informe seu nome completo.')
      return
    }

    if (!signupEmail.trim()) {
      setAuthError('Informe seu e-mail.')
      return
    }

    if (signupEmail.trim().toLowerCase() !== signupConfirmEmail.trim().toLowerCase()) {
      setAuthError('Os e-mails nao conferem.')
      return
    }

    if (signupPassword.length < 8) {
      setAuthError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (signupPassword !== signupConfirmPassword) {
      setAuthError('As senhas nao conferem.')
      return
    }

    if (!acceptTerms) {
      setAuthError('Voce precisa concordar com os Termos de Uso e a Politica de Privacidade.')
      return
    }

    setIsAuthSubmitting(true)

    try {
      const result = await signUp(signupFullName, signupEmail, signupPassword)

      if (result.needsEmailConfirmation) {
        setAuthMessage('Conta criada. Confira seu e-mail para confirmar o acesso e depois volte para concluir a compra.')
      } else {
        setAuthMessage('Conta criada com sucesso. Preparando seu acesso ao checkout.')
        setPendingContinuation(true)
      }
    } catch (submitError) {
      setAuthError(submitError instanceof Error ? submitError.message : 'Falha ao criar a conta.')
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  if (!isLoadingDetail && !staticDetail && !detail) {
    return <Navigate to="/cursos" replace />
  }

  if (!detail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando checkout...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(19,152,183,0.12),_transparent_34%),linear-gradient(180deg,#ffffff_0%,#f2f7f9_42%,#eef5f7_100%)] font-manrope text-[#163138]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />

      <section className="pb-16 pt-8 sm:pt-12">
        <div className="public-site-container">
          <div className="mx-auto max-w-[1120px] overflow-hidden rounded-[32px] border border-[#d8e6eb] bg-white shadow-[0_28px_70px_rgba(21,50,59,0.08)]">
            <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
              <aside className="flex min-h-[320px] flex-col justify-between bg-[linear-gradient(160deg,#0a3640_0%,#1398b7_100%)] px-7 py-8 text-white sm:px-10 sm:py-10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/72">Confirmação de pedido</p>
                      <p className="mt-1 text-sm font-medium text-white/84">Seu acesso esta quase pronto.</p>
                    </div>
                  </div>

                <div className="mt-8 max-w-[340px] space-y-5">
                  <h1 className="text-[2.55rem] font-extrabold leading-[0.94] tracking-[-0.06em] sm:text-[3rem]">
                    Quase la! Vamos finalizar sua inscricao.
                  </h1>
                  <p className="text-base leading-7 text-white/82">
                    Voce esta prestes a concluir a compra de <strong>{detail.title}</strong> em um ambiente seguro, com confirmacao automatica apos o pagamento.
                  </p>
                </div>

                <div className="mt-8 overflow-hidden rounded-[24px] border border-white/14 bg-white/8 backdrop-blur-sm">
                  <div className="relative aspect-[4/3] bg-[#173039]">
                    <CourseCoverMedia
                      src={detail.coverImage}
                      alt={detail.title}
                      title={detail.title}
                      category={detail.categoryLine}
                      initials={detail.mentor.initials}
                      imageClassName="grayscale"
                      placeholderClassName="p-6"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,54,64,0.04)_0%,rgba(10,54,64,0.58)_100%)]" />
                  </div>
                </div>
              </aside>

              <div className="px-7 py-8 sm:px-10 sm:py-10">
                <p className="hidden text-[11px] font-black uppercase tracking-[0.28em] text-[#1398b7]">Proximos passos</p>
                <h2 className="hidden mt-4 text-2xl font-extrabold tracking-[-0.05em] text-[#183139]">
                  Fique atento aos detalhes da sua inscricao
                </h2>
                <p className="hidden mt-3 max-w-[520px] text-sm leading-7 text-[#5f7077]">
                  Revise o investimento, siga para o checkout e conclua o pagamento. Assim que o Asaas confirmar a transacao, o acesso ao curso sera liberado automaticamente.
                </p>

                <div className="mt-8 grid gap-4">
                  <div className="hidden flex gap-4 rounded-[22px] border border-[#d8e6eb] bg-[#f2f7f9] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398b7]">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#183139]">Confira seu e-mail</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f7077]">
                        Enviaremos os detalhes da compra e os proximos avisos por e-mail.
                      </p>
                    </div>
                  </div>

                  <div className="hidden flex gap-4 rounded-[22px] border border-[#d8e6eb] bg-[#f2f7f9] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398b7]">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#183139]">Liberacao automatica</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f7077]">
                        Apos a confirmacao do pagamento, o curso sera liberado automaticamente.
                      </p>
                    </div>
                  </div>

                  <div className="hidden flex gap-4 rounded-[22px] border border-[#d8e6eb] bg-[#f2f7f9] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398b7]">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#183139]">Processamento em andamento</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f7077]">
                        A atualizacao do acesso pode levar alguns instantes dependendo do meio de pagamento.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-[#d8e6eb] bg-white p-5 shadow-[0_14px_32px_rgba(21,50,59,0.04)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398b7]">Resumo financeiro</p>
                        <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#183139]">Investimento unico</h3>
                      </div>
                      <CreditCard className="h-7 w-7 text-[#1398b7]" />
                    </div>
                  <div className="mt-6 space-y-3 rounded-[20px] bg-[#f2f7f9] p-4">
                    <div className="flex items-center justify-between gap-4 text-sm font-semibold text-[#5f7077]">
                      <span>Valor do curso</span>
                      <span>{formatPriceLabel(detail.priceLabel)}</span>
                    </div>
                  </div>
                </div>

                  {checkoutError ? (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                      {checkoutError}
                    </p>
                  ) : null}

                  {authError ? (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                      {authError}
                    </p>
                  ) : null}

                  {authMessage ? (
                    <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                      {authMessage}
                    </p>
                  ) : null}

                  {canContinue ? (
                    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                          <LogIn className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Conta detectada</p>
                          <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#183139]">{userLabel}</h3>
                          <p className="mt-2 text-sm leading-6 text-[#5f7077]">
                            Voce ja pode seguir para o pagamento com a sua conta autenticada.
                          </p>
                        </div>
                      </div>

                      <GenflixCtaButton
                        type="button"
                        disabled={isStartingCheckout}
                        onClick={() => void handleContinue()}
                        className="mt-5 w-full px-5 py-3"
                      >
                        {isStartingCheckout ? 'Abrindo checkout...' : 'Continuar para pagamento'}
                      </GenflixCtaButton>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-[#d8e6eb] bg-white p-5 shadow-[0_18px_42px_rgba(21,50,59,0.05)]">
                      <div className="grid gap-2 rounded-[18px] border border-[#D8E6EB] bg-[#F2F7F9] p-1 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('login')
                            setAuthError(null)
                            setAuthMessage(null)
                          }}
                          className={`inline-flex h-11 items-center justify-center gap-2 rounded-[14px] text-sm font-bold transition ${
                            authMode === 'login'
                              ? 'bg-[#1398B7] text-white shadow-sm'
                              : 'text-[#6d7f84] hover:bg-white'
                          }`}
                        >
                          <LogIn className="h-4 w-4" />
                          Ja tenho conta
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('signup')
                            setAuthError(null)
                            setAuthMessage(null)
                          }}
                          className={`inline-flex h-11 items-center justify-center gap-2 rounded-[14px] text-sm font-bold transition ${
                            authMode === 'signup'
                              ? 'bg-[#1398B7] text-white shadow-sm'
                              : 'text-[#6d7f84] hover:bg-white'
                          }`}
                        >
                          <UserPlus className="h-4 w-4" />
                          Quero me cadastrar
                        </button>
                      </div>

                      <div className="mt-5">
                        {authMode === 'login' ? (
                          <form className="space-y-4" onSubmit={(event) => void handleLoginSubmit(event)}>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1398b7]">Entrar</p>
                              <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#183139]">Acesse sua conta para continuar</h3>
                              <p className="mt-2 text-sm leading-6 text-[#5f7077]">
                                Se voce ja tem cadastro, entre aqui e siga para o pagamento em seguida.
                              </p>
                            </div>

                            <label className="block space-y-2">
                              <span className="text-sm font-semibold text-[#4f656c]">E-mail</span>
                              <input
                                className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                type="email"
                                value={loginEmail}
                                onChange={(event) => setLoginEmail(event.target.value)}
                                placeholder="seu@email.com"
                                autoComplete="email"
                                required
                              />
                            </label>

                            <label className="block space-y-2">
                              <span className="text-sm font-semibold text-[#4f656c]">Senha</span>
                              <PasswordField
                                className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                value={loginPassword}
                                onChange={(event) => setLoginPassword(event.target.value)}
                                placeholder="Digite sua senha"
                                autoComplete="current-password"
                                required
                              />
                            </label>

                            <div className="flex items-center justify-between gap-4 text-xs font-medium text-[#8a9aa0]">
                              <Link className="text-[#1398B7] transition-colors hover:text-[#0a3640]" to="/recuperar-senha">
                                Esqueceu a senha?
                              </Link>
                              <button
                                type="button"
                                onClick={() => setAuthMode('signup')}
                                className="text-[#1398B7] transition-colors hover:text-[#0a3640]"
                              >
                                Criar conta
                              </button>
                            </div>

                            <GenflixCtaButton type="submit" disabled={isAuthSubmitting} className="h-12 w-full px-5">
                              {isAuthSubmitting ? 'Entrando...' : 'Entrar e continuar'}
                            </GenflixCtaButton>
                          </form>
                        ) : (
                          <form className="space-y-4" onSubmit={(event) => void handleSignupSubmit(event)}>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1398b7]">Criar conta</p>
                              <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#183139]">Cadastre-se e siga para o pagamento</h3>
                              <p className="mt-2 text-sm leading-6 text-[#5f7077]">
                                Se voce ainda nao tem conta, crie uma agora e continue sem sair desta pagina.
                              </p>
                            </div>

                            <label className="block space-y-2">
                              <span className="text-sm font-semibold text-[#4f656c]">Nome completo</span>
                              <input
                                className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                type="text"
                                value={signupFullName}
                                onChange={(event) => setSignupFullName(event.target.value)}
                                placeholder="Seu nome"
                                autoComplete="name"
                                required
                              />
                            </label>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="block space-y-2">
                                <span className="text-sm font-semibold text-[#4f656c]">E-mail</span>
                                <input
                                  className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                  type="email"
                                  value={signupEmail}
                                  onChange={(event) => setSignupEmail(event.target.value)}
                                  placeholder="seu@email.com"
                                  autoComplete="email"
                                  required
                                />
                              </label>

                              <label className="block space-y-2">
                                <span className="text-sm font-semibold text-[#4f656c]">Confirmar e-mail</span>
                                <input
                                  className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                  type="email"
                                  value={signupConfirmEmail}
                                  onChange={(event) => setSignupConfirmEmail(event.target.value)}
                                  placeholder="repita seu e-mail"
                                  autoComplete="email"
                                  required
                                />
                              </label>
                            </div>

                            <label className="block space-y-2">
                              <span className="text-sm font-semibold text-[#4f656c]">Senha</span>
                              <PasswordField
                                className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                value={signupPassword}
                                onChange={(event) => setSignupPassword(event.target.value)}
                                placeholder="Crie uma senha"
                                autoComplete="new-password"
                                required
                              />
                            </label>

                            <label className="block space-y-2">
                              <span className="text-sm font-semibold text-[#4f656c]">Confirmar senha</span>
                              <PasswordField
                                className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                value={signupConfirmPassword}
                                onChange={(event) => setSignupConfirmPassword(event.target.value)}
                                placeholder="Digite a senha novamente"
                                autoComplete="new-password"
                                required
                              />
                            </label>

                            <label className="flex items-start gap-3 rounded-[14px] border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3 text-sm leading-6 text-[#5a6d73]">
                              <input
                                type="checkbox"
                                checked={acceptTerms}
                                onChange={(event) => setAcceptTerms(event.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-[#D8E6EB] text-[#1398B7] focus:ring-[#1398B7]"
                              />
                              <span>
                                Concordo com os{' '}
                                <button
                                  type="button"
                                  onClick={() => setOpenDocument('terms')}
                                  className="font-semibold text-[#1398B7] hover:text-[#0a3640]"
                                >
                                  Termos de Uso
                                </button>{' '}
                                e{' '}
                                <button
                                  type="button"
                                  onClick={() => setOpenDocument('privacy')}
                                  className="font-semibold text-[#1398B7] hover:text-[#0a3640]"
                                >
                                  Politica de Privacidade
                                </button>
                                .
                              </span>
                            </label>

                            <div className="flex items-center justify-between gap-4 text-xs font-medium text-[#8a9aa0]">
                              <button
                                type="button"
                                onClick={() => setAuthMode('login')}
                                className="text-[#1398B7] transition-colors hover:text-[#0a3640]"
                              >
                                Ja tenho conta
                              </button>
                            </div>

                            <GenflixCtaButton type="submit" disabled={isAuthSubmitting} className="h-12 w-full px-5">
                              {isAuthSubmitting ? 'Criando conta...' : 'Criar conta e continuar'}
                            </GenflixCtaButton>
                          </form>
                        )}
                      </div>
                    </div>
                  )}

                  {canContinue ? null : (
                    <p className="text-xs leading-6 text-[#8a9aa0]">
                      Se voce ainda nao tem cadastro, crie sua conta aqui mesmo. Se ja possui, entre com seus dados e continuaremos o checkout em seguida.
                    </p>
                  )}

                  <Link
                    to={courseRoute}
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#1398b7] transition-colors hover:text-[#0a3640]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao curso
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-[1120px] rounded-[24px] border border-[#d8e6eb] bg-white px-6 py-5 shadow-[0_14px_32px_rgba(21,50,59,0.05)] sm:px-8 sm:py-6">
            <div className="max-w-[760px]">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398b7]">Resumo do curso</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.05em] text-[#163138]">{detail.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#4f656c]">{detail.description}</p>
            </div>
          </div>
        </div>
      </section>

      {openDocument ? <LegalDocumentModal documentKey={openDocument} onClose={() => setOpenDocument(null)} /> : null}

      <GenflixPublicFooter />
    </main>
  )
}
