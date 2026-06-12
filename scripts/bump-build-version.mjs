import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const shouldSkipForCi = (
  process.env.CI === 'true' && process.env.HCM_BUMP_IN_CI !== '1'
) || process.env.VERCEL_DEPLOY_PREBUILT === '1'
if (shouldSkipForCi) {
  process.exit(0)
}

const targetPath = path.resolve('src/components/layout/AppVersion.tsx')
const source = fs.readFileSync(targetPath, 'utf8')
const match = source.match(/APP_BUILD_VERSION = '(\d+)\.(\d+)\.(\d+)(?:-[0-9a-f]+)?'/i)

if (!match) {
  throw new Error(`Nao foi possivel localizar APP_BUILD_VERSION em ${targetPath}.`)
}

const nextVersion = [
  Number(match[1]),
  Number(match[2]),
  Number(match[3]) + 1,
].join('.')

const commitShortHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
const nextVersionWithCommit = `${nextVersion}-${commitShortHash}`

const updatedSource = source.replace(
  /APP_BUILD_VERSION = '\d+\.\d+\.\d+(?:-[0-9a-f]+)?'/i,
  `APP_BUILD_VERSION = '${nextVersionWithCommit}'`,
)

fs.writeFileSync(targetPath, updatedSource, 'utf8')
process.stdout.write(`Build version atualizada para ${nextVersionWithCommit}\n`)
