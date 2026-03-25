function sanitizeForFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

export function downloadJsonFile(baseName: string, data: unknown) {
  const safeBaseName = sanitizeForFileName(baseName) || 'export'
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${safeBaseName}.json`
  link.click()

  URL.revokeObjectURL(url)
}

