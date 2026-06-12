function trimCategory(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeCourseCategoryList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  const normalized: string[] = []

  for (const value of values) {
    const category = trimCategory(value)
    if (!category) {
      continue
    }
    if (!normalized.some((item) => item.toLocaleLowerCase('pt-BR') === category.toLocaleLowerCase('pt-BR'))) {
      normalized.push(category)
    }
  }

  return normalized
}

export function normalizeCoursePrimaryCategory(category: unknown): string | null {
  const value = trimCategory(category)
  return value || null
}

export function getCourseCategories(input: {
  category?: string | null
  categories?: string[] | null
}) {
  const normalizedCategories = normalizeCourseCategoryList(input.categories)
  if (normalizedCategories.length > 0) {
    return normalizedCategories
  }

  const primaryCategory = normalizeCoursePrimaryCategory(input.category)
  return primaryCategory ? [primaryCategory] : []
}

export function getCoursePrimaryCategory(input: {
  category?: string | null
  categories?: string[] | null
}) {
  return getCourseCategories(input)[0] ?? null
}
