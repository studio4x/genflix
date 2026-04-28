import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const isWindows = process.platform === 'win32'

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return
  }

  const raw = readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1)
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile(join(process.cwd(), '.env'))
loadEnvFile(join(process.cwd(), '.env.local'))

const vercelToken = process.env.VERCEL_TOKEN?.trim() || process.env.VERCEL_ACCESS_TOKEN?.trim() || ''
const vercelScope = process.env.VERCEL_SCOPE?.trim() || 'genflixcursos-6767s-projects'
const canonicalProductionUrl = process.env.APP_PUBLIC_URL?.trim() || ''

function quoteArg(value) {
  return /\s/.test(value) ? `"${value}"` : value
}

function withVercelAuthArgs(args) {
  const resolvedArgs = [...args]

  if (vercelScope) {
    resolvedArgs.push('--scope', vercelScope)
  }

  if (vercelToken) {
    resolvedArgs.push('--token', vercelToken)
  }

  return resolvedArgs
}

function run(command, args, options = {}) {
  const sharedOptions = {
    stdio: options.captureOutput ? 'pipe' : 'inherit',
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: options.captureOutput ? 'utf8' : undefined,
  }

  const result = isWindows
    ? spawnSync(
        'cmd.exe',
        ['/d', '/s', '/c', [command, ...args].map(quoteArg).join(' ')],
        sharedOptions,
      )
    : spawnSync(command, args, sharedOptions)

  if (options.captureOutput) {
    return result
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function ensureCleanGitWorktree() {
  const result = run('git', ['status', '--short'], { captureOutput: true })

  if (result.status !== 0) {
    process.stderr.write('Nao foi possivel validar o estado do git antes do deploy.\n')
    process.exit(result.status ?? 1)
  }

  const output = (result.stdout ?? '').trim()

  if (output.length > 0) {
    process.stderr.write(
      'O deploy da Vercel deve ser executado com o git limpo. Faca commit/push antes de rodar npm run deploy:vercel.\n',
    )
    process.exit(1)
  }
}

ensureCleanGitWorktree()

process.stdout.write('Gerando output prebuilt da Vercel sem bump adicional de build...\n')
run(npxCommand, withVercelAuthArgs(['vercel', 'build', '--prod']), {
  env: {
    CI: 'true',
  },
})

process.stdout.write(`Publicando output prebuilt em producao na Vercel pelo projeto canonico (${vercelScope})...\n`)
const deployResult = run(npxCommand, withVercelAuthArgs(['vercel', 'deploy', '--prebuilt', '--prod', '--yes']), {
  captureOutput: true,
})

if (deployResult.status !== 0) {
  process.stdout.write(deployResult.stdout ?? '')
  process.stderr.write(deployResult.stderr ?? '')
  process.exit(deployResult.status ?? 1)
}

process.stdout.write(deployResult.stdout ?? '')
process.stderr.write(deployResult.stderr ?? '')

const deploymentUrlMatch = (deployResult.stdout ?? '').match(/Production:\s+(https?:\/\/[^\s]+)/)
const deploymentUrl = deploymentUrlMatch?.[1]
const canonicalDomain = canonicalProductionUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')

if (deploymentUrl && canonicalDomain) {
  process.stdout.write(`Atualizando alias canonico ${canonicalDomain} -> ${deploymentUrl}\n`)
  run(npxCommand, withVercelAuthArgs(['vercel', 'alias', 'set', deploymentUrl, canonicalDomain]))
}
