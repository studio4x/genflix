import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const templateDir = path.join(__dirname, 'templates')

const COPY_EXCLUDES = new Set([
  '.git',
  '.vercel',
  'node_modules',
  'dist',
  'tmp',
])

const FILE_EXCLUDES = new Set([
  '.env.development',
  '.env.local',
  '.env.vercel.production.tmp',
])

const REMOVED_PATHS = [
  'api/integrations/hcm',
  'docs/integrations',
  'docs/spin-off-bootstrap.md',
  'src/features/admin/integrations',
  'src/pages/admin/admin-integrations-page.tsx',
  'src/pages/admin/builder/course-integration-panel.tsx',
  'src/pages/public/hcm-access-page.tsx',
  'scripts/create-spin-off.mjs',
  'scripts/templates',
  'supabase/functions/hcm-outbox-dispatch',
]

const TEXT_FILE_EXTENSIONS = new Set([
  '.css',
  '.env',
  '.example',
  '.html',
  '.json',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
])

function printUsage() {
  console.log(`
Uso:
  npm run spin-off:create -- --target <pasta-destino> [opcoes]

Opcoes:
  --target <path>         Pasta da nova plataforma (obrigatorio)
  --product-name <nome>   Nome da nova marca/produto
  --package-name <slug>   Nome do package.json da nova plataforma
  --app-domain <dominio>  Dominio publico inicial para a nova plataforma
  --remote <git-url>      URL remota opcional para configurar origin
  --skip-git              Nao inicializa um novo repositório Git
  --force                 Sobrescreve a pasta de destino se ela ja existir

Exemplo:
  npm run spin-off:create -- --target ..\\lms-spin-off --product-name "Academia Independente" --app-domain cursos.exemplo.com.br
`.trim())
}

function parseArgs(argv) {
  const options = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const next = argv[index + 1]

    if (!next || next.startsWith('--')) {
      options[key] = true
      continue
    }

    options[key] = next
    index += 1
  }

  return options
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function removePath(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true })
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (COPY_EXCLUDES.has(entry.name) || FILE_EXCLUDES.has(entry.name)) {
      continue
    }

    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath)
      continue
    }

    if (entry.isSymbolicLink()) {
      continue
    }

    await fs.copyFile(sourcePath, targetPath)
  }
}

async function readNormalizedFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return raw.replace(/\r\n/g, '\n')
}

async function writeNormalizedFile(filePath, contents) {
  await fs.writeFile(filePath, `${contents.replace(/\r\n/g, '\n')}\n`, 'utf8')
}

function replaceOrThrow(contents, searchValue, replaceValue, label) {
  const next = contents.replace(searchValue, replaceValue)
  if (next === contents) {
    throw new Error(`Nao foi possivel aplicar patch em ${label}.`)
  }
  return next
}

async function patchRouter(targetRoot) {
  const filePath = path.join(targetRoot, 'src/app/router/index.tsx')
  let contents = await readNormalizedFile(filePath)

  contents = replaceOrThrow(
    contents,
    "import { AdminIntegrationsPage } from '@/pages/admin/admin-integrations-page'\n",
    '',
    'src/app/router/index.tsx import AdminIntegrationsPage',
  )
  contents = replaceOrThrow(
    contents,
    "import { HcmAccessPage } from '@/pages/public/hcm-access-page'\n",
    '',
    'src/app/router/index.tsx import HcmAccessPage',
  )
  contents = replaceOrThrow(
    contents,
    "import { CourseIntegrationPanel } from '@/pages/admin/builder/course-integration-panel'\n",
    '',
    'src/app/router/index.tsx import CourseIntegrationPanel',
  )
  contents = replaceOrThrow(
    contents,
    "  {\n    path: '/auth/hcm-access',\n    element: <HcmAccessPage />,\n  },\n",
    '',
    'src/app/router/index.tsx route /auth/hcm-access',
  )
  contents = replaceOrThrow(
    contents,
    "          {\n            path: 'integration',\n            element: <CourseIntegrationPanel />,\n          },\n",
    '',
    'src/app/router/index.tsx builder integration route',
  )
  contents = replaceOrThrow(
    contents,
    "          {\n            path: '/admin/integracoes',\n            element: <AdminIntegrationsPage />,\n          },\n",
    '',
    'src/app/router/index.tsx admin integrations route',
  )

  await writeNormalizedFile(filePath, contents)
}

async function patchAdminLayout(targetRoot, productName) {
  const filePath = path.join(targetRoot, 'src/app/layouts/admin-layout.tsx')
  let contents = await readNormalizedFile(filePath)

  contents = replaceOrThrow(
    contents,
    "  { to: '/admin/integracoes', label: 'Integracoes' },\n",
    '',
    'src/app/layouts/admin-layout.tsx adminLinks integrations',
  )
  contents = contents.replace('HomeCare Match Academy', productName)

  await writeNormalizedFile(filePath, contents)
}

async function patchCourseSettingsPanel(targetRoot) {
  const filePath = path.join(targetRoot, 'src/pages/admin/builder/course-settings-panel.tsx')
  let contents = await readNormalizedFile(filePath)

  contents = replaceOrThrow(
    contents,
    "import { Link } from 'react-router-dom'\n",
    '',
    'course-settings-panel import Link',
  )
  contents = replaceOrThrow(
    contents,
    "  fetchCourseExternalMapping,\n",
    '',
    'course-settings-panel import fetchCourseExternalMapping',
  )
  contents = replaceOrThrow(
    contents,
    "  upsertCourseExternalMapping,\n",
    '',
    'course-settings-panel import upsertCourseExternalMapping',
  )
  contents = replaceOrThrow(
    contents,
    "  const [externalCourseId, setExternalCourseId] = useState('')\n",
    '',
    'course-settings-panel externalCourseId state',
  )
  contents = replaceOrThrow(
    contents,
    "      setExternalCourseId('')\n",
    '',
    'course-settings-panel reset externalCourseId',
  )
  contents = replaceOrThrow(
    contents,
    `  useEffect(() => {
    async function loadExternalMapping() {
      if (!courseTree) return

      try {
        const mapping = await fetchCourseExternalMapping(courseTree.course.id)
        setExternalCourseId(mapping?.external_course_id ?? '')
      } catch (err) {
        setError(toErrorMessage(err))
      }
    }

    void loadExternalMapping()
  }, [courseTree])

`,
    '',
    'course-settings-panel external mapping effect',
  )
  contents = replaceOrThrow(
    contents,
    "      await upsertCourseExternalMapping(courseTree.course.id, externalCourseId)\n",
    '',
    'course-settings-panel upsertCourseExternalMapping submit',
  )

  const externalIdBlockPattern =
    /               <label className="block space-y-2">\n                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">ID do Curso na HomeCare Match<\/span>[\s\S]*?               <\/label>\n\n/
  const stripped = contents.replace(externalIdBlockPattern, '')
  if (stripped === contents) {
    throw new Error('Nao foi possivel remover o bloco de mapeamento externo de course-settings-panel.tsx.')
  }
  contents = stripped

  await writeNormalizedFile(filePath, contents)
}

async function patchPackageJson(targetRoot, packageName) {
  const filePath = path.join(targetRoot, 'package.json')
  const packageJson = JSON.parse(await fs.readFile(filePath, 'utf8'))
  packageJson.name = packageName
  await fs.writeFile(filePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
}

async function patchPackageLock(targetRoot, packageName) {
  const filePath = path.join(targetRoot, 'package-lock.json')
  if (!(await exists(filePath))) {
    return
  }

  const packageLock = JSON.parse(await fs.readFile(filePath, 'utf8'))
  packageLock.name = packageName
  if (packageLock.packages?.['']) {
    packageLock.packages[''].name = packageName
  }
  await fs.writeFile(filePath, `${JSON.stringify(packageLock, null, 2)}\n`, 'utf8')
}

async function patchIndexHtml(targetRoot, productName) {
  const filePath = path.join(targetRoot, 'index.html')
  let contents = await readNormalizedFile(filePath)
  contents = contents.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${productName}</title>`,
  )
  await writeNormalizedFile(filePath, contents)
}

async function patchReadme(targetRoot, productName, domain, sourceRepoName) {
  const filePath = path.join(targetRoot, 'README.md')
  const contents = `# ${productName}

Bootstrap gerado a partir do snapshot do repositório \`${sourceRepoName}\`, já sem a camada de integração com a plataforma principal na v1.

## O que este spin-off preserva

- cursos, módulos, aulas, quizzes, player e builder
- liberações internas por aluno e grupo
- exportações/PDFs e recursos do LMS
- modelo de acesso baseado em \`course_releases\` e \`is_course_released()\`

## O que foi removido no bootstrap

- rotas e handlers em \`api/integrations/hcm/*\`
- fluxo público \`/auth/hcm-access\`
- telas de integrações e atalhos do admin
- outbox, cron e Edge Function de sincronização externa
- documentação específica da HomeCare Match em \`docs/integrations/\`

## Setup inicial

1. Instale dependências:
   \`\`\`bash
   npm install
   \`\`\`
2. Configure as variáveis de ambiente com o Supabase do novo projeto.
3. Crie o novo projeto Supabase e rode:
   \`\`\`bash
   npx supabase link --project-ref <novo-project-ref>
   npx supabase db push
   \`\`\`
4. Crie o novo projeto Vercel e configure o domínio público:
   - ${domain}
5. Gere o primeiro build local:
   \`\`\`bash
   npm run build:dev
   npm run build
   \`\`\`

## Próximos arquivos para revisar

- \`docs/spin-off-next-steps.md\`
- \`docs/spin-off-review-report.md\`
`
  await fs.writeFile(filePath, contents.replace(/\r\n/g, '\n'), 'utf8')
}

async function patchBootstrapAdminEmails(targetRoot, adminEmail) {
  const migrationPath = path.join(targetRoot, 'supabase/migrations/20260320164000_bootstrap_first_admin.sql')
  const seedPath = path.join(targetRoot, 'supabase/seeds/assign_first_admin.sql')

  if (await exists(migrationPath)) {
    const contents = await readNormalizedFile(migrationPath)
    await writeNormalizedFile(
      migrationPath,
      contents.replace('contato@homecarematch.com.br', adminEmail),
    )
  }

  if (await exists(seedPath)) {
    const contents = await readNormalizedFile(seedPath)
    await writeNormalizedFile(
      seedPath,
      contents.replace('admin@homecarematch.com', adminEmail),
    )
  }
}

async function writeCleanupMigration(targetRoot) {
  const templatePath = path.join(templateDir, 'spin-off-remove-hcm-integration.sql')
  const sqlTemplate = await fs.readFile(templatePath, 'utf8')
  const now = new Date()
  const timestamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('')
  const fileName = `${timestamp}_remove_hcm_integration_for_spin_off.sql`
  const filePath = path.join(targetRoot, 'supabase/migrations', fileName)
  await fs.writeFile(filePath, sqlTemplate.replace(/\r\n/g, '\n'), 'utf8')
  return path.relative(targetRoot, filePath).replace(/\\/g, '/')
}

async function collectTextFiles(rootDir, bucket = []) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })

  for (const entry of entries) {
    if (COPY_EXCLUDES.has(entry.name) || FILE_EXCLUDES.has(entry.name) || entry.name === '.git') {
      continue
    }

    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      await collectTextFiles(fullPath, bucket)
      continue
    }

    const ext = path.extname(entry.name)
    if (TEXT_FILE_EXTENSIONS.has(ext) || entry.name.endsWith('.env.example')) {
      bucket.push(fullPath)
    }
  }

  return bucket
}

function shouldIgnoreForReview(relativePath) {
  const normalizedPath = relativePath.replace(/\\/g, '/')

  return (
    normalizedPath === 'docs/spin-off-bootstrap.md' ||
    normalizedPath === 'docs/spin-off-next-steps.md' ||
    normalizedPath === 'docs/spin-off-review-report.md' ||
    normalizedPath === 'docs/spin-off-bootstrap-summary.json' ||
    normalizedPath === 'README.md' ||
    normalizedPath === 'package-lock.json' ||
    normalizedPath === 'scripts/create-spin-off.mjs' ||
    normalizedPath.startsWith('scripts/templates/') ||
    normalizedPath === 'supabase/migrations/20260331130000_hcm_lms_integration.sql' ||
    normalizedPath === 'supabase/migrations/20260331143000_schedule_hcm_outbox_dispatch.sql' ||
    normalizedPath === 'supabase/migrations/20260331183000_set_hcm_events_webhook_url.sql' ||
    normalizedPath === 'supabase/migrations/20260320164000_bootstrap_first_admin.sql' ||
    normalizedPath === 'supabase/seeds/assign_first_admin.sql'
  )
}

async function writeRemainingReferencesReport(targetRoot, productName) {
  const patterns = [
    /HomeCare Match/g,
    /homecarematch/gi,
    /\/auth\/hcm-access/g,
    /\/admin\/integracoes/g,
    /api\/integrations\/hcm/g,
    /homecare_match/g,
  ]

  const matches = []
  const files = await collectTextFiles(targetRoot)

  for (const filePath of files) {
    const relativePath = path.relative(targetRoot, filePath).replace(/\\/g, '/')
    if (shouldIgnoreForReview(relativePath)) {
      continue
    }

    const contents = await fs.readFile(filePath, 'utf8')
    const lines = contents.replace(/\r\n/g, '\n').split('\n')
    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          matches.push({
            file: relativePath,
            line: index + 1,
            content: line.trim(),
          })
          break
        }
      }
    })
  }

  const report = `# Relatório de revisão do spin-off

Produto inicial: ${productName}

Este relatório lista referências que ainda merecem revisão manual após o bootstrap. Elas não impedem a nova plataforma de subir, mas indicam pontos de branding, copy ou contratos antigos.

## Ocorrências encontradas

${matches.length === 0
  ? '- Nenhuma ocorrência remanescente encontrada.'
  : matches
      .map((match) => `- \`${match.file}:${match.line}\` -> ${match.content}`)
      .join('\n')}
`

  const reportPath = path.join(targetRoot, 'docs', 'spin-off-review-report.md')
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, report.replace(/\r\n/g, '\n'), 'utf8')

  return matches.length
}

async function writeNextStepsDoc(targetRoot, domain, cleanupMigrationPath) {
  const contents = `# Próximos passos do spin-off

## 1. GitHub

1. Crie um novo repositório vazio.
2. Dentro desta cópia, rode:
   \`\`\`bash
   git add .
   git commit -m "Bootstrap spin-off independente"
   git remote add origin <url-do-novo-repo>
   git push -u origin main
   \`\`\`

## 2. Supabase

1. Crie um novo projeto Supabase.
2. Atualize as variáveis locais e de produção com:
   - \`VITE_SUPABASE_URL\`
   - \`VITE_SUPABASE_ANON_KEY\`
   - \`SUPABASE_URL\`
   - \`SUPABASE_SERVICE_ROLE_KEY\`
3. Vincule o projeto:
   \`\`\`bash
   npx supabase link --project-ref <novo-project-ref>
   \`\`\`
4. Aplique as migrations, incluindo a de cleanup:
   \`\`\`bash
   npx supabase db push
   \`\`\`
5. Confirme que a migration \`${cleanupMigrationPath}\` foi aplicada ao final do histórico.

## 3. Vercel

1. Crie um novo projeto Vercel apontando para este novo repositório.
2. Configure o domínio principal planejado:
   - \`${domain}\`
3. Configure as mesmas variáveis genéricas de ambiente do app.
4. Gere e publique:
   \`\`\`bash
   npm run build:dev
   npm run build
   npm run deploy:vercel
   \`\`\`

## 4. Checklist funcional

- login/admin/player funcionando sem \`/auth/hcm-access\`
- tela de integrações removida do admin
- builder sem painel de integração do curso
- liberações internas por aluno/grupo funcionando
- quizzes, PDFs e player funcionando normalmente
`

  const filePath = path.join(targetRoot, 'docs', 'spin-off-next-steps.md')
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, contents.replace(/\r\n/g, '\n'), 'utf8')
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    throw new Error(`Falha ao executar: ${command} ${args.join(' ')}`)
  }
}

async function maybeInitGit(targetRoot, remote) {
  runCommand('git', ['init', '-b', 'main'], targetRoot)
  if (typeof remote === 'string' && remote.trim()) {
    runCommand('git', ['remote', 'add', 'origin', remote.trim()], targetRoot)
  }
}

function ensureAllowedTarget(targetRoot) {
  const relativeFromRepo = path.relative(repoRoot, targetRoot)
  const isInsideRepo = relativeFromRepo && !relativeFromRepo.startsWith('..') && !path.isAbsolute(relativeFromRepo)

  if (isInsideRepo && !relativeFromRepo.startsWith(`tmp${path.sep}`) && relativeFromRepo !== 'tmp') {
    throw new Error('Para evitar cópias recursivas acidentais, use uma pasta fora do repositório ou dentro de tmp/.')
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help || options.h) {
    printUsage()
    return
  }

  if (typeof options.target !== 'string' || options.target.trim().length === 0) {
    printUsage()
    throw new Error('Informe --target para gerar o spin-off.')
  }

  const targetRoot = path.resolve(process.cwd(), options.target)
  ensureAllowedTarget(targetRoot)

  const targetExists = await exists(targetRoot)
  if (targetExists) {
    if (!options.force) {
      throw new Error(`A pasta de destino ja existe: ${targetRoot}. Use --force para sobrescrever.`)
    }
    await removePath(targetRoot)
  }

  const targetBaseName = path.basename(targetRoot)
  const productName =
    typeof options['product-name'] === 'string' && options['product-name'].trim()
      ? options['product-name'].trim()
      : 'Nova Plataforma Academy'
  const packageName =
    typeof options['package-name'] === 'string' && options['package-name'].trim()
      ? options['package-name'].trim()
      : slugify(targetBaseName || productName)
  const domain =
    typeof options['app-domain'] === 'string' && options['app-domain'].trim()
      ? options['app-domain'].trim()
      : 'cursos.exemplo.com.br'
  const adminEmailDomain = domain.replace(/^cursos\./i, '') || 'plataforma.local'
  const adminBootstrapEmail = `admin@${adminEmailDomain}`

  console.log(`\nGerando spin-off em: ${targetRoot}`)
  console.log(`Produto: ${productName}`)
  console.log(`Package: ${packageName}`)
  console.log(`Dominio inicial: ${domain}\n`)

  await copyDirectory(repoRoot, targetRoot)

  for (const relativePath of REMOVED_PATHS) {
    await removePath(path.join(targetRoot, relativePath))
  }

  await patchRouter(targetRoot)
  await patchAdminLayout(targetRoot, productName)
  await patchCourseSettingsPanel(targetRoot)
  await patchPackageJson(targetRoot, packageName)
  await patchPackageLock(targetRoot, packageName)
  await patchIndexHtml(targetRoot, productName)
  await patchReadme(targetRoot, productName, domain, path.basename(repoRoot))
  await patchBootstrapAdminEmails(targetRoot, adminBootstrapEmail)

  const cleanupMigrationPath = await writeCleanupMigration(targetRoot)
  await writeNextStepsDoc(targetRoot, domain, cleanupMigrationPath)
  const remainingReferenceCount = await writeRemainingReferencesReport(targetRoot, productName)

  if (!options['skip-git']) {
    await maybeInitGit(targetRoot, options.remote)
  }

  const summary = {
    generated_at: new Date().toISOString(),
    source_repository: path.basename(repoRoot),
    target_directory: targetRoot,
    product_name: productName,
    package_name: packageName,
    domain,
    removed_paths: REMOVED_PATHS,
    cleanup_migration: cleanupMigrationPath,
    remaining_reference_count: remainingReferenceCount,
  }

  const summaryPath = path.join(targetRoot, 'docs', 'spin-off-bootstrap-summary.json')
  await fs.mkdir(path.dirname(summaryPath), { recursive: true })
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  console.log('Spin-off gerado com sucesso.\n')
  console.log(`- Nova pasta: ${targetRoot}`)
  console.log(`- Migration de cleanup: ${cleanupMigrationPath}`)
  console.log(`- Referencias remanescentes para revisar: ${remainingReferenceCount}`)
  console.log('- Leia os arquivos docs/spin-off-next-steps.md e docs/spin-off-review-report.md na nova base.')
}

main().catch((error) => {
  console.error(`\nFalha ao gerar spin-off: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
