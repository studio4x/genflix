# Bootstrap do Spin-off Independente

Este repositório agora inclui um bootstrap automatizado para gerar uma nova plataforma LMS independente, mantendo o núcleo atual e removendo a camada específica de integração com a plataforma principal.

## O que o bootstrap faz

- copia o snapshot atual para uma nova pasta, sem `.git`, `node_modules`, `dist`, `.vercel` e arquivos locais sensíveis
- remove rotas, handlers, páginas e funções específicas da integração HCM
- limpa a navegação do admin e o painel de configuração do curso
- cria uma migration nova de cleanup para o novo projeto Supabase
- gera documentação de próximos passos dentro da nova base
- opcionalmente inicializa um novo repositório Git já separado

## O que ele preserva

- cursos, módulos, aulas, quizzes, player e builder
- liberações internas por aluno e grupo
- modelo de acesso baseado em `course_releases` e `is_course_released()`
- exportações e recursos já nativos do LMS

## O que ele não faz sozinho

- criar o novo repositório GitHub no remoto
- criar o novo projeto Supabase
- criar o novo projeto Vercel
- fazer rebranding completo de todas as cópias e páginas institucionais

Esses pontos continuam em um checklist posterior, porque dependem do nome final do produto, domínio e credenciais da nova operação.

## Comando

```bash
npm run spin-off:create -- --target ..\novo-lms \
  --product-name "Nova Plataforma Academy" \
  --package-name "nova-plataforma-lms" \
  --app-domain cursos.novamarca.com.br
```

## Opções suportadas

- `--target`
  Pasta de destino da nova plataforma.
- `--product-name`
  Nome inicial do produto para `README`, `index.html` e cabeçalhos básicos.
- `--package-name`
  Nome do `package.json` da nova base.
- `--app-domain`
  Domínio público inicial para o checklist de deploy.
- `--remote`
  URL opcional para configurar `origin` na nova cópia.
- `--skip-git`
  Não inicializa um repositório Git na pasta gerada.
- `--force`
  Remove a pasta de destino antes de recriar o spin-off.

## Artefatos gerados no spin-off

- `docs/spin-off-next-steps.md`
- `docs/spin-off-review-report.md`
- `docs/spin-off-bootstrap-summary.json`
- `supabase/migrations/<timestamp>_remove_hcm_integration_for_spin_off.sql`

## Escopo de cleanup aplicado

- `api/integrations/hcm/*`
- `/auth/hcm-access`
- `/admin/integracoes`
- painel de integração do curso no builder
- Edge Function `hcm-outbox-dispatch`
- documentação específica da HomeCare Match em `docs/integrations/`

## Observação importante

O cleanup **não remove** o modelo interno de liberação do LMS. Colunas e regras genéricas como `course_releases`, `release_source`, `managed_by_integration` e `is_course_released()` permanecem na nova base, porque já fazem parte do funcionamento nativo do player/admin.
