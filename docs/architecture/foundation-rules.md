# Regras Base do MVP

## 1) Criacao do primeiro usurio admin

Estrategia inicial:

1. Criar o primeiro usurio no Supabase Auth com email/senha controlados por segredo operacional.
2. Inserir a role `admin` em `user_roles` para esse `user_id`.
3. Registrar em log/auditoria a cria??o do admin inicial.
4. Tratar est? rotina como one-time bootstrap.

Observacao:
- O bootstrap n?o depende de integracao com sistemas externos.

## 2) Status de curso no MVP

Status oficiais:

1. `draft`: em edicao, n?o visivel para alunos.
2. `published`: publicado e elegivel para libera??o.
3. `archived`: inativo, mantido para hist?rico.

## 3) Regra inicial de conclus?o de aula no MVP

Regra:

1. Aula obrigatria e marcada como concluida por acao explicita do aluno.
2. Em aula de video, a marcacao so fica disponvel apos atingir tempo minimo configurado.
3. Valor inicial recomendado de tempo minimo: 70% do tempo estimado.

## 4) Estrategia de timezone

Padrao unico:

1. Banco: timest?mps sempre em UTC.
2. Filtros por periodo: converter janela informada para UTC antes da consulta.
3. Exibicao no frontend: `America/Sao_Paulo` por padrao de produto.
4. Configurao de timezone centralizada em variavel de ambiente (`VITE_APP_TIMEZONE`).
