import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const vercelCliPackage = 'vercel@54.7.1'
const isWindows = process.platform === 'win32'
const vercelApiBase = 'https://api.vercel.com'

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
    const value = parseEnvValue(trimmed.slice(separatorIndex + 1))
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function parseEnvValue(value) {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

function ensureSpaFallbackRoute(workspace = process.cwd()) {
  const configPath = join(workspace, '.vercel', 'output', 'config.json')

  if (!existsSync(configPath)) {
    return
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'))

  if (Array.isArray(config.routes) && config.routes.length > 0) {
    return
  }

  config.routes = [
    {
      src: '/((?!api/|assets/|.*\\.[^/]+$).*)',
      dest: '/index.html',
      check: true,
    },
  ]

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
}

function ensurePublicAssetProxyRoutes(workspace = process.cwd()) {
  const configPath = join(workspace, '.vercel', 'output', 'config.json')

  if (!existsSync(configPath)) {
    return
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  const routes = Array.isArray(config.routes) ? config.routes : []
  const requiredRoutes = [
    {
      src: '^/api/public/site-asset(?:/)?$',
      dest: 'https://axhlkilkqolvfecyhhxx.supabase.co/functions/v1/public-site-asset',
    },
    {
      src: '^/api/public/course-media(?:/)?$',
      dest: 'https://axhlkilkqolvfecyhhxx.supabase.co/functions/v1/public-course-media',
    },
  ]

  const missingRoutes = requiredRoutes.filter((requiredRoute) => (
    !routes.some((route) => route?.src === requiredRoute.src || route?.dest === requiredRoute.dest)
  ))

  if (missingRoutes.length === 0) {
    return
  }

  config.routes = [...missingRoutes, ...routes]
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
}

function shouldCopyBuildWorkspace(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/')
  if (!normalized) {
    return true
  }
  if (normalized === '.git' || normalized.startsWith('.git/')) {
    return false
  }
  if (normalized === 'node_modules' || normalized.startsWith('node_modules/')) {
    return false
  }
  if (normalized === 'dist' || normalized.startsWith('dist/')) {
    return false
  }
  if (normalized === 'supabase' || normalized.startsWith('supabase/')) {
    return false
  }
  if (normalized === '.vercel/output' || normalized.startsWith('.vercel/output/')) {
    return false
  }
  return true
}

function createBuildWorkspace() {
  const tempWorkspace = mkdtempSync(join(tmpdir(), 'genflix-vercel-build-'))
  cpSync(process.cwd(), tempWorkspace, {
    recursive: true,
    filter: (_source, destination) => {
      const relativeDestination = destination.slice(tempWorkspace.length).replace(/^[/\\]+/, '')
      return shouldCopyBuildWorkspace(relativeDestination)
    },
  })
  return tempWorkspace
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(pathname) {
  const response = await fetch(`${vercelApiBase}${pathname}`, {
    headers: {
      Authorization: `Bearer ${vercelToken}`,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao consultar Vercel API (${response.status}): ${body}`)
  }

  return response.json()
}

function getGitHeadSha() {
  const result = run('git', ['rev-parse', 'HEAD'], { captureOutput: true })

  if (result.status !== 0) {
    process.stderr.write('Nao foi possivel obter o SHA atual do git.\n')
    process.exit(result.status ?? 1)
  }

  return (result.stdout ?? '').trim()
}

async function getLatestProductionDeployment() {
  const data = await fetchJson(`/v6/deployments?projectId=${encodeURIComponent(process.env.VERCEL_PROJECT_ID ?? '')}&limit=1`)
  return data.deployments?.[0] ?? null
}

async function waitForDeploymentBySha(expectedSha, timeoutMs = 3 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs
  let lastDeployment = null

  while (Date.now() < deadline) {
    const deployment = await getLatestProductionDeployment()
    lastDeployment = deployment

    if (
      deployment
      && deployment.readyState === 'READY'
      && deployment.target === 'production'
      && deployment.meta?.githubCommitSha === expectedSha
    ) {
      return deployment
    }

    await sleep(5000)
  }

  const lastSha = lastDeployment?.meta?.githubCommitSha ?? 'desconhecido'
  const lastUrl = lastDeployment?.url ? `https://${lastDeployment.url}` : 'desconhecida'
  throw new Error(`Timeout aguardando deploy da producao para o SHA ${expectedSha}. Ultimo visto: ${lastSha} em ${lastUrl}`)
}

function extractDeploymentHost(output) {
  const matches = output.match(/https:\/\/([a-z0-9-]+\.vercel\.app)/ig)
  if (!matches || matches.length === 0) {
    return null
  }

  const lastMatch = matches[matches.length - 1]
  return lastMatch.replace(/^https:\/\//i, '').toLowerCase()
}

async function waitForDeploymentReadyByHost(expectedHost, timeoutMs = 3 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs
  let lastDeployment = null

  while (Date.now() < deadline) {
    const deployment = await getLatestProductionDeployment()
    lastDeployment = deployment
    const deploymentHost = deployment?.url?.toLowerCase()

    if (deployment?.readyState === 'READY' && deployment?.target === 'production' && deploymentHost === expectedHost) {
      return deployment
    }

    await sleep(5000)
  }

  const lastHost = lastDeployment?.url ? `https://${lastDeployment.url}` : 'desconhecida'
  throw new Error(`Timeout aguardando deploy READY para ${expectedHost}. Ultimo visto: ${lastHost}`)
}

async function ensureAliasPointsTo(deploymentUrl, canonicalDomain, maxAttempts = 8) {
  const deploymentHost = deploymentUrl.replace(/^https?:\/\//, '')
  const escapedDeploymentHost = deploymentHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedCanonicalDomain = canonicalDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const aliasRegex = new RegExp(`${escapedDeploymentHost}\\s+${escapedCanonicalDomain}`)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const aliasResult = run(npxCommand, withVercelAuthArgs([vercelCliPackage, 'alias', 'ls']), { captureOutput: true })
    const aliasOutput = aliasResult.stdout ?? ''

    if (aliasRegex.test(aliasOutput)) {
      return
    }

    if (attempt < maxAttempts) {
      await sleep(5000)
    }
  }

  throw new Error(`Falha ao validar alias canonico apos ${maxAttempts} tentativas: ${deploymentHost} -> ${canonicalDomain}`)
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

async function main() {
  ensureCleanGitWorktree()

  const headSha = getGitHeadSha()
  const canonicalDomain = canonicalProductionUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const buildWorkspace = createBuildWorkspace()

  try {
    process.stdout.write('Gerando output prebuilt da Vercel sem bump adicional de build...\n')
    run(npxCommand, withVercelAuthArgs([vercelCliPackage, 'build', '--prod']), {
      cwd: buildWorkspace,
      env: {
        CI: 'true',
        VERCEL_DEPLOY_PREBUILT: '1',
        NODE_ENV: 'development',
        NPM_CONFIG_PRODUCTION: 'false',
        NPM_CONFIG_INCLUDE: 'dev',
      },
    })

    ensureSpaFallbackRoute(buildWorkspace)
    ensurePublicAssetProxyRoutes(buildWorkspace)

    process.stdout.write(`Publicando output prebuilt em producao na Vercel pelo projeto canonico (${vercelScope})...\n`)
    const tempWorkspace = mkdtempSync(join(tmpdir(), 'genflix-vercel-'))

    try {
      const tempOutputDir = join(tempWorkspace, '.vercel', 'output')
      cpSync(join(buildWorkspace, '.vercel', 'output'), tempOutputDir, { recursive: true })

      const deployResult = run(npxCommand, withVercelAuthArgs([
        vercelCliPackage,
        'deploy',
        '--prebuilt',
        '--prod',
        '--yes',
        '--archive=tgz',
        '--meta',
        `githubCommitSha=${headSha}`,
        '--meta',
        `gitCommitSha=${headSha}`,
      ]), {
        captureOutput: true,
        cwd: tempWorkspace,
      })

      if (deployResult.status !== 0) {
        process.stdout.write(deployResult.stdout ?? '')
        process.stderr.write(deployResult.stderr ?? '')
        process.exit(deployResult.status ?? 1)
      }

      process.stdout.write(deployResult.stdout ?? '')
      process.stderr.write(deployResult.stderr ?? '')

      const deploymentHost = extractDeploymentHost(deployResult.stdout ?? '')
      const deployment = deploymentHost
        ? await waitForDeploymentReadyByHost(deploymentHost)
        : await waitForDeploymentBySha(headSha)
      const deploymentUrl = `https://${deployment.url}`

      if (!canonicalDomain) {
        throw new Error('APP_PUBLIC_URL nao configurado; nao foi possivel validar alias canonico.')
      }

      process.stdout.write(`Atualizando alias canonico ${canonicalDomain} -> ${deploymentUrl}\n`)
      run(npxCommand, withVercelAuthArgs([vercelCliPackage, 'alias', 'set', deploymentUrl, canonicalDomain]), {
        cwd: tempWorkspace,
      })

      await ensureAliasPointsTo(deploymentUrl, canonicalDomain)

      const currentDeployment = await getLatestProductionDeployment()
      if (!currentDeployment || currentDeployment.meta?.githubCommitSha !== headSha || currentDeployment.readyState !== 'READY') {
        throw new Error(`Falha ao validar deployment atual. Esperado SHA ${headSha}, encontrado ${currentDeployment?.meta?.githubCommitSha ?? 'desconhecido'}.`)
      }

      process.stdout.write(`Deploy confirmado para ${deploymentUrl} com alias ${canonicalDomain}\n`)
    } finally {
      rmSync(tempWorkspace, { recursive: true, force: true })
    }
  } finally {
    rmSync(buildWorkspace, { recursive: true, force: true })
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
