import fs from 'node:fs'
import path from 'node:path'

const shouldSkipForCi = process.env.CI === 'true' && process.env.HCM_BUMP_IN_CI !== '1'
if (shouldSkipForCi) {
  process.exit(0)
}

const targetPath = path.resolve('src/components/layout/AppVersion.tsx')
const source = fs.readFileSync(targetPath, 'utf8')
const match = source.match(/APP_BUILD_VERSION = '(\d+)\.(\d+)\.(\d+)'/)

if (!match) {
  throw new Error(`Nao foi possivel localizar APP_BUILD_VERSION em ${targetPath}.`)
}

const nextVersion = [
  Number(match[1]),
  Number(match[2]),
  Number(match[3]) + 1,
].join('.')

const updatedSource = source.replace(
  /APP_BUILD_VERSION = '\d+\.\d+\.\d+'/,
  `APP_BUILD_VERSION = '${nextVersion}'`,
)

fs.writeFileSync(targetPath, updatedSource, 'utf8')
process.stdout.write(`Build version atualizada para ${nextVersion}\n`)
