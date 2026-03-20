# Regras Base do MVP

## 1) Criacao do primeiro usuario admin

Estrategia inicial:

1. Criar o primeiro usuario no Supabase Auth com email/senha controlados por segredo operacional.
2. Inserir a role `admin` em `user_roles` para esse `user_id`.
3. Registrar em log/auditoria a criacao do admin inicial.
4. Tratar esta rotina como one-time bootstrap.

Observacao:
- O bootstrap nao depende de integracao com sistemas externos.

## 2) Status de curso no MVP

Status oficiais:

1. `draft`: em edicao, nao visivel para alunos.
2. `published`: publicado e elegivel para liberacao.
3. `archived`: inativo, mantido para historico.

## 3) Regra inicial de conclusao de aula no MVP

Regra:

1. Aula obrigatoria e marcada como concluida por acao explicita do aluno.
2. Em aula de video, a marcacao so fica disponivel apos atingir tempo minimo configurado.
3. Valor inicial recomendado de tempo minimo: 70% do tempo estimado.

## 4) Estrategia de timezone

Padrao unico:

1. Banco: timestamps sempre em UTC.
2. Filtros por periodo: converter janela informada para UTC antes da consulta.
3. Exibicao no frontend: `America/Sao_Paulo` por padrao de produto.
4. Configuracao de timezone centralizada em variavel de ambiente (`VITE_APP_TIMEZONE`).
