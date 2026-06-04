# Checklist de Validacao da Plataforma (T106)

Este checklist foi criado para apoiar a validacao funcional da plataforma por setor, m?dulo e funcionalidade.

## Como usar

- Marque `[OK]` quando o item for validado.
- Marque `[NOK]` quando houver falha e registre evidencias (print, erro, rota, horario).
- Marque `[NA]` quando o item n?o se aplicar ao escopo atual do teste.
- Antes de encerrar qualquer ajuste, revise todos os textos exibidos ao usuario para garantir acentuacao correta, ausencia de simbolos quebrados e nenhuma regressao de encoding.
- Nao considere a entrega finalizada sem uma leitura visual final da tela, modal ou documento alterado.

---

## Setor Pblico

### Mdulo Home e Navegacao Publica
- [OK] Home (`/`) carrega sem erro de console.
- [OK] Header, menu e rodape exibem corretamente em desktop e mobile.
- [OK] Links principais do menu pblico redirecionam para as rotas corretas.
- [OK] SEO basico da p?gina inicial (title/description) aparece no HTML final.

### Mdulo Catalogo e Conversao
- [OK] P?gina de cursos (`/cursos`) lista cursos sem falha.
- [OK] Detalhe do curso (`/cursos/:slug`) abre com dados v?lidos.
- [OK] Fluxo de checkout (`/checkout/pagamento/:slug`) abre corretamente.
- [OK] Confirmacao de checkout (`/checkout/confirmacao`) exibe status esperado.

### Mdulo Contedo Pblico
- [OK] Blog (`/blog`) carrega lista de posts.
- [OK] Post individual (`/blog/:slug`) renderiza contedo sem quebrar layout.
- [OK] P?gina de recursos (`/recursos`) carrega cards e blocos esperados.
- [OK] P?gina comunidade (`/comunidade`) carrega sem erros.

### Mdulo Contato e Suporte Pblico
- [OK] P?gina contato (`/contato`) abre e permite envio de formulario.
- [OK] P?gina suporte (`/suporte`) carrega FAQ e canais previstos.
- [OK] P?gina ajuda (`/ajuda`) carrega layout padrao da plataforma.
- [OK] P?gina indique (`/indique-a-genflix`) permite compartilhamento/envio conforme fluxo.
- [OK] P?gina ensine (`/ensine-na-genflix`) carrega formulario esperado.

### Mdulo Autenticacao Publica
- [OK] Login (`/login`) autentica usurio v?lido.
- [OK] Criacao de conta (`/criar-conta`) conclui cadastro v?lido.
- [OK] Recuperacao de senha (`/recuperar-senha`) envia fluxo corretamente.
- [OK] Redefinicao (`/redefinir-senha`) atualiza senha com token v?lido.
- [OK] Callback (`/auth/callback`) finaliza sessao sem erro.

### Mdulo P?ginas Legais
- [OK] Privacidade (`/privacidade`) carrega corretamente.
- [OK] Cookies (`/cookies`) carrega corretamente.
- [OK] Termos (`/termos-de-uso`) carrega corretamente.
- [OK] Politica de reembolso (`/politica-de-reembolso`) carrega corretamente.

---

## Setor Aluno

### Mdulo Dashboard e Area do Aluno
- [OK] Dashboard (`/aluno/dashboard`) carrega com dados do usurio logado.
- [OK] Lista de cursos (`/aluno/cursos`) exibe cursos liberados.
- [OK] Detalhe do curso (`/aluno/cursos/:courseId`) carrega progresso/status.
- [OK] Minha conta (`/aluno/minha-conta`) salva alteracoes basicas.
- [OK] Pagamentos (`/aluno/pagamentos`) mostra hist?rico conforme perfil.

### Mdulo Player de Curso
- [OK] Player (`/aluno/cursos/:courseId/player`) abre sem erro.
- [OK] Aula (`.../aulas/:lessonId`) carrega video/contedo corretamente.
- [OK] Avalia??o (`.../avalia??es/:assessmentId`) inicia e finaliza.
- [OK] Navegacao entre m?dulos/aulas respeita regras configuradas.

### Mdulo Comunicacao e Suporte do Aluno
- [OK] Mensagens (`/aluno/mensagens`) abre e lista conversas.
- [OK] Tickets (`/aluno/suporte`) permite criar e acompanhar chamado.
- [OK] Detalhe do ticket (`/aluno/suporte/:ticketId`) exibe timeline.

---

## Setor Criador

### Mdulo Perfil e Relatorios do Criador
- [OK] Relatorios (`/criador/relatorios`) carregam sem erro.
- [OK] Perfil (`/criador/perfil`) salva alteracoes esperadas.
- [OK] N?otificacoes (`/criador/notificacoes`) lista eventos corretamente.

### Mdulo Comunicacao e Suporte do Criador
- [OK] Mensagens (`/criador/mensagens`) abre e permite interacao.
- [OK] Suporte (`/criador/suporte`) cria e acompanha tickets.

---

## Setor Admin

### Mdulo Visao Geral e Operacao
- [OK] Dashboard (`/admin`) carrega metricas principais.
- [OK] Relatorios (`/admin/relatorios`) carrega indicadores.
- [OK] Pendencias (`/admin/pendencias`) exibe itens operacionais.
- [OK] Storage R2 (`/admin/storage-r2`) carrega uso, custo estimado e navegacao de arquivos.

### Mdulo Catalogo e Cursos
- [OK] Catalogo (`/admin/cursos`) lista cursos e categorias.
- [OK] Mdulos do curso (`/admin/cursos/:courseId/m?dulos`) CRUD funcional.
- [OK] Aulas do m?dulo (`/admin/m?dulos/:moduleId/aulas`) CRUD funcional.
- [OK] Materiais da aula (`/admin/aulas/:lessonId/materiais`) CRUD funcional.
- [OK] Liberacoes (`/admin/cursos/:courseId/liberacoes`) CRUD funcional.

### Mdulo Course Builder
- [OK] Builder principal (`/admin/cursos/:courseId/builder`) abre sem erro.
- [OK] Editor de m?dulo (`.../m?dulos/:moduleId`) salva alteracoes.
- [OK] Editor de aula (`.../aulas/:lessonId`) salva contedo e midias.
- [OK] Materiais no builder (`.../aulas/:lessonId/materiais`) funciona corretamente.
- [OK] Avalia??es (`.../avalia??es/:assessmentId`) salva e publica regras.
- [OK] Public page (`.../public-page`) reflete configura??es no front pblico.
- [OK] Settings (`.../settings`) persiste configura??es do curso.
- [OK] Releases (`.../releases`) aplica regras de acesso esperadas.
- [OK] Assessments final (`.../assessments` e `.../assessments/final`) funciona sem erro.

### Mdulo Contedo e Marketing
- [OK] Blog (`/admin/blog`) CRUD completo.
- [OK] Banners (`/admin/banners`) CRUD e hist?rico/revis?o funcionando.
- [OK] Botoes de aula (`/admin/botoes-aula`) CRUD funcional.
- [OK] Recursos (`/admin/recursos`) CRUD e player pblico corretos.
- [OK] Tipos de quiz (`/admin/tipos-quiz`) CRUD funcional.
- [OK] Editor visual (`/admin/site-editor`) edicao por secao/container habilitada.

### Mdulo Comunidade e Atendimento
- [OK] Usurios (`/admin/usurios`) listagem e acoes principais.
- [OK] Grupos (`/admin/grupos`) CRUD funcional.
- [OK] N?otificacoes (`/admin/notificacoes`) envio/listagem funcional.
- [OK] Mensagens (`/admin/mensagens`) abre e opera sem erro.
- [OK] Tickets (`/admin/suporte`) fluxo completo de atendimento.
- [OK] FAQ (`/admin/faq`) CRUD funcional.
- [OK] Reviews (`/admin/reviews`) modera/lista corretamente.
- [OK] Formularios (`/admin/formularios`) entradas e filtros funcionando.

### Mdulo Financeiro
- [OK] Pagamentos (`/admin/pagamentos`) parametros e logs consistentes.
- [OK] Repasses (`/admin/repasses`) lista e acoes operacionais funcionando.

### Mdulo Configurao da Plataforma
- [OK] Minha conta (`/admin/minha-conta`) atualiza dados corretamente.
- [OK] Configuracoes do site (`/admin/configura??es-site`) persiste alteracoes.

---

## Setor Infraestrutura e Integracoes

### Mdulo Auth e Permissoes
- [OK] Rotas protegidas respeitam perfis (`admin`, `aluno`, `criador`).
- [OK] Sessao expirada redireciona corretamente para login.
- [OK] Rota n?o autorizada usa tela de bloqueio adequada.
- [OK] Usurio sem permiss?o n?o executa acao sensivel via API (bloqueio server-side).
- [OK] Token ausente/inv?lido retorna `401` padronizado nas funcoes administrativas criticas.

### Mdulo Storage e Midia
- [OK] Upload de arquivos protegidos no R2 conclui sem erro.
- [OK] Exclusao de arquivos no R2 remove item e atualiza listagem.
- [OK] Acesso protegido a assets da aula funciona para usurio permitido.
- [OK] Upload com tipo/tamanho inv?lido retorna erro claro e n?o persiste arquivo.
- [NOK] URL assinada expira corretamente e bloqueia acesso apos expiracao.

### Mdulo Edge Functions e APIs
- [OK] Funcoes administrativas respondem com auth valida.
- [OK] CORS das funcoes principais n?o bloqueia frontend em produo.
- [OK] Tratamento de erro retorna mensagem clara para o usurio.
- [NOK] Timeouts em chamadas criticas sao tratados com fallback/retry sem quebrar fluxo.
- [NOK] Endpoints sensiveis mantem idempotencia em reenvio/reprocessamento.
- [NOK] Endpoints expostos possuem protecao basica contra abuso/rate limit.

### Mdulo Deploy e Observabilidade
- [OK] Build version no rodape corresponde ao ultimo deploy.
- [OK] Dominio `genflix-omega.vercel.app` aponta para deploy READY esperado.
- [OK] Logs de console em fluxos criticos sem erros bloqueantes recorrentes.
- [OK] Healthcheck pos-deploy valida home, rota autenticada e uma Edge Function critica.
- [NOK] Janela de 15-30 min pos-release sem pico anomalo de `5xx` e `4xx` criticos.
- [NOK] Procedimento de rollback para ultimo deploy est?vel est? test?do/documentado.

### Mdulo Financeiro e Webhooks
- [NOK] Falha de pagamento (recusa/cancelamento) atualiza status corretamente no painel e no hist?rico.
- [NOK] Webhook com assinatura invalida e rejeitado sem efeitos colaterais.

### Mdulo Qualidade Transversal
- [NOK] Acessibilidade minima: foco por teclado, contraste legivel e `aria-label` em acoes criticas.
- [NOK] Smoke mobile real cobre ao menos login, checkout e player em viewport pequeno.

---

## Registro de Validacao

- Ciclo:
- Ambiente:
- Responsavel:
- Data:
- Resultado geral:
- Riscos/Pendencias:
