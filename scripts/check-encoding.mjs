import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const TEXT_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.html',
  '.yml',
  '.yaml',
])

function listChangedFiles() {
  const output = execSync('git status --porcelain', { encoding: 'utf8' })
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter((filePath) => {
      const extension = path.extname(filePath).toLowerCase()
      return TEXT_FILE_EXTENSIONS.has(extension)
    })
}

function findEncodingArtifacts(content) {
  const artifacts = []
  if (/Ãƒ[\u0080-\u00BF]/u.test(content)) artifacts.push('Ãƒ<continuation-byte>')
  if (/Ã‚[\u0080-\u00BF]/u.test(content)) artifacts.push('Ã‚<continuation-byte>')
  if (/\uFFFD/u.test(content)) artifacts.push('replacement-char(U+FFFD)')
  return artifacts
}

function findTextCorruptionArtifacts(content, filePath) {
  const isTargetedUiFolder =
    filePath.startsWith('src/pages/admin/builder/') ||
    filePath.startsWith('src/features/admin/content/')

  if (!isTargetedUiFolder) {
    return []
  }

  const artifacts = []
  const suspiciousStringPatterns = [
    /[A-Za-zÀ-ÿ]{1,20}\?{1,3}[A-Za-zÀ-ÿ]{1,20}/u,
    /[A-Za-zÀ-ÿ]{1,20}\?-[A-Za-zÀ-ÿ]{1,20}/u,
    /[A-Za-zÀ-ÿ]{1,20}Ã[A-Za-zÀ-ÿ]/u,
  ]
  const stringLiteralPattern = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g

  for (const line of content.split(/\r?\n/)) {
    if (line.includes('http://') || line.includes('https://')) {
      continue
    }
    for (const match of line.matchAll(stringLiteralPattern)) {
      const literal = match[1] ?? match[2] ?? match[3] ?? ''
      if (!literal) {
        continue
      }
      if (suspiciousStringPatterns.some((pattern) => pattern.test(literal))) {
        artifacts.push(`suspect-text:${literal}`)
      }
    }
  }

  return artifacts
}

const changedFiles = listChangedFiles()
const offenders = []

for (const filePath of changedFiles) {
  if (!fs.existsSync(filePath)) continue
  const content = fs.readFileSync(filePath, 'utf8')
  const artifacts = [
    ...findEncodingArtifacts(content),
    ...findTextCorruptionArtifacts(content, filePath),
  ]
  if (artifacts.length > 0) {
    offenders.push({ filePath, artifacts })
  }
}

if (offenders.length > 0) {
  console.error('Foram detectados possíveis artefatos de codificação nos arquivos alterados:')
  for (const offender of offenders) {
    console.error(`- ${offender.filePath}: ${offender.artifacts.join(', ')}`)
  }
  console.error('Corrija a codificação para UTF-8 antes de gerar build.')
  process.exit(1)
}

console.log('Check de codificação concluído: sem artefatos de encoding nos arquivos alterados.')
