function hasMojibake(value: string) {
  return /Ã|Â|\uFFFD/.test(value)
}

function decodeUtf8FromLatin1(value: string) {
  const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff)
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

export function fixMojibakeText(value: string) {
  if (!value || !hasMojibake(value)) {
    return value
  }

  let current = value
  for (let index = 0; index < 2; index += 1) {
    const next = decodeUtf8FromLatin1(current)
    if (!next || next === current) {
      break
    }
    current = next
    if (!hasMojibake(current)) {
      break
    }
  }

  return current
}
