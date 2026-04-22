# AGENTS

## Diretriz obrigatoria de deploy

Ao concluir qualquer tarefa neste repositorio, o agente deve executar deploy:

1. GitHub: realizar `commit` e `push` para o repositorio remoto.
2. Supabase: quando houver mudancas em `supabase/` (migracoes, funcoes, policies, seeds), executar deploy do banco (`supabase db push` ou fluxo equivalente aprovado pelo projeto).

## Regra de prioridade

Se houver conflito entre instrucoes locais, esta diretriz deve ser tratada como obrigatoria para encerramento da tarefa.

## Regra obrigatoria de versao de build

- O footer com `Build vX.Y.Z` deve mudar a cada build local.
- Ao concluir qualquer modificacao no repositorio, o agente deve obrigatoriamente gerar um novo build antes de encerrar a tarefa.
- Fonte de verdade: `src/components/layout/AppVersion.tsx`.
- Os comandos de build devem executar o bump automatico antes da compilacao.
- Em ambiente CI (`CI=true`), o bump deve ser ignorado por padrao para evitar incremento duplo.
- Para forcar bump no CI, usar `HCM_BUMP_IN_CI=1`.
- Comandos obrigatorios de build:
  - `npm run build:dev`
  - `npm run build`
- A resposta final do agente deve sempre informar explicitamente o numero atual do build gerado na tarefa.

## Playbook de deploy Vercel

- O auto-deploy via Git pode ser bloqueado pela Vercel quando o commit author do GitHub nao estiver atribuido corretamente ao usuario do time.
- Nesses casos, o deploy correto do frontend deve usar output prebuilt local em vez de depender apenas do deploy automatico por commit.
- Padrao obrigatorio para publicar o frontend:
  - `npm run deploy:vercel`
- Antes de rodar esse comando, o repositorio deve estar com `commit` e `push` concluidos, sem modificacoes pendentes no `git status`.
- Esse script deve:
  - gerar `.vercel/output` com `vercel build --prod` usando `CI=true`, para preservar o build version ja commitado;
  - copiar o output prebuilt para um workspace temporario sem `.git`;
  - publicar com `vercel deploy --prebuilt --prod --yes` a partir desse workspace temporario.
- Ao diagnosticar build em producao desatualizado, verificar:
  - se o dominio ainda aponta para um deploy antigo;
  - se os ultimos deploys Git estao falhando com `TEAM_ACCESS_REQUIRED`;
  - se um deploy CLI `prebuilt` foi promovido com alias para o dominio principal.

## Vinculo canonico da Vercel para este repositorio

- Projeto canonico de producao na Vercel:
  - team/escopo: `genflixcursos-6767s-projects`
  - project name: `genflix`
  - project id: `prj_PEBAfkCdpnfdrsM6W7G8LcLG4Rrl`
- Dominio canonico de producao:
  - `https://genflix-omega.vercel.app`
- `APP_PUBLIC_URL` de producao deve permanecer apontando para:
  - `https://genflix-omega.vercel.app`
- Antes de qualquer `npm run deploy:vercel`, validar se `.vercel/project.json` esta vinculado a esse projeto canonico.
- Se o workspace estiver vinculado ao projeto errado, relinkar antes do deploy:
  - `vercel link --yes --project prj_PEBAfkCdpnfdrsM6W7G8LcLG4Rrl --scope genflixcursos-6767s-projects`
  - `vercel pull --yes --environment production --scope genflixcursos-6767s-projects`
- Sinais de vinculo incorreto:
  - `.vercel/project.json` aponta para outro `projectId` ou outro `orgId`;
  - o deploy publica em dominio diferente de `genflix-omega.vercel.app`;
  - `vercel project ls --scope genflixcursos-6767s-projects` nao bate com o projeto local vinculado.
- Regra operacional:
  - desconsiderar `genflix-ten.vercel.app` como dominio de producao desta aplicacao;
  - usar `genflix-omega.vercel.app` como fonte de verdade para validacao de build e smoke test final.
- Seguranca:
  - nunca registrar tokens da Vercel, senhas ou credenciais sensiveis em arquivos versionados do repositorio;
  - tokens devem ser usados apenas em sessao/local env quando necessario para relink, pull ou deploy.

## Playbook de Edge Function 401

Quando uma Edge Function acionada pelo frontend retornar `401` em `functions/v1/...`, seguir este fluxo:

1. Tratar logs de extensoes do navegador como ruido, salvo se apontarem para o proprio dominio/function do projeto.
2. Garantir que o frontend envie um token de sessao atualizado:
   - chamar `supabase.auth.getSession()` e `supabase.auth.refreshSession()`;
   - enviar `Authorization: Bearer <access_token>`;
   - preferir `fetch` com headers explicitos durante diagnostico, em vez de depender apenas de `supabase.functions.invoke`;
   - incluir fallback no body: `{ access_token: <access_token> }`.
3. Se o `401` persistir no gateway da Edge Function:
   - fazer deploy com `--no-verify-jwt`;
   - validar autenticacao manualmente dentro da function;
   - ler token do header `Authorization` ou do body `access_token`;
   - validar com `supabaseAdmin.auth.getUser(token)`;
   - checar permissao administrativa antes de qualquer SQL privilegiado;
   - retornar erros JSON explicitos (`401 token ausente/invalido`, `403 acesso negado`).
4. Padrao de deploy para esse cenario:
   - `npx supabase functions deploy <function-name> --project-ref <ref> --no-verify-jwt`
5. Padrao de request no frontend para funcoes administrativas com instabilidade de auth:
   - `POST ${SUPABASE_URL}/functions/v1/<function-name>`
   - headers: `Content-Type: application/json`, `apikey`, `Authorization: Bearer <access_token>`
   - body: `{ access_token: <access_token> }`

Aplicar esse padrao a futuras funcoes administrativas, de manutencao, sync ou setup quando houver instabilidade de autenticacao.
