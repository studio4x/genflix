# Auditoria de Vulnerabilidades de Segurança - Genflix

Data: 2026-05-29  
Escopo: Frontend (`src/`), APIs (`api/`), Edge Functions (`supabase/functions/`), configuração de deploy e dependências.

## Regra obrigatória para próximas correções

Ao corrigir qualquer vulnerabilidade listada neste documento, a plataforma **deverá continuar funcionando perfeitamente**, sem regressões de UX, checkout, autenticação, conteúdo, área do aluno, área administrativa e integrações operacionais.

## Vulnerabilidades identificadas

### [OK] 1) Stored XSS na descrição de curso (aluno)
- Severidade: **Crítica**
- Evidência:
  - `src/pages/student/student-course-details-page.tsx` renderiza HTML sem sanitização via `dangerouslySetInnerHTML` em `course.description`.
- Impacto:
  - Execução de JavaScript arbitrário no navegador do aluno/admin que abrir a página do curso.
  - Possível roubo de sessão/token, ações indevidas e movimentação lateral.
- Recomendação:
  - Sanitizar HTML no backend e no frontend com whitelist estrita.
  - Bloquear atributos/event handlers perigosos (`on*`), `javascript:`, `data:` inseguros e tags perigosas.

### [OK] 2) Possível IDOR/abuso no checkout por `buyerUserId` sem sessão
- Severidade: **Crítica**
- Evidência:
  - `api/checkout/asaas/start.ts` aceita `buyerUserId` e, na ausência de `Authorization`, usa `auth.admin.getUserById(buyerUserId)` para seguir fluxo.
- Impacto:
  - Um atacante com UUID válido pode iniciar checkout e atualizar dados de perfil de outro usuário (`profiles upsert`), além de potencialmente gerar liberações indevidas em cenários gratuitos.
- Recomendação:
  - Exigir sessão autenticada obrigatória e vincular `buyerUserId` ao usuário autenticado.
  - Remover caminho alternativo sem token ou restringir estritamente a contexto admin interno.

### [OK] 3) Host Header / Origin poisoning em links sensíveis
- Severidade: **Alta**
- Evidência:
  - `api/auth/password-reset.ts` usa `origin`/`x-forwarded-host`/`host` para montar `redirectTo`.
  - `api/_shared/asaas.ts` (`getRequestOrigin`) é usado por `api/checkout/asaas/start.ts` para `successUrl/cancelUrl/expiredUrl`.
- Impacto:
  - Geração de links de recuperação/retorno apontando para domínio controlado por atacante (phishing e captura de token/fluxo).
- Recomendação:
  - Usar apenas `APP_PUBLIC_URL` canônica em produção para montar URLs sensíveis.
  - Ignorar headers de origem para links de segurança.

### [ ] 4) Endpoint público de formulários sem rate limit/anti-bot
- Severidade: **Alta**
- Evidência:
  - `api/public/forms.ts` é público (`POST`) e não aplica rate limiting, CAPTCHA, challenge, nem proteção por IP/fingerprint.
- Impacto:
  - Spam em massa, abuso de envio de e-mails/notificações e possível degradação de custo/disponibilidade.
- Recomendação:
  - Implementar rate limit por IP e por assinatura de payload.
  - Adicionar proteção anti-bot (CAPTCHA/honeypot/tempo mínimo).
  - Criar circuit-breaker para notificações.

### [ ] 5) Endpoint de recuperação de senha sem limitação de frequência
- Severidade: **Média**
- Evidência:
  - `api/auth/password-reset.ts` não possui rate limiting nem cooldown por IP/e-mail.
- Impacto:
  - Flood de tentativas de envio de e-mail, abuso operacional e aumento de custo.
- Recomendação:
  - Rate limit por IP/e-mail e janela temporal.
  - Backoff progressivo e telemetria de abuso.

### [ ] 6) CORS permissivo (`*`) em funções administrativas
- Severidade: **Média**
- Evidência:
  - Exemplo: `supabase/functions/admin-clear-cache/index.ts` com `Access-Control-Allow-Origin: *`.
  - Padrão semelhante em outras funções (`admin-r2-usage`, `admin-storage-upload`, etc).
- Impacto:
  - Amplia superfície de abuso para chamadas cross-origin (especialmente quando combinado a token comprometido).
- Recomendação:
  - Restringir `Access-Control-Allow-Origin` ao domínio canônico de produção e ambientes permitidos.
  - Avaliar necessidade real de CORS para cada função.

### [ ] 7) Ausência de headers de hardening HTTP em produção
- Severidade: **Média**
- Evidência:
  - `vercel.json` define essencialmente cache headers, sem CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy.
- Impacto:
  - Menor proteção contra XSS refletido/inyectado, clickjacking e sniffing de conteúdo.
- Recomendação:
  - Implementar política de headers de segurança por rota.
  - Definir CSP compatível com a aplicação (incluindo scripts de terceiros controlados).

### [ ] 8) Vulnerabilidades conhecidas em dependências (supply chain)
- Severidade: **Alta** (há ao menos 1 alta)
- Evidência:
  - `npm.cmd audit --json` retornou:
    - Total: 8 vulnerabilidades (1 alta, 7 moderadas).
    - Pacotes afetados incluem `fast-uri` (alta), `postcss`, `hono`, `qs`, `ws`, entre outros.
- Impacto:
  - Risco de exploração indireta dependendo do caminho de execução e contexto.
- Recomendação:
  - Atualizar dependências vulneráveis e revalidar build/testes.
  - Priorizar correções com severidade alta e pacotes em runtime de produção.

## Observações finais

- Esta entrega é **somente auditoria**, sem aplicação de correções.
- Próxima etapa recomendada: tratar as vulnerabilidades por ordem de severidade (Crítica -> Alta -> Média), com plano de teste de regressão funcional após cada correção.
