# Plano de execução por fases da GenFlix

Este documento controla a sequência combinada para execução das fases restantes da GenFlix. Sempre que uma fase alterar a estrutura de cursos, checkout, pagamentos, criadores ou repasses, a documentação principal em `docs/architecture/course-module-spec.md` também deve ser atualizada.

## Regra de condução

Antes de iniciar qualquer implementação de fase, o agente deve executar uma auditoria prévia da fase:

- verificar código, migrations, rotas, APIs, telas e documentação já existentes;
- classificar a fase como `concluída`, `parcial` ou `não iniciada`;
- se a fase estiver `concluída`, não reimplementar nada e passar para a próxima fase planejada;
- se a fase estiver `parcial`, implementar somente o que ficou pendente;
- se a fase estiver `não iniciada`, implementar a fase conforme o escopo planejado;
- registrar no fechamento o que já existia antes da execução e o que foi efetivamente alterado.

Ao concluir cada fase, o fechamento deve informar:

- fase executada;
- status encontrado na auditoria prévia;
- principais entregas;
- validações realizadas;
- build gerado;
- próxima fase planejada;
- pergunta explícita se devemos iniciar a próxima fase.

## Fase 1 - Gateway Asaas, checkout e matrícula automática

**Status atual:** concluída nesta rodada.

**Já existe:**

- API de criação de checkout Asaas em `api/checkout/asaas/start.ts`;
- webhook Asaas em `api/webhooks/asaas.ts`;
- tabela `payment_gateway_settings`;
- tabela `commerce_checkout_sessions`;
- tabela `commerce_events`;
- liberação automática do curso após pagamento confirmado;
- página admin de pagamentos com ambiente, webhook e eventos recentes.

**Concluído nesta rodada:**

- o formulário público de compra agora envia `buyerName` e `buyerEmail` para o backend;
- o backend usa os dados informados no checkout Asaas e registra esses dados em `commerce_checkout_sessions`;
- mensagens principais do checkout e webhook foram ajustadas com acentuação;
- o webhook passou a reconhecer eventos de checkout e eventos de pagamento (`CHECKOUT_PAID`, `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`);
- o webhook usa chave idempotente determinística quando o Asaas não envia `id` próprio no evento;
- a spec de cursos/pagamentos foi atualizada com o contrato real.

**Pendente operacional fora de código:**

- validar uma compra real em sandbox com credenciais Asaas ativas.

## Fase 2 - Página admin de pagamentos e operação comercial

**Status atual:** concluída nesta rodada.

**Já existe:**

- tela `/admin/pagamentos`;
- alternância sandbox/produção;
- URL de webhook para copiar;
- checklist de variáveis;
- listagem de checkouts e eventos recentes.

**Concluído nesta rodada:**

- indicadores resumidos de checkouts, pagos, ativos, estornos, eventos com falha, receita bruta estimada e último evento;
- diagnóstico seguro de configuração via `GET /api/admin/payments/diagnostics`;
- botão `Verificar` para reexecutar o diagnóstico sem expor segredos;
- leitura visual de status para sessões e eventos recentes;
- checklist operacional atualizado com variáveis, webhook e segredo;
- spec principal de cursos/pagamentos atualizada com a operação admin.

## Fase 3 - Criador, dashboard e perfil

**Status atual:** concluída nesta rodada.

**Já existe:**

- role `criador`;
- rotas protegidas `/criador/relatorios`, `/criador/perfil` e `/criador/mensagens`;
- layout próprio do criador;
- edição de perfil e senha;
- cadastro de dados PIX;
- relatório básico de vendas, cancelamentos e comissões.

**Concluído nesta rodada:**

- dashboard executivo em `/criador/relatorios`;
- filtros por curso e por ciclo de seis meses;
- cards de vendas, receita bruta, cancelamentos e comissões;
- seção de cursos vinculados ao criador com preço, status, comissão e desempenho;
- tabela de semestres por curso com filtro aplicado;
- tabela de comissões filtrada por curso/período;
- estados vazios mais claros;
- revisão de mensagens visíveis do perfil do criador.

## Fase 4 - Comissões e repasses PIX

**Status atual:** concluída nesta rodada.

**Já existe:**

- tabela `creator_profiles`;
- tabela `creator_commissions`;
- tabela `creator_commission_payouts`;
- função `create_creator_commission_for_checkout`;
- função `cancel_creator_commission_for_checkout`;
- comissão com elegibilidade em até 30 dias após a venda.

**Concluído nesta rodada:**

- rota admin `/admin/repasses`;
- menu admin `Repasses PIX`;
- tela admin para listar e filtrar comissões;
- seleção em lote de comissões elegíveis do mesmo criador;
- conferência dos dados PIX antes do pagamento;
- registro de repasse pago via API administrativa;
- histórico recente de repasses;
- regra visual para comissões pagas, pendentes, canceladas e estornadas;
- RPC transacional `register_creator_commission_payout` para criar payout, itens e marcar comissões como pagas.

**Extensão concluída depois da fase:**

- configuração global de repasses em `creator_payout_settings`;
- modo manual ou automático com intervalo em dias e valor mínimo;
- botão admin para `Pagar via Asaas`;
- fallback admin para `Registrar pagamento externo`;
- envio PIX via endpoint Asaas `/v3/transfers`;
- Vercel Cron diário chamando `GET /api/admin/creator-payouts?task=process_due_payouts`;
- painel do criador refletindo política de repasse e histórico de payouts;
- ajuste negativo automático quando venda já repassada é estornada.

## Fase 5 - Ajustes visuais GenFlix

**Status atual:** concluída.

**Já existe:**

- site público restaurado para layout GenFlix;
- paleta azul/verde aplicada em várias áreas;
- build discreto no rodapé;
- ajustes pontuais no painel de pagamentos, usuários e criador.

**Concluído nesta fase:**

- varredura global de marrom/laranja antigo;
- camada visual global para trocar azuis antigos por degradê GenFlix vertical `#1398B7 -> #0A3640`;
- padronização global de botões, estados de foco e bordas para a nova paleta;
- redução agressiva de cantos arredondados para um raio curto, próximo ao padrão do Figma;
- revisão global de sombras para projeções mais contidas;
- regra de contraste para textos brancos sobre fundos escuros/degradês.

## Fase 6 - Admin usuários, roles e gestão de acessos

**Status atual:** concluída.

**Já existe:**

- criação de usuário com seleção de role;
- edição de role;
- exclusão de usuário;
- redefinição de senha por e-mail;
- roles `admin`, `aluno` e `criador`;
- compatibilidade com `student` e `professor` legado.

**Concluído nesta fase:**

- refino visual da tela `/admin/usuarios`, com cadastro opcional para reduzir espaço vazio acima da tabela;
- revisão de mensagens do fluxo administrativo de usuários com acentuação;
- troca do atalho antigo de `Alunos` para `Usuários` no dashboard admin;
- manutenção de `/admin/alunos` apenas como redirecionamento para `/admin/usuarios`;
- remoção dos arquivos legados de alunos do admin que não estavam mais em uso.

## Fase 7 - Sistema de notificações

**Status atual:** concluída.

**Já existe:**

- migrations do sistema de notificações;
- central de notificações;
- página admin de notificações;
- integração visual nos layouts admin, aluno e criador.

**Concluído nesta fase:**

- página compartilhada de preferências de notificação para admin, aluno e criador;
- leitura e gravação real em `notification_preferences`;
- controle por usuário dos canais `in-app`, `email`, `push` e `whatsapp`;
- configuração de resumo por e-mail e janela de silêncio;
- atalhos de navegação nos três painéis;
- validação de integração com a central de notificações e com as automações já existentes de mensagens.

**Observação operacional:**

- canais externos continuam preparados em fila, mas envio real por provedores externos deve ser tratado em fase própria de integrações quando as credenciais definitivas forem escolhidas.

## Fase 8 - Mensagens em tempo real

**Status atual:** concluída nesta rodada.

**Já existe:**

- migrations de conversas/mensagens;
- tela compartilhada de mensagens;
- rotas para admin, aluno e criador.

**Concluído agora:**

- atualização em realtime da conversa aberta e da lista de conversas;
- ação de denunciar mensagem no chat;
- fila simples de moderação em `/admin/mensagens`;
- resolução de denúncias por admin;
- notificações in-app já integradas ao envio de mensagens;
- anexos ficam registrados como escopo futuro, pois a v1 operacional usa mensagens de texto.

## Fase 9 - Reviews nos cursos

**Status atual:** concluída nesta rodada.

**Já existe:**

- tabelas de reviews;
- estatísticas de avaliação;
- envio de avaliação pública;
- votos úteis;
- seção de reviews na página pública do curso.

**Concluído agora:**

- painel admin `/admin/reviews` para moderação de reviews de cursos;
- filtros por status, nota e busca textual;
- ações de aprovação e rejeição com motivo;
- notificação in-app para admins quando uma review entra em moderação;
- notificação in-app para aluno quando a review é aprovada ou rejeitada;
- regra final de elegibilidade: apenas alunos com acesso ativo ao curso podem avaliar;
- auto-moderação básica para spam, excesso de links, caixa alta e caracteres repetidos.

## Fase 10 - Limpeza HomeCare/HCM residual

**Status atual:** concluída nesta rodada.

**Auditoria prévia:** fase parcial.

**Já existia:**

- menus principais e rotas públicas/admin da GenFlix sem exposição direta da integração antiga;
- core LMS independente usando `course_releases`;
- checkout Asaas usando os metadados genéricos de origem/liberação do curso.

**Concluído nesta rodada:**

- remover APIs legadas `api/integrations/hcm/*`;
- remover Edge Function local `hcm-outbox-dispatch`;
- remover telas e APIs administrativas legadas de integrações;
- remover consultas ativas a `external_course_mappings`;
- trocar prefixos visíveis `HCM-` em licenças/PDF por prefixo GenFlix;
- criar e aplicar migration de cleanup para tabelas, triggers, funções e cron específicos da integração antiga;
- confirmar que a função remota `hcm-outbox-dispatch` não existe mais no projeto Supabase da GenFlix.

## Pendências operacionais assumidas para as próximas fases

- Asaas produção ainda não está configurado. A Fase 12 deverá concluir a estrutura e validação em sandbox, mantendo produção como pendência operacional até a conta/credenciais definitivas estarem prontas.
- SMTP/domínio final ainda não está contratado/configurado. A Fase 13 deverá concluir a estrutura técnica de fila/templates/processamento, mantendo o envio real em produção como pendência operacional até a contratação/configuração final.

## Fase 11 - Hardening de dependências e npm audit

**Status atual:** concluída nesta rodada.

**Auditoria prévia:** fase parcial.

**Já existia:**

- `package-lock.json` com dependências recentes em boa parte do stack;
- componente local de editor rico em `src/components/forms/react-quill.tsx`, sem dependência runtime obrigatória do pacote externo `react-quill`.

**Concluído nesta rodada:**

- `npm audit --audit-level=moderate` saiu de 11 vulnerabilidades para 0 vulnerabilidades;
- atualização segura via `npm audit fix`, sem `--force`;
- remoção de `react-quill` e, por consequência, do `quill` vulnerável;
- remoção de declarações legadas de tipos para `react-quill` e `quill-better-table`;
- atualização transitiva de pacotes vulneráveis como `vite`, `dompurify`, `hono`, `@hono/node-server`, `path-to-regexp`, `picomatch`, `yaml` e `brace-expansion`;
- correção de warning local no editor rico.

## Fase 12 - Validação operacional Asaas sandbox/produção

**Status atual:** concluída tecnicamente nesta rodada.

**Auditoria prévia:** fase parcial.

**Já existia:**

- checkout hospedado Asaas em `POST /api/checkout/asaas/start`;
- webhook Asaas em `POST /api/webhooks/asaas`;
- página `/admin/pagamentos` com ambiente, webhook, checklist, eventos e sessões recentes;
- migrations remotas de pagamento, comissões e repasses aplicadas no Supabase da GenFlix;
- cron Vercel para processar repasses de criadores via Asaas.

**Concluído nesta rodada:**

- confirmação de que o Supabase remoto (`axhlkilkqolvfecyhhxx`) está com todas as migrations locais aplicadas;
- confirmação de que o ambiente Vercel atual ainda não possui variáveis `ASAAS_*`, mantendo a validação real de compra/PIX como pendência operacional;
- melhoria do diagnóstico administrativo para validar separadamente token ativo, token sandbox, token produção, segredo do webhook e URL pública;
- documentação atualizada em `course-module-spec.md` com o estado operacional do Asaas.

**Pendente operacional fora de código:**

- configurar `ASAAS_ACCESS_TOKEN_SANDBOX` para validar uma compra e um repasse de teste;
- configurar `ASAAS_ACCESS_TOKEN_PRODUCTION` apenas quando a conta Asaas final estiver aprovada;
- cadastrar o webhook no painel Asaas apontando para `/api/webhooks/asaas`;
- se desejado, configurar `ASAAS_WEBHOOK_SECRET` no Asaas e na Vercel.

## Preparação para Fase 13 - Pendências operacionais no admin

**Status atual:** concluída nesta rodada.

Antes de iniciar o envio externo real de notificações por e-mail, foi criada uma página administrativa para centralizar dependências externas que ainda bloqueiam funcionalidades prontas ou parcialmente prontas.

Rota:

```text
/admin/pendencias
```

Itens iniciais monitorados:

- envio externo de e-mails, dependente de SMTP e domínio final;
- Asaas em produção, dependente da conta Asaas final e do token de produção;
- validação Asaas sandbox, dependente de token sandbox e webhook de teste;
- domínio final GenFlix, dependente de DNS e `APP_PUBLIC_URL`.

Essa página deve ser atualizada sempre que uma nova funcionalidade ficar pendente por falta de credencial, DNS, token, conta externa, contrato ou informação operacional ainda não fornecida.

## Pendência transversal - Hardening de dependências

O `npm audit --audit-level=moderate` foi zerado na Fase 11. A partir daqui, novas vulnerabilidades devem ser tratadas como manutenção contínua antes de cada publicação relevante.
