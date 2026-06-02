# Extensao - Cadastro de Alunos no Admin

## Objetivo

Permitir cria??o de usurios do tipo `student` pelo painel admin, sem expor credenciais sensiveis no frontend.

## Fluxo

1. Admin autenticado acessa `/admin/alunos`.
2. Frontend envia `POST /api/admin/students` com `Authorization: Bearer <access_token>`.
3. Endpoint server-side valida:
   - token v?lido no Supabase Auth;
   - role `admin` em `user_roles`.
4. Endpoint cria usurio no Auth (`email_confirm = true`).
5. Endpoint garante role `student` em `user_roles`.
6. Endpoint retorna sucesso e senha temporaria (quando gerada automticamente).

## Seguranca

- Chave de servico usada apenas no endpoint server-side.
- Variavel obrigatria: `SUPABASE_SERVICE_ROLE_KEY`.
- Frontend continua usando apenas `VITE_SUPABASE_ANON_KEY`.

