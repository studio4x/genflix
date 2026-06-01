import { useEffect, useState } from 'react'

export type BrazilCepAddress = {
  postalCode: string
  street: string
  district: string
  stateCode: string
  cityCode: string
}

const cepCache = new Map<string, BrazilCepAddress>()

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

export async function resolveBrazilCepAddress(postalCode: string) {
  const normalizedPostalCode = normalizeDigits(postalCode)
  const cachedAddress = cepCache.get(normalizedPostalCode)

  if (cachedAddress) {
    return cachedAddress
  }

  const response = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(normalizedPostalCode)}/json/`)

  if (!response.ok) {
    throw new Error('N?o foi possivel consultar o CEP informado.')
  }

  const payload = (await response.json()) as {
    erro?: boolean
    cep?: string
    logradouro?: string
    bairro?: string
    uf?: string
    ibge?: string
  }

  if (payload.erro || !payload.cep || !payload.uf || !payload.ibge) {
    throw new Error('CEP n?o encontrado.')
  }

  const resolvedAddress: BrazilCepAddress = {
    postalCode: normalizedPostalCode,
    street: payload.logradouro?.trim() ?? '',
    district: payload.bairro?.trim() ?? '',
    stateCode: payload.uf.trim().toUpperCase(),
    cityCode: payload.ibge.trim(),
  }

  cepCache.set(normalizedPostalCode, resolvedAddress)
  return resolvedAddress
}

export function useBrazilCepLookup(postalCode: string) {
  const [address, setAddress] = useState<BrazilCepAddress | null>(null)
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const normalizedPostalCode = normalizeDigits(postalCode)

    if (normalizedPostalCode.length !== 8) {
      setAddress(null)
      setIsLoadingAddress(false)
      setAddressError(null)
      return () => {
        isActive = false
      }
    }

    const timeoutId = window.setTimeout(() => {
      setIsLoadingAddress(true)
      setAddressError(null)

      void resolveBrazilCepAddress(normalizedPostalCode)
        .then((nextAddress) => {
          if (isActive) {
            setAddress(nextAddress)
          }
        })
        .catch((error) => {
          if (isActive) {
            setAddress(null)
            setAddressError(error instanceof Error ? error.message : 'N?o foi possivel consultar o CEP informado.')
          }
        })
        .finally(() => {
          if (isActive) {
            setIsLoadingAddress(false)
          }
        })
    }, 450)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [postalCode])

  return {
    address,
    addressError,
    isLoadingAddress,
  }
}
