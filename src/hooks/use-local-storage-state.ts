import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

interface LocalStorageStateResult<T> {
  state: T
  setState: Dispatch<SetStateAction<T>>
  clear: () => void
}

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): LocalStorageStateResult<T> {
  const [state, setState] = useState<T>(() => readLocalStorage(key, initialValue))

  useEffect(() => {
    setState(readLocalStorage(key, initialValue))
  }, [key, initialValue])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Ignora erros de quota/permissao para nao quebrar formulario.
    }
  }, [key, state])

  const clear = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // Ignora erros para manter UX.
      }
    }
    setState(initialValue)
  }, [initialValue, key])

  return {
    state,
    setState,
    clear,
  }
}

