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

## Fase 5 - Ajustes visuais GenFlix

**Status atual:** em andamento.

**Já existe:**

- site público restaurado para layout GenFlix;
- paleta azul/verde aplicada em várias áreas;
- build discreto no rodapé;
- ajustes pontuais no painel de pagamentos, usuários e criador.

**Falta concluir:**

- varredura global de marrom/laranja antigo;
- padronização de botões conforme Figma;
- redução de cantos arredondados onde ainda estiver exagerado;
- revisão de sombras;
- garantir texto branco sobre fundos escuros/degradês.

## Fase 6 - Admin usuários, roles e gestão de acessos

**Status atual:** praticamente implementada.

**Já existe:**

- criação de usuário com seleção de role;
- edição de role;
- exclusão de usuário;
- redefinição de senha por e-mail;
- roles `admin`, `aluno` e `criador`;
- compatibilidade com `student` e `professor` legado.

**Falta concluir:**

- refino visual final da tabela;
- revisão de mensagens sem acentuação;
- avaliar remoção definitiva de telas/APIs antigas de aluno se ainda não forem usadas.

## Fase 7 - Sistema de notificações

**Status atual:** fundação implementada.

**Já existe:**

- migrations do sistema de notificações;
- central de notificações;
- página admin de notificações;
- integração visual nos layouts admin, aluno e criador.

**Falta concluir:**

- validar preferências por usuário;
- aprofundar canais externos, se necessário;
- criar automações adicionais para eventos comerciais, reviews e mensagens.

## Fase 8 - Mensagens em tempo real

**Status atual:** fundação implementada.

**Já existe:**

- migrations de conversas/mensagens;
- tela compartilhada de mensagens;
- rotas para admin, aluno e criador.

**Falta concluir:**

- validar realtime ponta a ponta;
- lapidar experiência de conversa;
- avaliar anexos, denúncia/moderação e notificações por mensagem.

## Fase 9 - Reviews nos cursos

**Status atual:** fundação implementada.

**Já existe:**

- tabelas de reviews;
- estatísticas de avaliação;
- envio de avaliação pública;
- votos úteis;
- seção de reviews na página pública do curso.

**Falta concluir:**

- painel admin completo de moderação;
- filtros e ações de aprovação/rejeição;
- notificações ligadas a reviews;
- regras finais de elegibilidade para avaliação.

## Pendência transversal - Hardening de dependências

O `npm audit --audit-level=moderate` ainda acusa vulnerabilidades moderadas e altas. Esta pendência deve virar uma fase técnica própria antes de considerar a plataforma pronta para operação comercial estável.

Pontos principais observados:

- `vite`;
- `lodash`;
- `picomatch`;
- `hono` e `@hono/node-server`;
- `dompurify`;
- `quill/react-quill`;
- `path-to-regexp`;
- `yaml`;
- `brace-expansion`.
