# AGENTS

## Diretriz obrigatoria de deploy

Ao concluir qualquer tarefa neste repositorio, o agente deve executar deploy:

1. GitHub: realizar `commit` e `push` para o repositorio remoto.
2. Supabase: quando houver mudancas em `supabase/` (migracoes, funcoes, policies, seeds), executar deploy do banco (`supabase db push` ou fluxo equivalente aprovado pelo projeto).

## Regra de prioridade

Se houver conflito entre instrucoes locais, esta diretriz deve ser tratada como obrigatoria para encerramento da tarefa.
