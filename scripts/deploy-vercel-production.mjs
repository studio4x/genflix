import { spawnSync } from 'node:child_process'
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const isWindows = process.platform === 'win32'
const vercelToken = process.env.VERCEL_TOKEN?.trim() || process.env.VERCEL_ACCESS_TOKEN?.trim() || ''
const vercelScope = process.env.VERCEL_SCOPE?.trim() || 'genflixcursos-6767s-projects'

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

process.stdout.write(`Publicando output prebuilt em producao na Vercel pelo projeto canônico (${vercelScope})...\n`)
run(npxCommand, withVercelAuthArgs(['vercel', 'deploy', '--prebuilt', '--prod', '--yes']))
