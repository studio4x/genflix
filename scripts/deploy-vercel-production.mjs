import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const isWindows = process.platform === 'win32'

function quoteArg(value) {
  return /\s/.test(value) ? `"${value}"` : value
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
run(npxCommand, ['vercel', 'build', '--prod'], {
  env: {
    CI: 'true',
  },
})

const deployWorkspace = path.join(os.tmpdir(), 'hcm-vercel-prebuilt')
const tempOutputDir = path.join(deployWorkspace, '.vercel', 'output')
const tempProjectFile = path.join(deployWorkspace, '.vercel', 'project.json')

fs.rmSync(deployWorkspace, { recursive: true, force: true })
fs.mkdirSync(tempOutputDir, { recursive: true })
fs.cpSync(path.resolve('.vercel', 'output'), tempOutputDir, { recursive: true })
fs.copyFileSync(path.resolve('.vercel', 'project.json'), tempProjectFile)

process.stdout.write('Publicando output prebuilt em producao na Vercel a partir de workspace temporario sem metadados do git...\n')
run(npxCommand, ['vercel', 'deploy', '--prebuilt', '--prod', '--yes'], {
  cwd: deployWorkspace,
})
