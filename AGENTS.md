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
