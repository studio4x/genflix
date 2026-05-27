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
  if (/Ã[\u0080-\u00BF]/u.test(content)) artifacts.push('Ã<continuation-byte>')
  if (/Â[\u0080-\u00BF]/u.test(content)) artifacts.push('Â<continuation-byte>')
  if (/\uFFFD/u.test(content)) artifacts.push('replacement-char(U+FFFD)')
  return artifacts
}

const changedFiles = listChangedFiles()
const offenders = []

for (const filePath of changedFiles) {
  if (!fs.existsSync(filePath)) continue
  const content = fs.readFileSync(filePath, 'utf8')
  const artifacts = findEncodingArtifacts(content)
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
