import { useEffect, useState } from 'react'

export type BrazilStateOption = {
  value: string
  label: string
}

export type BrazilCityOption = {
  value: string
  label: string
}

export const brazilStateOptions: BrazilStateOption[] = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapa' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceara' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espirito Santo' },
  { value: 'GO', label: 'Goias' },
  { value: 'MA', label: 'Maranhao' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Para' },
  { value: 'PB', label: 'Paraiba' },
  { value: 'PR', label: 'Parana' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piaui' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondonia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'Sao Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
]

const cityCache = new Map<string, BrazilCityOption[]>()

async function loadBrazilCitiesByState(stateCode: string) {
  const cachedCities = cityCache.get(stateCode)
  if (cachedCities) {
    return cachedCities
  }

  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(stateCode)}/municipios`,
  )

  if (!response.ok) {
    throw new Error('N?o foi possivel carregar as cidades do estado selecionado.')
  }

  const payload = (await response.json()) as Array<{ id: number; nome: string }>
  const cities = payload
    .map((city) => ({
      value: String(city.id),
      label: city.nome,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  cityCache.set(stateCode, cities)
  return cities
}

export function useBrazilCities(stateCode: string) {
  const [cities, setCities] = useState<BrazilCityOption[]>([])
  const [isLoadingCities, setIsLoadingCities] = useState(false)

  useEffect(() => {
    let isActive = true

    async function loadCities() {
      if (!stateCode) {
        if (isActive) {
          setCities([])
          setIsLoadingCities(false)
        }
        return
      }

      setIsLoadingCities(true)

      try {
        const nextCities = await loadBrazilCitiesByState(stateCode)
        if (isActive) {
          setCities(nextCities)
        }
      } catch {
        if (isActive) {
          setCities([])
        }
      } finally {
        if (isActive) {
          setIsLoadingCities(false)
        }
      }
    }

    void loadCities()

    return () => {
      isActive = false
    }
  }, [stateCode])

  return {
    cities,
    isLoadingCities,
  }
}
