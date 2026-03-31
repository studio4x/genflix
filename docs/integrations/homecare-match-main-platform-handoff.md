# Handoff Técnico: Integração HomeCare Match Principal → LMS

Este documento foi preparado para a IA que vai implementar a integração no repositório principal da HomeCare Match.

Objetivo:
- a HomeCare Match continua responsável por compra, inscrição gratuita, plano ativo e certificado;
- o LMS continua responsável por consumo do curso, progresso e avaliação;
- a integração deve ocorrer por backend seguro, sem acoplamento de banco e sem SSO completo.

## 1. Visão Geral

Fluxo esperado:
- compra ou inscrição gratuita acontece na HomeCare Match;
- a HomeCare Match sincroniza usuário e liberação com o LMS;
- ao clicar em `Acessar curso`, a HomeCare Match gera um token curto assinado e envia o usuário para o LMS;
- o LMS valida o token, cria ou reaproveita a sessão local e leva direto para o curso;
- o LMS devolve para a HomeCare Match os eventos de:
  - progresso atualizado
  - curso concluído
  - aprovação ou reprovação final

## 2. Base URL do LMS

Produção:
- `https://cursos.homecarematch.com.br`

Supabase do LMS:
- `https://bhiklstwayhkuujdrliu.supabase.co`

## 3. Endpoints que a HomeCare Match deve consumir no LMS

### 3.1. Sincronizar usuário + liberação

Endpoint:
- `POST https://cursos.homecarematch.com.br/api/integrations/hcm/releases/upsert`

Uso:
- quando houver compra;
- quando houver inscrição gratuita;
- quando precisar renovar ou atualizar vigência de acesso.

Headers obrigatórios:
- `Content-Type: application/json`
- `X-HCM-Timestamp: <ISO8601 UTC>`
- `X-HCM-Signature: <hex_hmac_sha256>`
- `X-Request-Id: <idempotency_id>`

Payload:

```json
{
  "request_id": "req_123",
  "source_system": "homecare_match",
  "release_source": "purchase",
  "external_reference_id": "order_987",
  "user": {
    "external_user_id": "usr_123",
    "email": "profissional@email.com",
    "full_name": "Nome do Profissional"
  },
  "course": {
    "external_course_id": "curso_homecare_abc"
  },
  "access": {
    "status": "active",
    "starts_at": "2026-03-31T00:00:00Z",
    "ends_at": null,
    "revoked_reason": null
  }
}
```

Valores aceitos:
- `release_source`:
  - `purchase`
  - `free_enrollment`
  - `integration`
- `access.status`:
  - `active`
  - `revoked`
  - `expired`
  - `pending`

### 3.2. Revogar acesso

Endpoint:
- `POST https://cursos.homecarematch.com.br/api/integrations/hcm/releases/revoke`

Uso:
- quando o plano ficar inativo;
- quando o vínculo do usuário com o curso for cancelado;
- quando for necessário bloquear o acesso por regra da plataforma principal.

Headers:
- mesmos da operação de `upsert`

Payload:

```json
{
  "request_id": "req_124",
  "source_system": "homecare_match",
  "external_reference_id": "subscription_321",
  "user": {
    "external_user_id": "usr_123"
  },
  "course": {
    "external_course_id": "curso_homecare_abc"
  },
  "reason": "plan_inactive"
}
```

## 4. Acesso Direto Ao Curso

Quando o usuário clicar em `Acessar curso` na HomeCare Match:
- a HomeCare Match deve gerar um JWT curto;
- redirecionar o browser para:

```text
https://cursos.homecarematch.com.br/auth/hcm-access?token=<JWT>
```

O usuário não deve ser enviado para a dashboard do LMS.

## 5. Estrutura Do Token De Acesso

Algoritmo atual esperado no LMS:
- `HS256`

Claims mínimas:

```json
{
  "iss": "homecarematch",
  "aud": "homecarematch-lms",
  "sub": "usr_123",
  "email": "profissional@email.com",
  "source_system": "homecare_match",
  "external_user_id": "usr_123",
  "external_course_id": "curso_homecare_abc",
  "external_reference_id": "order_987",
  "target": "course",
  "redirect_path": "/aluno/cursos/ID_INTERNO_OPCIONAL",
  "jti": "uuid-unico",
  "iat": 1711900000,
  "exp": 1711900060
}
```

Regras:
- `exp` deve ter validade curta:
  - recomendado: `60` a `120` segundos;
- `jti` deve ser único por clique;
- `redirect_path` é opcional;
- a HomeCare Match não deve assumir que o LMS vai confiar no `redirect_path`;
- o LMS sempre valida o curso real pelo `external_course_id`.

## 6. Assinatura Das Requisições Inbound HCM → LMS

Todas as chamadas da HCM para os endpoints privados do LMS devem ser assinadas.

Formato:
- string assinada:

```text
<timestamp>.<stable_json_body>
```

- assinatura:

```text
hex(HMAC_SHA256(string_assinada, HCM_INBOUND_HMAC_SECRET))
```

`stable_json_body`:
- serializar o JSON com ordenação estável de chaves;
- não usar serialização arbitrária se o backend puder mudar a ordem das chaves.

Janela máxima:
- 5 minutos entre `X-HCM-Timestamp` e o horário do servidor.

## 7. Webhook Que A HomeCare Match Deve Expor

A plataforma principal precisa ter um endpoint privado para receber eventos do LMS.

Exemplo sugerido:
- `POST https://homecarematch.com.br/api/integrations/lms/events`

Esse endpoint será configurado no LMS como:
- `hcm_events_webhook_url`

Headers recebidos:
- `Content-Type: application/json`
- `X-HCM-Timestamp`
- `X-HCM-Signature`
- `X-Request-Id`

Assinatura recebida:

```text
hex(HMAC_SHA256(timestamp + "." + raw_body, hcm_outbound_signing_secret))
```

A HomeCare Match deve validar:
- timestamp;
- assinatura;
- idempotência por `event_id` ou `X-Request-Id`.

## 8. Eventos Que O LMS Enviará Para A HomeCare Match

### 8.1. Progresso atualizado

`event_type`:
- `course.progress.updated`

### 8.2. Curso concluído

`event_type`:
- `course.completed`

### 8.3. Aprovação ou reprovação final

`event_type`:
- `course.approval.updated`

Payload recebido:

```json
{
  "event_id": "uuid",
  "source_system": "homecare_match_lms",
  "event_type": "course.progress.updated",
  "occurred_at": "2026-03-31T20:00:00Z",
  "user": {
    "external_user_id": "usr_123"
  },
  "course": {
    "external_course_id": "curso_homecare_abc"
  },
  "data": {
    "progress_percent": 72,
    "is_completed": false,
    "approval_status": "pending",
    "completed_at": null,
    "last_activity_at": "2026-03-31T20:00:00Z"
  },
  "metadata": {}
}
```

Valores possíveis de `approval_status`:
- `pending`
- `approved`
- `rejected`
- `not_applicable`

## 9. Segredos E Configurações Necessárias

### 9.1. Segredos compartilhados entre HomeCare Match e LMS

A HomeCare Match precisa gerar e armazenar com segurança:

- `HCM_INBOUND_HMAC_SECRET`
  - usado para assinar `upsert` e `revoke`
  - a mesma chave deve ser conhecida pelo LMS

- `HCM_ACCESS_TOKEN_SECRET`
  - usado para assinar o JWT de acesso direto ao curso
  - a mesma chave deve ser conhecida pelo LMS

- `hcm_outbound_signing_secret`
  - usado pelo LMS para assinar o webhook enviado para a HomeCare Match
  - a mesma chave deve ser conhecida pela HomeCare Match para validar os eventos

### 9.2. Configurações que a HomeCare Match precisa conhecer

- `LMS_BASE_URL=https://cursos.homecarematch.com.br`
- `LMS_HCM_RELEASE_UPSERT_URL=https://cursos.homecarematch.com.br/api/integrations/hcm/releases/upsert`
- `LMS_HCM_RELEASE_REVOKE_URL=https://cursos.homecarematch.com.br/api/integrations/hcm/releases/revoke`
- `LMS_HCM_ACCESS_URL=https://cursos.homecarematch.com.br/auth/hcm-access`

### 9.3. Geração recomendada dos segredos

Use no backend ou terminal seguro:

```bash
openssl rand -hex 32
```

ou:

```bash
openssl rand -base64 48
```

Recomendação:
- pelo menos `256 bits` de entropia real;
- não reutilizar a mesma chave para mais de uma finalidade.

## 10. Mapeamento Obrigatório De Curso

Cada curso da HomeCare Match precisa ter um identificador externo estável:
- `external_course_id`

Esse valor precisa ser exatamente o mesmo cadastrado no LMS no campo:
- `ID do Curso na HomeCare Match`

Sem esse mapeamento, o LMS não conseguirá liberar nem resolver o acesso.

## 11. O Que Implementar Na Plataforma Principal

### 11.1. Camada de integração LMS

Criar um módulo/backend responsável por:
- montar payloads do LMS;
- assinar requests;
- chamar endpoints de `upsert` e `revoke`;
- gerar o JWT de acesso direto;
- receber e validar o webhook do LMS;
- registrar logs de integração.

### 11.2. Na compra ou inscrição gratuita

Após registrar a operação:
- chamar `releases/upsert`;
- garantir que:
  - usuário tenha `external_user_id`;
  - curso tenha `external_course_id`.

### 11.3. Na perda de acesso

Quando plano ficar inativo:
- chamar `releases/revoke`

### 11.4. No botão `Acessar curso`

Backend da HCM deve:
- montar o JWT;
- devolver a URL final para o frontend abrir.

Exemplo:

```text
https://cursos.homecarematch.com.br/auth/hcm-access?token=<JWT>
```

### 11.5. No recebimento dos eventos do LMS

Persistir no backend principal:
- progresso do curso;
- data de conclusão;
- status de aprovação final.

Isso permitirá:
- exibir progresso na HomeCare Match;
- condicionar certificado;
- condicionar renovação ou regras de negócio.

## 12. Checklist De Implementação Na HomeCare Match

- criar `external_user_id` estável por usuário
- criar `external_course_id` estável por curso
- implementar cliente HTTP de integração com o LMS
- implementar assinatura HMAC inbound
- implementar geração do JWT de acesso direto
- implementar endpoint privado para receber webhook do LMS
- validar assinatura HMAC do webhook
- registrar idempotência de requests e eventos
- registrar logs e erros de integração
- atualizar botão `Acessar curso` para abrir o LMS com token

## 13. Checklist De Teste

### Caso 1. Compra
- comprar curso na HCM
- HCM chama `upsert`
- LMS cria ou sincroniza usuário
- LMS cria liberação ativa

### Caso 2. Inscrição gratuita
- inscrição gratuita na HCM
- HCM chama `upsert`
- LMS libera curso normalmente

### Caso 3. Acesso direto
- usuário clica `Acessar curso`
- HCM gera JWT
- LMS entra direto no curso correto

### Caso 4. Revogação
- plano fica inativo
- HCM chama `revoke`
- LMS passa a negar acesso

### Caso 5. Progresso
- usuário avança no curso no LMS
- HCM recebe `course.progress.updated`

### Caso 6. Conclusão
- usuário conclui o curso
- HCM recebe `course.completed`

### Caso 7. Aprovação final
- usuário aprova ou reprova na avaliação final
- HCM recebe `course.approval.updated`

## 14. Observações Importantes

- não usar frontend da HCM para chamar os endpoints privados diretamente sem backend;
- a assinatura deve ser feita no backend;
- o segredo nunca deve ir para o browser;
- o LMS é independente e não compartilha banco;
- não implementar SSO completo agora;
- o token de acesso direto não substitui a sessão do LMS, ele apenas inicia o acesso autenticado com segurança.

## 15. Resumo Executivo Para A IA Da Plataforma Principal

Implemente no backend da HomeCare Match:
- cliente de integração com LMS
- assinatura HMAC para `upsert` e `revoke`
- geração JWT de acesso direto ao curso
- webhook receiver para eventos do LMS
- persistência de progresso, conclusão e aprovação

Use estes segredos:
- `HCM_INBOUND_HMAC_SECRET`
- `HCM_ACCESS_TOKEN_SECRET`
- `hcm_outbound_signing_secret`

Use estes endpoints do LMS:
- `POST /api/integrations/hcm/releases/upsert`
- `POST /api/integrations/hcm/releases/revoke`
- `GET /auth/hcm-access?token=...`

Implemente idempotência, logs, validação de assinatura e expiração curta dos tokens.
