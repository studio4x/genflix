# Plano de execução por fases da GenFlix

Este documento controla a sequência combinada para execução das fases restantes da GenFlix. Sempre que uma fase alterar a estrutura de cursos, checkout, pagamentos, criadores ou repasses, a documentação principal em `docs/architecture/course-module-spec.md` também deve ser atualizada.

## Regra de condução

Ao concluir cada fase, o fechamento deve informar:

- fase executada;
- principais entregas;
- validações realizadas;
- build gerado;
- próxima fase planejada;
- pergunta explícita se devemos iniciar a próxima fase.

## Fase 1 - Gateway Asaas, checkout e matrícula automática

**Status atual:** parcialmente implementada.

**Já existe:**

- API de criação de checkout Asaas em `api/checkout/asaas/start.ts`;
- webhook Asaas em `api/webhooks/asaas.ts`;
- tabela `payment_gateway_settings`;
- tabela `commerce_checkout_sessions`;
- tabela `commerce_events`;
- liberação automática do curso após pagamento confirmado;
- página admin de pagamentos com ambiente, webhook e eventos recentes.

**Falta concluir:**

- validar fluxo real em sandbox com credenciais Asaas;
- melhorar mensagens de erro do checkout público;
- registrar claramente eventos suportados do webhook;
- garantir idempotência e rastreabilidade operacional para pagamento, cancelamento, expiração e estorno;
- atualizar a spec de cursos/pagamentos se houver mudança no contrato.

## Fase 2 - Página admin de pagamentos e operação comercial

**Status atual:** base implementada.

**Já existe:**

- tela `/admin/pagamentos`;
- alternância sandbox/produção;
- URL de webhook para copiar;
- checklist de variáveis;
- listagem de checkouts e eventos recentes.

**Falta concluir:**

- exibir indicadores resumidos de operação;
- adicionar diagnóstico de configuração ausente;
- melhorar leitura de status;
- opcionalmente adicionar botão de teste controlado para verificar variáveis e conectividade do gateway.

## Fase 3 - Criador, dashboard e perfil

**Status atual:** parcialmente implementada.

**Já existe:**

- role `criador`;
- rotas protegidas `/criador/relatorios`, `/criador/perfil` e `/criador/mensagens`;
- layout próprio do criador;
- edição de perfil e senha;
- cadastro de dados PIX;
- relatório básico de vendas, cancelamentos e comissões.

**Falta concluir:**

- melhorar dashboard executivo do criador;
- adicionar filtros por curso e período;
- exibir cursos vinculados;
- melhorar estados vazios e mensagens operacionais.

## Fase 4 - Comissões e repasses PIX

**Status atual:** parcialmente implementada.

**Já existe:**

- tabela `creator_profiles`;
- tabela `creator_commissions`;
- tabela `creator_commission_payouts`;
- função `create_creator_commission_for_checkout`;
- função `cancel_creator_commission_for_checkout`;
- comissão com elegibilidade em até 30 dias após a venda.

**Falta concluir:**

- tela admin para gerir comissões;
- tela admin para registrar repasse pago;
- lote de repasses;
- histórico operacional por criador;
- regra visual para comissão cancelada por estorno.

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

