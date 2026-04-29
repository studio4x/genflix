# HomeCare Match LMS (Projeto Independente)

Plataforma LMS web da HomeCare Match, criada como aplicacao separada e sem dependencia do repositório atual.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Supabase (Auth, Postgres, Storage)
- Vercel
- GitHub

## Sprint Atual

- Sprint 0 (itens obrigatorios): concluida.
- Sprint 1 (itens obrigatorios): autenticacao, perfis/papeis, guardas e layouts base.
- Sprint 2 (itens obrigatorios): CRUD admin de cursos, modulos, aulas e materiais.
- Sprint 3 (itens obrigatorios): dashboard/aluno, cursos liberados, liberacao por usuario e grupo.
- Sprint 4 (itens obrigatorios): progresso por aula/modulo, bloqueio sequencial e estados visuais.
- Extensao admin: cadastro de alunos via painel (`/admin/alunos`).

## Requisitos de ambiente

- Node.js 22+
- npm 10+
- Supabase CLI (via `npx supabase`)

## Setup local

```bash
npm install
cp .env.development.example .env.development
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run preview
```

## Supabase local

```bash
npx supabase start
npx supabase db reset
```

## Ambientes

- `development`: `.env.development`
- `production`: variaveis configuradas na Vercel

Campos minimos:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (somente ambiente servidor/Vercel)
- `VITE_APP_TIMEZONE`
- `VITE_APP_LOCALE`

## Primeiro usuario admin

Fluxo padrao definido para Sprint 1:

1. Criar usuario inicial via painel Auth do Supabase ou script administrativo de bootstrap.
2. Associar role `admin` em `user_roles`.
3. Bloquear reexecucao da rotina de bootstrap apos criacao inicial.

Detalhes em `docs/architecture/foundation-rules.md`.

## Diretriz operacional do agente

Ao concluir qualquer tarefa de implementacao neste repositorio, o agente deve:

1. Publicar as alteracoes no GitHub (commit + push).
2. Publicar as alteracoes de banco no Supabase (migracoes/funcoes/policies), quando houver mudancas em `supabase/`.

## Deploy Vercel

Fluxo recomendado para evitar deploys em dominio antigo:

1. Garantir que o `git status` esteja limpo.
2. Executar `npm run deploy:vercel`.
3. Confirmar que `genflix-omega.vercel.app` aponta para o deploy mais recente com `READY`.
4. Se o alias nao atualizar, verificar o `HEAD` local, o ultimo deploy da Vercel e o vinculo em `.vercel/project.json`.
