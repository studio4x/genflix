import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
import { useRef } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { PasswordField } from '@/components/forms/password-field'
import { CourseCoverMedia } from '@/components/public/course-cover-media'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { LegalDocumentModal } from '@/components/public/legal-document-modal'
import { brazilStateOptions, useBrazilCities } from '@/features/address/brazil-address'
import { resolveBrazilCepAddress, useBrazilCepLookup } from '@/features/address/brazil-cep'
import { fetchPublicCourseDetailFromSupabase } from '@/features/public/genflix-public-content-api'
import { genflixNavLinks, type GenflixCourseDetail } from '@/features/public/genflix-site-content'
import { startCourseCheckout } from '@/features/public/courses/api'
import type { LegalDocumentKey } from '@/features/public/legal-documents'
import { dispatchSiteBeginCheckoutEvent } from '@/features/site-editor/site-tracking'
import { supabase } from '@/services/supabase/client'

type CheckoutAuthMode = 'login' | 'signup'

function formatPriceLabel(label: string) {
  return label.trim() || 'Investimento disponivel'
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

function formatCpf(value: string) {
  const digits = normalizeDigits(value).slice(0, 11)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function formatPhone(value: string) {
  const digits = normalizeDigits(value).slice(0, 11)

  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : ''
  }

  const ddd = digits.slice(0, 2)
  const remaining = digits.slice(2)
  const firstPartLength = digits.length > 10 ? 5 : 4

  if (remaining.length <= firstPartLength) {
    return `(${ddd}) ${remaining}`
  }

  return `(${ddd}) ${remaining.slice(0, firstPartLength)}-${remaining.slice(firstPartLength)}`
}

function formatPostalCode(value: string) {
  const digits = normalizeDigits(value).slice(0, 8)

  if (digits.length <= 5) {
    return digits
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function normalizeStateCode(value: string) {
  return value.trim().toUpperCase().slice(0, 2)
}

function parsePriceLabelToNumber(priceLabel: string) {
  const normalized = priceLabel.replace(/\s+/g, '').replace(/[R$]/gi, '').replace(/\./g, '').replace(',', '.')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

export function PublicCheckoutPage() {
  const { slug = '' } = useParams()
  const { isLoading, session, user, roles, profile, signIn, signUp, updateProfile } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const [detail, setDetail] = useState<GenflixCourseDetail | null>(null)
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
  const [checkoutFullName, setCheckoutFullName] = useState('')
  const [checkoutEmail, setCheckoutEmail] = useState('')
  const [checkoutDocument, setCheckoutDocument] = useState('')
  const [checkoutPhone, setCheckoutPhone] = useState('')
  const [checkoutAddress, setCheckoutAddress] = useState('')
  const [checkoutAddressNumber, setCheckoutAddressNumber] = useState('')
  const [checkoutAddressComplement, setCheckoutAddressComplement] = useState('')
  const [checkoutPostalCode, setCheckoutPostalCode] = useState('')
  const [checkoutState, setCheckoutState] = useState('')
  const [checkoutProvince, setCheckoutProvince] = useState('')
  const [checkoutCity, setCheckoutCity] = useState('')
  const [openDocument, setOpenDocument] = useState<LegalDocumentKey | null>(null)
  const hydratedCheckoutUserIdRef = useRef<string | null>(null)
  const checkoutViewTrackedRef = useRef<string | null>(null)
  const { cities: checkoutCities, isLoadingCities } = useBrazilCities(checkoutState)
  const {
    address: checkoutCepAddress,
    addressError: checkoutCepError,
    isLoadingAddress: isLoadingCheckoutCepAddress,
  } = useBrazilCepLookup(checkoutPostalCode)

  const courseRoute = `/cursos/${slug}`
  const canContinue = Boolean(session?.access_token && detail?.id)

  useEffect(() => {
    if (!canContinue) {
      hydratedCheckoutUserIdRef.current = null
      return
    }

    const currentUserId = user?.id ?? null
    if (!currentUserId) {
      return
    }

    if (hydratedCheckoutUserIdRef.current === currentUserId) {
      return
    }

    hydratedCheckoutUserIdRef.current = currentUserId

    setCheckoutFullName(profile?.full_name?.trim() || user?.user_metadata?.full_name || '')
    setCheckoutEmail(profile?.email?.trim() || user?.email || '')
    setCheckoutDocument(
      formatCpf(
        profile?.cpf?.trim() ||
          (typeof user?.user_metadata?.document === 'string' ? user.user_metadata.document.trim() : '') ||
          (typeof user?.user_metadata?.cpf === 'string' ? user.user_metadata.cpf.trim() : ''),
      ),
    )
    setCheckoutPhone(
      formatPhone(
        profile?.whatsapp_number?.trim() ||
          (typeof user?.user_metadata?.phone === 'string' ? user.user_metadata.phone.trim() : '') ||
          (typeof user?.user_metadata?.phone_number === 'string' ? user.user_metadata.phone_number.trim() : ''),
      ),
    )
    setCheckoutAddress(
      profile?.address?.trim() ||
        (typeof user?.user_metadata?.address === 'string' ? user.user_metadata.address.trim() : ''),
    )
    setCheckoutAddressNumber(
      profile?.address_number?.trim() ||
        (typeof user?.user_metadata?.address_number === 'string' ? user.user_metadata.address_number.trim() : ''),
    )
    setCheckoutAddressComplement(
      profile?.address_complement?.trim() ||
        (typeof user?.user_metadata?.address_complement === 'string' ? user.user_metadata.address_complement.trim() : ''),
    )
    setCheckoutPostalCode(
      formatPostalCode(
        profile?.postal_code?.trim() ||
          (typeof user?.user_metadata?.postal_code === 'string' ? user.user_metadata.postal_code.trim() : ''),
      ),
    )
    setCheckoutState(
      normalizeStateCode(
        profile?.state?.trim() ||
          (typeof user?.user_metadata?.state === 'string' ? user.user_metadata.state.trim() : ''),
      ),
    )
    setCheckoutProvince(
      profile?.province?.trim() ||
        (typeof user?.user_metadata?.province === 'string' ? user.user_metadata.province.trim() : ''),
    )
    setCheckoutCity(
      profile?.city?.trim() ||
        (typeof user?.user_metadata?.city === 'string' ? user.user_metadata.city.trim() : ''),
    )
  }, [
    canContinue,
    user?.id,
    profile?.address,
    profile?.address_complement,
    profile?.address_number,
    profile?.email,
    profile?.full_name,
    profile?.cpf,
    profile?.city,
    profile?.postal_code,
    profile?.state,
    profile?.province,
    profile?.whatsapp_number,
    user?.user_metadata?.address,
    user?.user_metadata?.address_number,
    user?.user_metadata?.address_complement,
    user?.user_metadata?.postal_code,
    user?.user_metadata?.state,
    user?.user_metadata?.province,
    user?.user_metadata?.city,
    user?.email,
    user?.user_metadata?.document,
    user?.user_metadata?.cpf,
    user?.user_metadata?.full_name,
    user?.user_metadata?.phone,
    user?.user_metadata?.phone_number,
  ])

  useEffect(() => {
    if (!checkoutCepAddress) {
      return
    }

    setCheckoutAddress(checkoutCepAddress.street)
    setCheckoutProvince(checkoutCepAddress.district)
    setCheckoutState(checkoutCepAddress.stateCode)
    setCheckoutCity(checkoutCepAddress.cityCode)
  }, [checkoutCepAddress])

  useEffect(() => {
    let isMounted = true

    async function loadDetail() {
      setIsLoadingDetail(true)
      try {
        const publicDetail = await fetchPublicCourseDetailFromSupabase(slug)
        if (isMounted) {
          setDetail(publicDetail)
        }
      } catch {
        if (isMounted) {
          setDetail(null)
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
  }, [slug])

  useEffect(() => {
    if (!detail) {
      return
    }

    const courseId = detail.id?.trim() || detail.slug.trim()
    if (!courseId || checkoutViewTrackedRef.current === courseId) {
      return
    }

    checkoutViewTrackedRef.current = courseId
    dispatchSiteBeginCheckoutEvent({
      courseId,
      courseTitle: detail.title,
      currency: 'BRL',
      value: parsePriceLabelToNumber(detail.priceLabel),
    })
  }, [detail])

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

      const normalizedDocument = checkoutDocument.replace(/\D/g, '')
      if (normalizedDocument.length !== 11) {
        throw new Error('Informe um CPF válido para continuar.')
      }

      const normalizedPhone = checkoutPhone.replace(/\D/g, '')
      if (normalizedPhone.length !== 11) {
        throw new Error('Informe um celular válido para continuar.')
      }

      const normalizedAddress = normalizeText(checkoutAddress)
      const normalizedAddressNumber = normalizeText(checkoutAddressNumber)
      const normalizedPostalCode = checkoutPostalCode.replace(/\D/g, '')
      const normalizedState = normalizeStateCode(checkoutState)
      const normalizedProvince = normalizeText(checkoutProvince)
      const normalizedCity = checkoutCity.replace(/\D/g, '')
      let resolvedAddress = normalizedAddress
      let resolvedState = normalizedState
      let resolvedProvince = normalizedProvince
      let resolvedCity = normalizedCity

      if (normalizedPostalCode.length === 8 && (!resolvedAddress || !resolvedState || !resolvedProvince || !resolvedCity)) {
        try {
          const cepAddress = await resolveBrazilCepAddress(normalizedPostalCode)
          if (!resolvedAddress && cepAddress.street) {
            resolvedAddress = cepAddress.street
            setCheckoutAddress(cepAddress.street)
          }
          if (!resolvedProvince && cepAddress.district) {
            resolvedProvince = cepAddress.district
            setCheckoutProvince(cepAddress.district)
          }
          if (!resolvedState && cepAddress.stateCode) {
            resolvedState = cepAddress.stateCode
            setCheckoutState(cepAddress.stateCode)
          }
          if (!resolvedCity && cepAddress.cityCode) {
            resolvedCity = cepAddress.cityCode
            setCheckoutCity(cepAddress.cityCode)
          }
        } catch {
          // Mantemos a validacao normal abaixo para exibir um erro amigavel.
        }
      }

      if (!resolvedAddress || !normalizedAddressNumber || normalizedPostalCode.length !== 8 || !resolvedState || !resolvedProvince || !resolvedCity) {
        throw new Error('Informe os dados de endereço para continuar.')
      }

      if (!detail.id) {
        throw new Error('Este curso ainda não está disponível para checkout.')
      }

      await updateProfile({
        full_name: checkoutFullName.trim() || profile?.full_name || user?.user_metadata?.full_name || null,
        cpf: normalizedDocument,
        whatsapp_number: normalizedPhone,
        address: resolvedAddress,
        address_number: normalizedAddressNumber,
        address_complement: normalizeText(checkoutAddressComplement) || null,
        postal_code: normalizedPostalCode,
        state: resolvedState,
        province: resolvedProvince,
        city: resolvedCity,
      })

      const checkoutUrl = await startCourseCheckout(detail.id, session.access_token, {
        buyerName: checkoutFullName.trim() || profile?.full_name || user?.user_metadata?.full_name,
        buyerEmail: checkoutEmail.trim() || profile?.email || user?.email,
        buyerDocument: normalizedDocument,
        buyerPhone: normalizedPhone,
        buyerAddress: resolvedAddress,
        buyerAddressNumber: normalizedAddressNumber,
        buyerAddressComplement: normalizeText(checkoutAddressComplement) || undefined,
        buyerPostalCode: normalizedPostalCode,
        buyerState: resolvedState,
        buyerProvince: resolvedProvince,
        buyerCity: resolvedCity,
        buyerUserId: session.user.id,
      })

      window.location.href = checkoutUrl
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Não foi possível iniciar o checkout.')
    } finally {
      setIsStartingCheckout(false)
    }
  }, [
    checkoutEmail,
    checkoutFullName,
    detail,
    profile?.email,
    profile?.full_name,
    session?.access_token,
    user?.email,
    user?.user_metadata?.document,
    user?.user_metadata?.cpf,
    user?.user_metadata?.full_name,
    checkoutDocument,
    checkoutPhone,
    checkoutAddress,
    checkoutAddressNumber,
    checkoutAddressComplement,
    checkoutPostalCode,
    checkoutState,
    checkoutProvince,
    checkoutCity,
    updateProfile,
  ])

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError(null)
    setAuthMessage(null)
    setCheckoutError(null)
    setIsAuthSubmitting(true)

    try {
      await signIn(loginEmail, loginPassword)
      setAuthMessage('Login concluído. Preparando seu acesso ao checkout.')
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
      setAuthError('Os e-mails não conferem.')
      return
    }

    if (signupPassword.length < 8) {
      setAuthError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (signupPassword !== signupConfirmPassword) {
      setAuthError('As senhas não conferem.')
      return
    }

    if (!acceptTerms) {
      setAuthError('Você precisa concordar com os Termos de Uso e a Política de Privacidade.')
      return
    }

    if (!detail?.id) {
      setAuthError('Este curso ainda não está disponível para checkout.')
      return
    }

    const normalizedDocument = checkoutDocument.replace(/\D/g, '')
    if (normalizedDocument.length !== 11) {
      setAuthError('Informe um CPF válido para continuar.')
      return
    }

    const normalizedPhone = checkoutPhone.replace(/\D/g, '')
    if (normalizedPhone.length !== 11) {
      setAuthError('Informe um celular válido para continuar.')
      return
    }

    const normalizedAddress = normalizeText(checkoutAddress)
    const normalizedAddressNumber = normalizeText(checkoutAddressNumber)
    const normalizedPostalCode = checkoutPostalCode.replace(/\D/g, '')
    const normalizedState = normalizeStateCode(checkoutState)
    const normalizedProvince = normalizeText(checkoutProvince)
    const normalizedCity = checkoutCity.replace(/\D/g, '')
    let resolvedAddress = normalizedAddress
    let resolvedState = normalizedState
    let resolvedProvince = normalizedProvince
    let resolvedCity = normalizedCity

    if (normalizedPostalCode.length === 8 && (!resolvedAddress || !resolvedState || !resolvedProvince || !resolvedCity)) {
      try {
        const cepAddress = await resolveBrazilCepAddress(normalizedPostalCode)
        if (!resolvedAddress && cepAddress.street) {
          resolvedAddress = cepAddress.street
          setCheckoutAddress(cepAddress.street)
        }
        if (!resolvedProvince && cepAddress.district) {
          resolvedProvince = cepAddress.district
          setCheckoutProvince(cepAddress.district)
        }
        if (!resolvedState && cepAddress.stateCode) {
          resolvedState = cepAddress.stateCode
          setCheckoutState(cepAddress.stateCode)
        }
        if (!resolvedCity && cepAddress.cityCode) {
          resolvedCity = cepAddress.cityCode
          setCheckoutCity(cepAddress.cityCode)
        }
      } catch {
        // Mantemos a validacao normal abaixo para exibir um erro amigavel.
      }
    }

    if (!resolvedAddress || !normalizedAddressNumber || normalizedPostalCode.length !== 8 || !resolvedState || !resolvedProvince || !resolvedCity) {
      setAuthError('Informe os dados de endereço para continuar.')
      return
    }

    setIsAuthSubmitting(true)

    try {
      const result = await signUp(signupFullName, signupEmail, signupPassword)
      let checkoutAccessToken = result.accessToken ?? null

      if (!checkoutAccessToken) {
        await signIn(signupEmail.trim(), signupPassword)
        const sessionResult = await supabase.auth.getSession()
        checkoutAccessToken = sessionResult.data.session?.access_token ?? null
      }

      const checkoutUrl = await startCourseCheckout(detail.id, checkoutAccessToken, {
        buyerName: signupFullName.trim(),
        buyerEmail: signupEmail.trim(),
        buyerDocument: normalizedDocument,
        buyerPhone: normalizedPhone,
        buyerAddress: resolvedAddress,
        buyerAddressNumber: normalizedAddressNumber,
        buyerAddressComplement: normalizeText(checkoutAddressComplement) || undefined,
        buyerPostalCode: normalizedPostalCode,
        buyerState: resolvedState,
        buyerProvince: resolvedProvince,
        buyerCity: resolvedCity,
        buyerUserId: result.userId ?? undefined,
      })

      window.location.href = checkoutUrl
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

  if (!isLoadingDetail && !detail) {
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
          <div className="mx-auto max-w-[1120px] overflow-hidden rounded-[32px] border border-transparent bg-transparent shadow-none">
            <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-6">
                <aside className="flex min-h-[320px] flex-col justify-between rounded-[32px] bg-[linear-gradient(160deg,#0a3640_0%,#1398b7_100%)] px-7 py-8 text-white sm:px-10 sm:py-10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/72">Confirmação de pedido</p>
                      <p className="mt-1 text-sm font-medium text-white/84">Seu acesso está quase pronto.</p>
                    </div>
                  </div>

                <div className="mt-8 max-w-[340px] space-y-5">
                  <h1 className="text-[2.55rem] font-extrabold leading-[0.94] tracking-[-0.06em] sm:text-[3rem]">
                    Quase lá! Vamos finalizar sua inscrição.
                  </h1>
                  <p className="text-base leading-7 text-white/82">
                    Você está prestes a concluir a compra de <strong>{detail.title}</strong> em um ambiente seguro, com confirmação automática após o pagamento.
                  </p>
                </div>

                </aside>

                <div className="overflow-hidden rounded-[24px] border border-[#d8e6eb] bg-[#eef5f7] shadow-[0_14px_32px_rgba(21,50,59,0.03)]">
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
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,54,64,0.08)_0%,rgba(10,54,64,0.42)_100%)]" />
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398b7]">Resumo do curso</p>
                      <p className="mt-2 text-xl font-bold leading-tight text-[#163138]">{detail.title}</p>
                    </div>
                    <p className="text-sm leading-7 text-[#4f656c]">{detail.description}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-[#d8e6eb] bg-white px-7 py-8 shadow-[0_28px_70px_rgba(21,50,59,0.08)] sm:px-10 sm:py-10">
                <p className="hidden text-[11px] font-black uppercase tracking-[0.28em] text-[#1398b7]">Próximos passos</p>
                <h2 className="hidden mt-4 text-2xl font-extrabold tracking-[-0.05em] text-[#183139]">
                  Fique atento aos detalhes da sua inscrição
                </h2>
                <p className="hidden mt-3 max-w-[520px] text-sm leading-7 text-[#5f7077]">
                  Revise o investimento, siga para o checkout e conclua o pagamento. Assim que o Asaas confirmar a transação, o acesso ao curso será liberado automaticamente.
                </p>

                <div className="mt-8 grid gap-4">
                  <div className="hidden flex gap-4 rounded-[22px] border border-[#d8e6eb] bg-[#f2f7f9] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398b7]">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#183139]">Confira seu e-mail</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f7077]">
                        Enviaremos os detalhes da compra e os próximos avisos por e-mail.
                      </p>
                    </div>
                  </div>

                  <div className="hidden flex gap-4 rounded-[22px] border border-[#d8e6eb] bg-[#f2f7f9] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398b7]">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#183139]">Liberação automática</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f7077]">
                        Após a confirmação do pagamento, o curso será liberado automaticamente.
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
                        A atualização do acesso pode levar alguns instantes dependendo do meio de pagamento.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-[#d8e6eb] bg-white p-5 shadow-[0_14px_32px_rgba(21,50,59,0.04)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398b7]">Resumo financeiro</p>
                        <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#183139]">Investimento único</h3>
                      </div>
                      <CreditCard className="h-7 w-7 text-[#1398b7]" />
                    </div>
                  <div className="mt-6 space-y-3 rounded-[20px] bg-[#f2f7f9] p-4">
                    <div className="flex items-center justify-between gap-4 text-sm font-semibold text-[#5f7077]">
                      <span>Valor do curso</span>
                      <span>{formatPriceLabel(detail.priceLabel)}</span>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5f7077]">em até 12x no cartão de crédito</p>
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
                    <form
                      className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void handleContinue()
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                          <LogIn className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Checkout</p>
                          <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#183139]">Confirme seus dados</h3>
                          <p className="mt-2 text-sm leading-6 text-[#5f7077]">
                            Confira seus dados e siga para o pagamento.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        <label className="block space-y-2">
                          <span className="text-sm font-semibold text-[#4f656c]">Nome completo</span>
                          <input
                            className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                            type="text"
                            value={checkoutFullName}
                            onChange={(event) => setCheckoutFullName(event.target.value)}
                            placeholder="Seu nome"
                            autoComplete="name"
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-sm font-semibold text-[#4f656c]">E-mail</span>
                          <input
                            className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                            type="email"
                            value={checkoutEmail}
                            onChange={(event) => setCheckoutEmail(event.target.value)}
                            placeholder="seu@email.com"
                            autoComplete="email"
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-sm font-semibold text-[#4f656c]">CPF</span>
                          <input
                            className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                            type="text"
                            value={checkoutDocument}
                            onChange={(event) => setCheckoutDocument(formatCpf(event.target.value))}
                            placeholder="000.000.000-00"
                            inputMode="numeric"
                            autoComplete="off"
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-sm font-semibold text-[#4f656c]">Celular</span>
                          <input
                            className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                            type="tel"
                            value={checkoutPhone}
                            onChange={(event) => setCheckoutPhone(formatPhone(event.target.value))}
                            placeholder="(99) 99999-9999"
                            inputMode="tel"
                            autoComplete="tel"
                          />
                        </label>

                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block space-y-2 md:col-span-2">
                            <span className="text-sm font-semibold text-[#4f656c]">CEP</span>
                            <input
                              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                              type="text"
                              value={checkoutPostalCode}
                              onChange={(event) => setCheckoutPostalCode(formatPostalCode(event.target.value))}
                              placeholder="00000-000"
                              inputMode="numeric"
                              autoComplete="postal-code"
                            />
                            <p className="text-xs text-[#6f838a]">
                              {isLoadingCheckoutCepAddress
                                ? 'Buscando endereço pelo CEP...'
                                : checkoutCepError || 'Preencha o CEP para autocompletar seus dados.'}
                            </p>
                          </label>

                          <label className="block space-y-2">
                            <span className="text-sm font-semibold text-[#4f656c]">Estado</span>
                            <select
                              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors focus:border-[#1398B7] focus:bg-white"
                              value={checkoutState}
                              onChange={(event) => {
                                setCheckoutState(event.target.value)
                                setCheckoutCity('')
                              }}
                              autoComplete="address-level1"
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
                            <span className="text-sm font-semibold text-[#4f656c]">Cidade</span>
                            <select
                              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors focus:border-[#1398B7] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                              value={checkoutCity}
                              onChange={(event) => setCheckoutCity(event.target.value)}
                              disabled={!checkoutState || isLoadingCities}
                              autoComplete="address-level2"
                            >
                              <option value="">
                                {!checkoutState
                                  ? 'Selecione o estado'
                                  : isLoadingCities
                                    ? 'Carregando cidades...'
                                    : 'Selecione a cidade'}
                              </option>
                              {checkoutCities.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block space-y-2 md:col-span-2">
                            <span className="text-sm font-semibold text-[#4f656c]">Endereço</span>
                            <input
                              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                              type="text"
                              value={checkoutAddress}
                              onChange={(event) => setCheckoutAddress(event.target.value)}
                              placeholder="Rua, avenida, praça..."
                              autoComplete="address-line1"
                            />
                          </label>

                          <label className="block space-y-2">
                            <span className="text-sm font-semibold text-[#4f656c]">Número</span>
                            <input
                              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                              type="text"
                              value={checkoutAddressNumber}
                              onChange={(event) => setCheckoutAddressNumber(event.target.value)}
                              placeholder="insira o numero aqui.."
                              autoComplete="address-line2"
                            />
                          </label>

                          <label className="block space-y-2">
                            <span className="text-sm font-semibold text-[#4f656c]">Complemento</span>
                            <input
                              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                              type="text"
                              value={checkoutAddressComplement}
                              onChange={(event) => setCheckoutAddressComplement(event.target.value)}
                              placeholder="Apto, bloco..."
                              autoComplete="address-line3"
                            />
                          </label>

                          <label className="block space-y-2">
                            <span className="text-sm font-semibold text-[#4f656c]">Bairro</span>
                            <input
                              className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                              type="text"
                              value={checkoutProvince}
                              onChange={(event) => setCheckoutProvince(event.target.value)}
                              placeholder="Centro"
                              autoComplete="address-level3"
                            />
                          </label>
                        </div>
                      </div>

                      <GenflixCtaButton
                        type="submit"
                        disabled={isStartingCheckout}
                        className="mt-5 w-full px-5 py-3"
                      >
                        {isStartingCheckout ? 'Abrindo checkout...' : 'Continuar para pagamento'}
                      </GenflixCtaButton>
                    </form>
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
                          <form className="space-y-3" onSubmit={(event) => void handleSignupSubmit(event)}>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1398b7]">Criar conta</p>
                              <h3 className="mt-1 text-lg font-black tracking-[-0.04em] text-[#183139]">Cadastre-se e siga para o pagamento</h3>
                              <p className="mt-1 text-sm leading-5 text-[#5f7077]">
                                Crie sua conta e conclua a compra sem sair da página.
                              </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block space-y-2 sm:col-span-2">
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
                            </div>

                            <div className="space-y-3 rounded-[20px] border border-[#D8E6EB] bg-[#F2F7F9] p-3">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#1398b7]">Dados para o pagamento</p>
                                <p className="mt-1 text-sm leading-5 text-[#5f7077]">
                                  Usaremos estes dados para concluir a compra e salvar seu cadastro.
                                </p>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block space-y-2">
                                  <span className="text-sm font-semibold text-[#4f656c]">CPF</span>
                                  <input
                                    className="h-11 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                    type="text"
                                    value={checkoutDocument}
                                    onChange={(event) => setCheckoutDocument(formatCpf(event.target.value))}
                                    placeholder="000.000.000-00"
                                    inputMode="numeric"
                                    autoComplete="off"
                                  />
                                </label>

                                <label className="block space-y-2">
                                  <span className="text-sm font-semibold text-[#4f656c]">Celular</span>
                                  <input
                                    className="h-11 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                    type="tel"
                                    value={checkoutPhone}
                                    onChange={(event) => setCheckoutPhone(formatPhone(event.target.value))}
                                    placeholder="(99) 99999-9999"
                                    inputMode="tel"
                                    autoComplete="tel"
                                  />
                                </label>

                                <label className="block space-y-2 sm:col-span-2">
                                  <span className="text-sm font-semibold text-[#4f656c]">CEP</span>
                                  <input
                                    className="h-11 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                    type="text"
                                    value={checkoutPostalCode}
                                    onChange={(event) => setCheckoutPostalCode(formatPostalCode(event.target.value))}
                                    placeholder="00000-000"
                                    inputMode="numeric"
                                    autoComplete="postal-code"
                                  />
                                  <p className="text-xs text-[#6f838a]">
                                    {isLoadingCheckoutCepAddress
                                      ? 'Buscando endereço pelo CEP...'
                                      : checkoutCepError || 'Preencha o CEP para autocompletar seus dados.'}
                                  </p>
                                </label>

                                <label className="block space-y-2">
                                  <span className="text-sm font-semibold text-[#4f656c]">Estado</span>
                                  <select
                                    className="h-11 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors focus:border-[#1398B7] focus:bg-white"
                                    value={checkoutState}
                                    onChange={(event) => {
                                      setCheckoutState(event.target.value)
                                      setCheckoutCity('')
                                    }}
                                    autoComplete="address-level1"
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
                                  <span className="text-sm font-semibold text-[#4f656c]">Cidade</span>
                                  <select
                                    className="h-11 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors focus:border-[#1398B7] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                    value={checkoutCity}
                                    onChange={(event) => setCheckoutCity(event.target.value)}
                                    disabled={!checkoutState || isLoadingCities}
                                    autoComplete="address-level2"
                                  >
                                    <option value="">
                                      {!checkoutState
                                        ? 'Selecione o estado'
                                        : isLoadingCities
                                          ? 'Carregando cidades...'
                                          : 'Selecione a cidade'}
                                    </option>
                                    {checkoutCities.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label className="block space-y-2 sm:col-span-2">
                                  <span className="text-sm font-semibold text-[#4f656c]">Endereço</span>
                                  <input
                                    className="h-11 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                    type="text"
                                    value={checkoutAddress}
                                    onChange={(event) => setCheckoutAddress(event.target.value)}
                                    placeholder="Rua, avenida, praça..."
                                    autoComplete="address-line1"
                                  />
                                </label>

                                <label className="block space-y-2">
                                  <span className="text-sm font-semibold text-[#4f656c]">Número</span>
                                  <input
                                    className="h-11 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                    type="text"
                                    value={checkoutAddressNumber}
                                    onChange={(event) => setCheckoutAddressNumber(event.target.value)}
                                    placeholder="insira o numero aqui.."
                                    autoComplete="address-line2"
                                  />
                                </label>

                                <label className="block space-y-2">
                                  <span className="text-sm font-semibold text-[#4f656c]">Complemento</span>
                                  <input
                                    className="h-11 w-full rounded-[12px] border border-[#D8E6EB] bg-white px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                    type="text"
                                    value={checkoutAddressComplement}
                                    onChange={(event) => setCheckoutAddressComplement(event.target.value)}
                                    placeholder="Apto, bloco..."
                                    autoComplete="address-line3"
                                  />
                                </label>

                                <label className="block space-y-2 sm:col-span-2">
                                  <span className="text-sm font-semibold text-[#4f656c]">Bairro</span>
                                  <input
                                    className="h-11 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                                    type="text"
                                    value={checkoutProvince}
                                    onChange={(event) => setCheckoutProvince(event.target.value)}
                                    placeholder="Centro"
                                    autoComplete="address-level3"
                                  />
                                </label>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-4 text-xs font-medium text-[#8a9aa0]">
                              <button
                                type="button"
                                onClick={() => setAuthMode('login')}
                                className="text-[#1398B7] transition-colors hover:text-[#0a3640]"
                              >
                                Ja tenho conta
                              </button>
                            </div>

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

                            <GenflixCtaButton type="submit" disabled={isAuthSubmitting} className="h-12 w-full px-5">
                              {isAuthSubmitting ? 'Criando conta...' : 'Criar conta e continuar'}
                            </GenflixCtaButton>
                          </form>
                        )}
                      </div>
                    </div>
                  )}
                  {canContinue ? (
                    <p className="text-xs leading-6 text-[#8a9aa0]">
                      Os dados acima podem ser ajustados antes de seguir para o pagamento.
                    </p>
                  ) : (
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
        </div>
      </section>

      {openDocument ? <LegalDocumentModal documentKey={openDocument} onClose={() => setOpenDocument(null)} /> : null}

      <GenflixPublicFooter />
    </main>
  )
}
