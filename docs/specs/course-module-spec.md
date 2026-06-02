# SPEC: Mdulo de Cursos, Builder LMS, Player do Aluno e Venda

## 1. Objetivo do Documento

Este documento descreve, em nivel de produto e arquitetura, a estrutura atual do m?dulo de cursos da GenFlix. Ele foi escrito para ser reutilizado como referencia em outra plataforma, portanto cobre n?o apenas "m?dulos e aulas", mas a operacao completa de cursos:

- area publica de catalogo e venda;
- painel admin de cursos;
- alunos adicionados, liberacoes e controle de acesso;
- configura??es comerciais e pedagogicas do curso;
- construtor LMS completo;
- m?dulos, aulas, blocos interativos, materiais e PDFs;
- quizzes e avalia??es;
- player em tela cheia do aluno;
- compra, checkout, webhook, pagamento e libera??o automtica;
- comissao de criadores.

A regra principal da implementacao e: curso e ao mesmo tempo um produto comercial, uma trilha pedagogica e uma unidade de acesso. Por isso, o mesmo objeto `course` precisa alimentar o catalogo pblico, o checkout, o painel admin, o builder e o player do aluno.

## 2. Visao Geral da Jornada

### 2.1 Jornada do admin

O admin gerencia cursos em tres camadas:

1. Lista de cursos no painel admin.
2. Configuracoes gerais do curso, alunos/liberacoes e dados comerciais.
3. Construtor do curso, com estrutura real de LMS.

Fluxo esperado:

```text
/admin/cursos
  -> criar curso ou editar curso existente
  -> abrir construtor do curso

/admin/cursos/:courseId/builder
  -> visao geral
  -> configura??es do curso
  -> alunos adicionados/liberacoes
  -> avalia??es
  -> m?dulos
  -> aulas
  -> quizzes de m?dulo
  -> avalia??o final
```

### 2.2 Jornada do aluno

O aluno passa por duas experiencias:

1. Area do aluno, com lista de cursos liberados.
2. Player LMS em tela cheia, com navegacao por m?dulos, aulas e avalia??es.

Fluxo esperado:

```text
/aluno
  -> dashboard
  -> meus cursos
  -> detalhes do curso
  -> player em tela cheia

/aluno/cursos/:courseId/player
  -> aula
  -> quiz de m?dulo
  -> avalia??o final
```

### 2.3 Jornada de compra

O curso pblico pode ser gratuito ou pago.

```text
/cursos
  -> catalogo pblico

/cursos/:slug
  -> p?gina de venda
  -> CTA de compra
  -> checkout Asaas
  -> webhook confirma pagamento
  -> libera curso ao aluno
  -> aluno acessa /aluno/cursos/:courseId
```

## 3. Mapa de Rotas

### 3.1 Rotas publicas

```text
/                         Home publica
/cursos                   Catalogo pblico de cursos
/cursos/:slug             P?gina publica de venda do curso
/blog                     Blog pblico
/recursos                 P?gina publica de recursos
/sobre                    P?gina institucional
/login                    Login
/criar-conta              Cadastro
/recuperar-senha          Solicitar redefinicao de senha
/redefinir-senha          Modal de nova senha apos link de recovery
```

### 3.2 Rotas do aluno

```text
/aluno
/aluno/dashboard
/aluno/cursos
/aluno/cursos/:courseId
/aluno/cursos/:courseId/player
/aluno/cursos/:courseId/player/aulas/:lessonId
/aluno/cursos/:courseId/player/avalia??es/:assessmentId
/aluno/mensagens
```

### 3.3 Rotas administrativas de curso

```text
/admin/cursos
/admin/cursos/:courseId/builder
/admin/cursos/:courseId/builder/settings
/admin/cursos/:courseId/builder/releases
/admin/cursos/:courseId/builder/assessments
/admin/cursos/:courseId/builder/assessments/final
/admin/cursos/:courseId/builder/m?dulos/:moduleId
/admin/cursos/:courseId/builder/m?dulos/:moduleId/aulas/:lessonId
/admin/cursos/:courseId/builder/m?dulos/:moduleId/aulas/:lessonId/materiais
/admin/cursos/:courseId/builder/m?dulos/:moduleId/avalia??es/:assessmentId
/admin/cursos/:courseId/builder/m?dulos/:moduleId/avalia??es/nova
```

### 3.4 Rotas administrativas relacionadas

```text
/admin/usurios
/admin/pagamentos
/admin/tipos-de-quiz
/admin/mensagens
/admin/minha-conta
```

### 3.5 APIs comerciais

```text
POST /api/checkout/asaas/start
POST /api/webhooks/asaas
```

## 4. Modelo Central do Curso

### 4.1 Course

O curso concentra dados academicos, comerciais, pblicos e operacionais.

Campos principais:

- `id`: identificador interno UUID.
- `title`: nome do curso.
- `description`: descri??o rica, usada no admin e na p?gina publica.
- `status`: `draft`, `published` ou `archived`.
- `display_order`: ordem manual de exibi??o.
- `thumbnail_url`: imagem de capa.
- `slug`: URL publica amigavel.
- `launch_date`: data de lancamento, usada tamb?m em relatorios por semestre.
- `price_cents`: preco em centavos.
- `currency`: moeda, atualmente `BRL`.
- `is_public`: controla exibi??o no catalogo pblico.
- `creator_id`: usurio criador vinculado ao curso.
- `creator_commission_percent`: percentual de comissao do criador.
- `workload_minutes`: carga horaria calculada/estimada.
- `has_linear_progression`: ativa progressao sequencial.
- `quiz_type_settings`: tipos de quiz habilitados no curso.
- `created_by`: admin criador do curso.
- `created_at` e `updated_at`: auditoria basica.

Regras:

- Curso publicado e pblico aparece no catalogo.
- Curso em rascunho n?o deve ser comprado pelo pblico.
- Curso arquivado fica inativo para operacao normal.
- `price_cents = 0` significa curso gratuito.
- Curso pago precisa passar pelo checkout.
- Curso com `creator_id` e comissao maior que zero gera comissao apos venda confirmada.
- `has_linear_progression` controla bloqueio sequencial no player.
- `quiz_type_settings` limita quais quizzes aparecem no builder.

### 4.2 CourseModule

Mdulo e a primeira camada pedagogica dentro do curso.

Campos principais:

- `id`
- `course_id`
- `title`
- `description`
- `position`
- `is_required`
- `starts_at`
- `ends_at`
- `release_days_after_enrollment`
- `module_pdf_storage_path`
- `module_pdf_file_name`
- `module_pdf_uploaded_at`
- `created_at`
- `updated_at`

Regras:

- Mdulos sao ordenados por `position`.
- Mdulo obrigatrio entra no calculo de conclus?o.
- Mdulo pode ter libera??o imediata, por data absoluta, por expiracao ou por dias apos inscricao.
- Se houver data absoluta e dias apos inscricao, as duas regras sao cumulativas.
- Mdulo fora da janela bloqueia todas as aulas e quizzes do m?dulo.
- PDF base do m?dulo pode ser anexado pelo admin.
- Download do PDF do m?dulo no aluno gera copia licenciada com identificacao individual quando houver PDF base.

### 4.3 Lesson

Aula e a unidade de consumo principal do aluno.

Campos principais:

- `id`
- `module_id`
- `title`
- `description`
- `position`
- `is_required`
- `lesson_type`: `video`, `text` ou `hybrid`
- `youtube_url`
- `text_content`
- `estimated_minutes`
- `starts_at`
- `ends_at`
- `created_at`
- `updated_at`

Regras:

- `video`: aula centrada em YouTube.
- `text`: aula centrada em blocos de contedo.
- `hybrid`: combina video e blocos.
- Aula obrigatria entra na progressao.
- Aula pode ser liberada/expirada por data.
- Aula fora da janela fica bloqueada mesmo quando m?dulo est? liberado.
- O contedo textual e salvo em `text_content`, com blocos serializados.

### 4.4 Assessment

Avalia??o representa quiz de m?dulo ou prova final.

Campos principais:

- `id`
- `course_id`
- `module_id`
- `assessment_type`: `module` ou `final`
- `title`
- `description`
- `is_required`
- `passing_score`
- `max_attempts`
- `estimated_minutes`
- `is_active`
- `created_by`
- `created_at`
- `updated_at`

Regras:

- Avalia??o de m?dulo pertence a um m?dulo.
- Avalia??o final pertence ao curso.
- Avalia??o obrigatria pode bloquear conclus?o.
- Tentativas sao controladas por `max_attempts`.
- Quando tentativas acabam, aluno pode solicitar nova tentativa se o fluxo estiver ativo.

### 4.5 CourseRelease

Libera??o representa o direito de acesso do aluno ao curso.

Campos principais:

- `course_id`
- `release_type`: `user` ou `group`
- `user_id`
- `group_id`
- `starts_at`
- `ends_at`
- `is_active`
- `source_system`
- `release_source`: `purchase`, `free_enrollment`, `admin`, `group` ou `integration`
- `release_status`
- `external_reference_id`
- `managed_by_integration`
- `last_synced_at`
- `revoked_at`
- `revoked_reason`
- `created_by`
- `created_at`

Regras:

- Curso so aparece para o aluno quando existe libera??o ativa valida.
- Libera??o pode ser manual, por grupo, gratuita, compra ou integracao.
- Libera??o por compra e gerenciada por gateway.
- Reembolso, chargeback ou cancelamento podem revogar libera??o gerenciada.

## 5. Painel Admin de Cursos

### 5.1 Tela `/admin/cursos`

Essa tela e o ponto inicial do admin para gerenciar o catalogo academico.

Responsabilidades:

- listar cursos existentes;
- mostrar metricas de total, publicados e rascunhos;
- criar novo curso;
- editar dados basicos do curso;
- abrir construtor LMS;
- importar curso via JSON;
- exportar curso completo;
- organizar ordem de exibi??o com drag and drop;
- excluir curso.

### 5.2 Card/lista de curso

Cada curso deve exibir:

- capa;
- t?tulo;
- status;
- carga horaria;
- preco;
- visibilidade publica;
- ordem;
- acoes administrativas.

Acoes esperadas:

- `Editar`: abre modal de dados basicos do curso.
- `Abrir construtor`: navega para `/admin/cursos/:courseId/builder`.
- `Exportar`: baixa JSON completo do curso.
- `Excluir`: remove o curso apos confirmacao.

### 5.3 Criacao de curso

Ao criar um curso pelo admin:

1. Admin informa t?tulo, capa, status e descri??o.
2. Admin configura vendas e acesso basico.
3. Sistema cria o curso.
4. Admin e levado ao construtor para criar m?dulos, aulas e quizzes.

Campos do modal de cria??o:

- t?tulo;
- imagem de capa;
- status;
- slug pblico;
- data de lancamento;
- valor de venda;
- moeda;
- visibilidade no catalogo;
- descri??o detalhada.

### 5.4 Edicao de curso na lista

O botao de editar na lista altera metadados globais, mas n?o substitui o construtor.

Usos tipicos:

- trocar nome;
- trocar capa;
- publicar/despublicar;
- ajustar preco;
- ajustar slug;
- ajustar descri??o.

Para editar contedo real de LMS, o admin deve abrir o construtor.

## 6. Alunos Adicionados e Liberacoes

### 6.1 Objetivo da tela

A tela de alunos adicionados/liberacoes controla quem pode acessar o curso. Ela e essencial porque a compra tamb?m termina criando uma libera??o.

Rota:

```text
/admin/cursos/:courseId/builder/releases
```

### 6.2 O que a tela deve mostrar

A tela deve listar liberacoes vinculadas ao curso, com:

- aluno ou grupo;
- e-mail do aluno;
- tipo da libera??o;
- origem da libera??o;
- status;
- data de inicio;
- data de expiracao;
- se est? ativa;
- referencia externa quando houver;
- data de sincronizacao;
- acoes.

### 6.3 Tipos de libera??o

Libera??o por usurio:

- concede acesso a um aluno especifico.
- usada para compra, cortesia, suporte e casos administrativos.

Libera??o por grupo:

- concede acesso a todos os membros de um grupo.
- usada para turmas, empresas ou pacotes.

### 6.4 Origens de libera??o

Origens suportadas:

- `admin`: acesso manual criado pelo admin.
- `purchase`: acesso criado por pagamento confirmado.
- `free_enrollment`: acesso criado em curso gratuito.
- `group`: acesso herdado de grupo.
- `integration`: acesso criado por integracao legada ou externa.

### 6.5 Regras de acesso

Uma libera??o valida precisa atender:

- `is_active = true`;
- status ativo;
- data atual maior ou igual a `starts_at`, quando existir;
- data atual menor ou igual a `ends_at`, quando existir;
- curso publicado;
- regras de m?dulo/aula tamb?m liberadas.

### 6.6 Revogacao

Uma libera??o pode ser revogada quando:

- admin remove manualmente;
- pagamento e estornado;
- chargeback ocorre;
- checkout e invalidado;
- periodo de acesso expira.

Quando revogada:

- `is_active` deve ir para `false`;
- `release_status` deve indicar revogacao;
- `revoked_at` deve ser preenchido;
- `revoked_reason` deve explicar motivo.

## 7. Configuracoes do Curso

### 7.1 Rota

```text
/admin/cursos/:courseId/builder/settings
```

### 7.2 Seccoes da tela

A tela de configura??o do curso concentra quatro dimensoes:

1. Identidade publica do curso.
2. Dados comerciais e checkout.
3. Regras pedagogicas.
4. Padroes de IA e operacoes administrativas.

### 7.3 Identidade publica

Campos:

- capa do curso;
- nome;
- descri??o rica;
- status;
- slug;
- visibilidade no catalogo.

Comportamento:

- capa pode ser enviada por upload.
- descri??o usa editor rico.
- status controla publica??o.
- `is_public` controla se aparece no catalogo.
- `slug` define a URL `/cursos/:slug`.

### 7.4 Vendas e acesso

Campos:

- valor de venda;
- moeda;
- data de lancamento;
- criador vinculado;
- percentual de comissao do criador.

Regras:

- Valor zero habilita fluxo gratuito.
- Valor maior que zero habilita checkout pago.
- Moeda atual e `BRL`.
- Data de lancamento serve para relatorios por semestre.
- Criador vinculado acessa relatorios do curso.
- Percentual de comissao gera registro financeiro de repasse.

### 7.5 Progressao linear

Campo:

- `has_linear_progression`

Quando ativo:

- aluno deve seguir aulas em ordem;
- aulas futuras ficam bloqueadas;
- m?dulo seguinte depende do m?dulo anterior;
- quiz de m?dulo pode depender da conclus?o das aulas do m?dulo;
- avalia??o final pode depender do fluxo inteiro.

Quando desativado:

- aluno pode navegar mais livremente, respeitando apenas acesso, agenda e regras especificas.

### 7.6 Tipos de quiz disponiveis

Configurao em duas camadas:

- global em `/admin/tipos-de-quiz`;
- por curso em `/admin/cursos/:courseId/builder/settings`.

Regra:

- Se um tipo estiver desativado globalmente, ele nem aparece nas configura??es do curso.
- Se estiver ativo globalmente, o admin pode ativar/desativar por curso.
- Se estiver desativado no curso, o card de cria??o n?o aparece no builder.

Tipos suportados:

- multipla escolha;
- discursiva com IA;
- estudo de caso;
- arrastar e soltar;
- preencher lacunas;
- hotspot de imagem;
- colorir por imagem normal;
- colorir por SVG com regioes.

### 7.7 Padroes de IA

A tela permite configurar criterios para revis?o com IA:

- estrutura ideal do curso;
- elementos obrigatrios por m?dulo;
- regras de bibliografia;
- regras de tabela e formatacao;
- regras adicionais.

Esses criterios orientam as revis?es automticas feitas no builder.

### 7.8 Renovar progresso

A configura??o possui acao destrutiva para renovar progresso de todos os alunos.

Ela apaga:

- progresso de aulas;
- progresso do curso;
- tentativas de avalia??es;
- pedidos de nova tentativa;
- concessoes extras de tentativa.

Uso esperado:

- nova turma;
- relancamento do curso;
- atualizacao grande de contedo.

## 8. Construtor LMS do Curso

### 8.1 Rota principal

```text
/admin/cursos/:courseId/builder
```

### 8.2 Layout do builder

O builder e organizado como um ambiente de autoria com:

- barra superior com voltar, menu e visualizar;
- sidebar com arvore do curso;
- area principal de edicao;
- indicador de build discreto;
- navegacao contextual por rota.

### 8.3 Arvore lateral

A arvore do curso mostra:

- visao geral do curso;
- m?dulos;
- aulas dentro de cada m?dulo;
- quizzes de m?dulo;
- avalia??o final;
- acoes administrativas do curso.

Comportamentos:

- clicar em m?dulo abre editor do m?dulo;
- clicar em aula abre editor da aula;
- clicar em quiz abre builder da avalia??o;
- botao "N?ovo Mdulo" cria m?dulo;
- drag and drop ordena itens quando suportado;
- item ativo fica dest?cado.

### 8.4 Visao geral do curso

Mostra:

- resumo do curso;
- quantidade de m?dulos;
- quantidade de aulas;
- carga horaria;
- mapa curricular;
- atalhos para configura??o;
- atalhos para liberacoes;
- atalhos para avalia??es;
- importacao/exportacao;
- revis?o por IA.

Uso:

- entender estrutura geral;
- abrir rapidamente editores;
- iniciar cria??o de novos m?dulos;
- revisar consistencia do curso.

## 9. Editor de Mdulo

### 9.1 Campos

O editor de m?dulo deve permitir:

- editar t?tulo;
- editar descri??o;
- marcar como obrigatrio;
- definir libera??o programada;
- definir expiracao;
- definir "liberar apos X dias da inscricao";
- subir PDF base;
- remover PDF base;
- visualizar nome do PDF anexado.

### 9.2 Libera??o programada

Modelos de libera??o:

- liberar imediatamente;
- liberar em data/hora especifica;
- expirar em data/hora especifica;
- liberar apos X dias da inscricao no curso.

Regra cumulativa:

- Se existir data de libera??o e dias apos inscricao, o m?dulo so libera quando as duas regras forem atendidas.

Exemplos:

- `starts_at = 10/05` e `release_days_after_enrollment = 7`: aluno inscrito em 01/05 libera em 10/05; aluno inscrito em 08/05 libera em 15/05.
- `ends_at` vencido bloqueia m?dulo mesmo que o aluno tenha libera??o do curso.

### 9.3 PDF base do m?dulo

O admin pode subir um PDF base por m?dulo.

N?o aluno:

- se houver PDF base, o download gera copia licenciada;
- se n?o houver PDF base, o sistema pode usar fallback de exportacao de contedo;
- marca d'agua inclui dados do aluno, e-mail e identificador interno.

## 10. Editor de Aula

### 10.1 Campos principais

Campos:

- t?tulo;
- descri??o curta;
- tipo de aula;
- URL do YouTube;
- contedo textual;
- carga horaria estimada;
- aula obrigatria;
- libera??o programada;
- expiracao.

### 10.2 Tipos de aula

Video:

- usa `youtube_url`;
- pode ou n?o ter descri??o;
- foco principal e media embed.

Texto:

- usa blocos de contedo em `text_content`;
- n?o depende de video.

Hibrida:

- combina video e blocos;
- ideal para aula com explicacao audiovisual e material de apoio.

### 10.3 Blocos de contedo

Blocos suportados:

- bloco de texto;
- bloco de tabela;
- bloco de hotspots de imagem.

Bloco de texto:

- editor rico;
- salva HTML;
- usado para contedo principal da aula.

Bloco de tabela:

- usado para comparativos, cronogramas e estruturas tabulares;
- preserva ordem dentro do contedo.

Bloco de hotspots de imagem:

- imagem base enviada por upload;
- pontos clicaveis por hotspot;
- cada hotspot tem t?tulo e texto rico;
- no aluno, abre card/modal dentro da imagem;
- um hotspot aberto por vez;
- sem pontuacao, sem tentativa e sem nota.

### 10.4 Materiais e botoes da aula

Rota:

```text
/admin/cursos/:courseId/builder/m?dulos/:moduleId/aulas/:lessonId/materiais
```

Objetivo:

- configurar botoes do rodape da aula no player do aluno.

Estrutura:

- template de botao;
- tipo da acao;
- arquivo ou URL;
- label customizado opcional.

Tipos:

- arquivo enviado;
- link externo.

Regras:

- o aluno ve apenas o botao, icone e nome;
- URL n?o fica exposta visualmente no card;
- clique em URL abre nova aba;
- arquivo usa signed URL;
- template controla aparencia, icone e label padrao.

## 11. Bloco Interativo de Hotspots de Aula

Este bloco n?o e quiz. Ele e contedo interativo dentro da aula.

Caracteristicas:

- imagem base;
- hotspots por ponto;
- icone padrao;
- modal/card conectado ao hotspot;
- t?tulo;
- texto rico basico;
- sem nota;
- sem tentativa;
- sem progresso proprio.

N?o admin:

- upload da imagem;
- clique para criar ponto;
- arraste/reposicione;
- edite t?tulo e texto.

N?o aluno:

- imagem aparece dentro da aula;
- hotspots ficam visiveis;
- clicar abre janela perto do ponto;
- janela indica visualmente conexao com o hotspot;
- clicar fora ou no X fecha.

## 12. Avalia??es e Quizzes

### 12.1 Tipos de avalia??o

Mdulo:

- pertence a um m?dulo;
- normalmente fica depois das aulas do m?dulo;
- pode ser obrigatria;
- pode bloquear progresso.

Final:

- pertence ao curso;
- aparece ao final do player;
- valida conclus?o geral.

### 12.2 Builder de avalia??o

Recursos:

- criar perguntas;
- ordenar perguntas;
- criar estudos de caso;
- configurar alternativas;
- configurar gabarito;
- importar/exportar JSON;
- definir pontuacao;
- definir tentativas;
- definir nota minima.

### 12.3 Tipos de pergunta

Multipla escolha:

- pergunta;
- alternativas;
- alternativa correta;
- feedback e pontuacao.

Discursiva com IA:

- resposta aberta;
- rubrica;
- avalia??o automtica por IA.

Estudo de caso:

- contexto rico;
- perguntas vinculadas;
- atualmente usado fora dos tipos gamificados v1 quando houver restricao.

Arrastar e soltar:

- imagem base;
- areas/hotspots;
- banco de respostas;
- aluno arrasta token para slot.

Preencher lacunas:

- texto com lacunas;
- banco de respostas;
- aluno associa respostas.

Hotspot de imagem:

- imagem base;
- hotspots retangulares;
- modo clique unico;
- modo encontrar todos;
- feedback por hotspot correto/incorreto;
- feedback ao clicar fora.

Colorir com imagem normal:

- imagem base comum;
- pontos pequenos numerados;
- aluno seleciona cor e marca pontos;
- cor do ponto vem do banco de resposta.

Colorir com SVG:

- SVG com regioes identificadas por `id` ou `data-region-id`;
- aluno pinta a regiao real;
- cor aplicada no elemento vetorial;
- recomendado para preenchimento preciso.

### 12.4 Execucao e submissao

O frontend renderiza interacao, mas o backend decide nota.

Fluxo:

1. aluno abre avalia??o;
2. frontend carrega execucao;
3. aluno responde;
4. frontend envia tentativa;
5. backend valida payload;
6. backend calcula score;
7. backend grava tentativa;
8. frontend mostra resultado.

## 13. Player LMS do Aluno

### 13.1 Rota base

```text
/aluno/cursos/:courseId/player
```

### 13.2 Conceito visual

O player e uma experiencia de LMS em tela cheia.

Caracteristicas:

- ocupa a altura total da tela;
- sidebar fixa a esquerda;
- contedo principal a direita;
- header interno no topo;
- scroll interno no contedo;
- botao para sair do player;
- progresso visivel.

### 13.3 Sidebar do player

A sidebar mostra:

- link de voltar para detalhe do curso;
- progresso geral;
- m?dulos;
- aulas;
- quizzes de m?dulo;
- avalia??o final.

Cada aula mostra:

- icone de conclus?o;
- t?tulo;
- tipo de contedo;
- carga em minutos;
- est?do ativo;
- est?do bloqueado.

Cada quiz mostra:

- tipo: quiz de m?dulo ou prova final;
- bloqueado/disponvel/aprovado/reprovado;
- tentativas esgotadas;
- item ativo.

### 13.4 Header do player

O header mostra:

- botao de abrir/fechar sidebar;
- nome do curso;
- progresso percentual;
- sair do player.

### 13.5 Area principal

A area principal renderiza:

- aula;
- avalia??o;
- mensagens de erro;
- est?dos de carregamento.

Ela deve ser independente da sidebar e permitir leitura focada.

### 13.6 Navegacao

O aluno pode navegar por:

- proxima aula;
- aula anterior;
- quiz de m?dulo;
- avalia??o final;
- sair para detalhe do curso.

Regras:

- link bloqueado n?o deve navegar;
- URL direta deve validar acesso;
- admin pode visualizar como preview quando autorizado;
- aluno so acessa o que est? liberado.

## 14. P?gina da Aula no Player

### 14.1 Contedo exibido

A aula exibe:

- t?tulo;
- descri??o;
- video quando houver;
- contedo textual;
- blocos de tabela;
- hotspots interativos;
- audio gerado por IA quando existir;
- notas do aluno;
- materiais e botoes;
- botao de concluir;
- navegacao anterior/proximo.

### 14.2 Conclusao da aula

O aluno pode marcar aula como concluida.

Quando concluida:

- progresso da aula e salvo;
- progresso do m?dulo recalcula;
- proxima aula pode ser liberada;
- quiz pode ser liberado se todos os requisitos forem atendidos.

### 14.3 N?otas do aluno

O aluno pode registrar anotacoes por aula.

Uso:

- estudo individual;
- revis?o posterior;
- registro privado.

### 14.4 Materiais de rodape

Os botoes aparecem no rodape da aula, junto a navegacao.

Exemplos:

- Baixar PDF;
- Material complementar;
- Planilha;
- Abrir link;
- Acessar guia.

## 15. P?gina de Detalhe do Curso para o Aluno

Rota:

```text
/aluno/cursos/:courseId
```

Mostra:

- hero do curso;
- capa;
- t?tulo;
- carga horaria;
- progresso;
- botao iniciar/continuar;
- descri??o;
- grade curricular;
- m?dulos;
- aulas;
- quizzes;
- PDF do m?dulo;
- reviews;
- anotacoes.

Estados:

- disponvel;
- em andamento;
- concluido;
- bloqueado;
- expirado.

## 16. Catalogo Pblico e P?gina de Venda

### 16.1 Catalogo

Rota:

```text
/cursos
```

Mostra:

- cards de cursos pblicos;
- filtros;
- busca;
- categorias;
- p?ginacao;
- imagem, t?tulo e resumo;
- CTA.

Regra de exibi??o:

- `status = published`;
- `is_public = true`;
- curso precisa ter dados pblicos suficientes.

### 16.2 P?gina publica de venda

Rota:

```text
/cursos/:slug
```

Mostra:

- t?tulo;
- categoria;
- descri??o;
- sobre o curso;
- o que o aluno vai aprender;
- contedo programatico;
- m?dulos;
- aulas resumidas;
- criador/mentor quando aplicvel;
- preco;
- CTA de compra;
- reviews publicas.

### 16.3 CTA de compra

Comportamento:

- se usuário não estiver logado, direciona para login/cadastro;
- se curso já estiver liberado, leva ao curso;
- se curso for gratuito, cria liberação;
- se curso for pago, inicia checkout.

## 17. Checkout e Pagamento com Asaas

### 17.1 Endpoint de início

```text
POST /api/checkout/asaas/start
```

Requisitos:

- usuário autenticado;
- `Authorization: Bearer <access_token>`;
- `courseId` no body;
- curso publicado;
- curso público;
- gateway ativo.

Payload:

```json
{
  "courseId": "uuid-do-curso",
  "buyerName": "N?ome do comprador opcional",
  "buyerEmail": "comprador@email.com",
  "buyerDocument": "00000000000"
}
```

`buyerName`, `buyerEmail`, `buyerDocument`, `buyerPhone`, `buyerAddress`, `buyerAddressNumber`, `buyerAddressComplement`, `buyerPostalCode`, `buyerProvince` e `buyerCity` são opcionais no contrato público. Quando vierem preenchidos pelo formulário de compra, o backend envia esses dados para o checkout hospedado do Asaas e também registra em `commerce_checkout_sessions`. Se vierem vazios, o backend usa o perfil autenticado do usuário como fallback. O checkout do Asaas é criado apenas com `billingTypes: ["CREDIT_CARD"]`, mantendo o fluxo sem Pix.

Resposta para curso pago:

```json
{
  "checkoutUrl": "https://asaas.com/checkoutSession/showid=...",
  "checkoutId": "..."
}
```

Resposta para curso gratuito:

```json
{
  "checkoutUrl": "https://genflix.../aluno/cursos/:courseId",
  "mode": "free"
}
```

### 17.2 Curso gratuito

Fluxo:

1. aluno clica em acessar;
2. backend valida usuário e curso;
3. backend cria `course_releases`;
4. origem fica como `purchase` ou fluxo gratuito, conforme regra atual;
5. frontend manda aluno para curso.

### 17.3 Curso pago

Fluxo:

1. aluno clica em comprar;
2. frontend chama API;
3. backend valida token;
4. backend carrega perfil;
5. backend carrega curso;
6. backend consulta `payment_gateway_settings`;
7. backend cria checkout no Asaas;
8. backend cria registro em `commerce_checkout_sessions`;
9. frontend redireciona para checkout hospedado;
10. Asaas processa pagamento;
11. Asaas chama webhook;
12. webhook libera curso.

### 17.4 Configurao do gateway

Tabela:

- `payment_gateway_settings`

Campos conceituais:

- gateway ativo;
- codigo do gateway, atualmente `asaas`;
- ambiente `sandbox` ou `production`;
- configura??o atual;
- timest?mps.

Variaveis de ambiente:

- `ASAAS_ACCESS_TOKEN_SANDBOX`;
- `ASAAS_ACCESS_TOKEN_PRODUCTION`;
- `ASAAS_ACCESS_TOKEN`;
- `ASAAS_WEBHOOK_SECRET`;
- `SUPABASE_SERVICE_ROLE_KEY`.

### 17.4.1 Painel administrativo de pagamentos

Rota:

```text
/admin/pagamentos
```

Objetivo:

- centralizar a operação comercial do gateway;
- alternar ambiente ativo entre `sandbox` e `production`;
- exibir URL pública do webhook Asaas;
- listar variáveis obrigatórias do deploy;
- exibir diagnóstico seguro de configuração sem mostrar segredos;
- apresentar indicadores resumidos de checkouts, pagamentos, estornos, falhas e receita bruta estimada;
- listar sessões de checkout e eventos recentes para auditoria operacional.

Diagnóstico:

- endpoint administrativo `GET /api/admin/payments/diagnostics`;
- exige usuário autenticado com role `admin`;
- valida se `SUPABASE_SERVICE_ROLE_KEY` existe no deploy;
- carrega `payment_gateway_settings`;
- verifica se o gateway ativo é `asaas`;
- verifica se existe token Asaas para o ambiente atual;
- verifica separadamente token sandbox e token produção;
- verifica se `ASAAS_WEBHOOK_SECRET` está configurado;
- verifica se existe URL pública (`APP_PUBLIC_URL` ou origem do deploy) para callbacks/webhook;
- nunca retorna valores sensíveis, apenas status e instrução operacional.

Estado operacional atual:

- a estrutura técnica do gateway Asaas está pronta para sandbox e produção;
- o banco remoto da GenFlix possui as migrations de pagamentos, checkout, webhook, comissões e repasses aplicadas;
- produção Asaas depende de credenciais definitivas do cliente e deve permanecer como pendência operacional enquanto a conta final não estiver aprovada/configurada;
- o painel `/admin/pagamentos` deve exibir erro para o token do ambiente ativo quando a variável correspondente não existir no deploy.

### 17.5 Webhook

Endpoint:

```text
POST /api/webhooks/asaas
```

Eventos tratados:

- `CHECKOUT_PAID`;
- `PAYMENT_RECEIVED`;
- `PAYMENT_CONFIRMED`;
- `CHECKOUT_CANCELED`;
- `CHECKOUT_EXPIRED`;
- eventos de refund;
- eventos de chargeback;
- `PAYMENT_DELETED`.

Regras:

- valida segredo do webhook quando configurado;
- registra evento em `commerce_events`;
- evita duplicidade por `external_event_id`;
- quando o Asaas não envia um identificador próprio do evento, usa uma chave determinística com tipo do evento, checkout, pagamento e referência externa;
- localiza checkout por `external_checkout_id`, `external_reference` do checkout ou `externalReference` do pagamento;
- atualiza status da sessão;
- libera ou revoga acesso;
- cria ou cancela comissão do criador.

### 17.6 Tabelas comerciais

`commerce_checkout_sessions`:

- sessao de checkout criada;
- curso;
- usurio comprador;
- nome e e-mail do comprador;
- gateway;
- ambiente;
- id externo;
- URL do checkout;
- status;
- payload enviado;
- resposta recebida.

`commerce_events`:

- eventos recebidos do gateway;
- id externo do evento;
- tipo do evento;
- curso;
- usurio;
- sessao;
- pagamento externo;
- status de processamento;
- payload bruto.

## 18. Comissao de Criadores

### 18.1 Relacao curso-criador

Um curso pode ter um criador vinculado por `creator_id`.

O curso tamb?m define:

- `creator_commission_percent`.

### 18.2 Geracao da comissao

Quando o webhook confirma pagamento:

1. acesso do aluno e liberado;
2. checkout e marcado como pago;
3. RPC de comissao e chamada;
4. comissao e criada como pendente.

### 18.3 Elegibilidade de repasse

Regra de negocio:

- repasse deve ocorrer em ate 30 dias apos a venda;
- criador recebe via PIX;
- dados de PIX pertencem ao perfil financeiro do criador;
- comissao deve ser visivel em relatorios.

### 18.4 Estorno

Se compra for estornada, cancelada ou sofrer chargeback:

- acesso gerenciado pelo gateway pode ser revogado;
- comissao pendente deve ser cancelada;
- comissao ja paga deve gerar necessidade de estorno/ajuste;
- evento deve ficar auditavel.

### 18.5 Operação admin de repasses

Rota:

```text
/admin/repasses
```

Objetivo:

- configurar modo global de repasse (`manual` ou `automatic`);
- definir intervalo em dias, valor mínimo e próxima execução;
- listar e filtrar comissões de criadores;
- dest?car comissões elegíveis para repasse;
- pagar PIX diretamente pelo Asaas para lotes de um único criador e um único curso;
- registrar pagamento externo quando o repasse for feito fora do Asaas;
- executar ciclo automático sob demanda;
- exibir histórico de repasses, transferências Asaas e falhas.

API administrativa:

```text
GET /api/admin/creator-payouts
POST /api/admin/creator-payouts
GET /api/admin/creator-payoutstask=process_due_payouts
```

Regras:

- exige usuário autenticado com role `admin` para operações manuais;
- cron exige `CREATOR_PAYOUT_CRON_SECRET` ou `CRON_SECRET`;
- usa service role no servidor e não expõe chaves sensíveis;
- o POST aceita `register_external_payout`, `send_pix_payout`, `update_payout_settings` e `process_due_payouts`;
- pagamento via Asaas agrupa por `creator_id + course_id`;
- pagamento externo permite lote do mesmo criador, mesmo com múltiplos cursos;
- apenas comissões `pending` ou `eligible` com `eligible_at <= now()` podem ser pagas;
- comissões já presentes em `creator_payout_items` não podem entrar em novo lote;
- se saldo/token/API do Asaas falhar, o payout fica `failed` e as comissões voltam para `eligible`.

Configuração global:

```text
creator_payout_settings
```

Campos principais:

- `mode`: `manual` ou `automatic`;
- `interval_days`: intervalo do ciclo automático;
- `minimum_amount_cents`: valor mínimo por grupo;
- `is_enabled`: habilita ou pausa automação;
- `last_run_at` e `next_run_at`: controle operacional do ciclo.

Transferência Asaas:

- usa `POST /v3/transfers`;
- envia `operationType: PIX`;
- converte `cpf`, `cnpj`, `email`, `phone`, `random` para os tipos exigidos pelo Asaas;
- grava `external_transfer_id`, `external_reference`, `external_status`, `raw_request` e `raw_response` em `creator_payouts`;
- status `DONE` marca payout e comissões como `paid`;
- status `PENDING` mantém payout `processing` e comissões `scheduled`;
- status `CANCELLED` ou erro marca payout `failed` e libera as comissões para nova tentativa.

Automação:

- Vercel Cron chama `GET /api/admin/creator-payoutstask=process_due_payouts`;
- o ciclo roda somente se `mode = automatic`, `is_enabled = true` e `next_run_at <= now()`;
- a execução agrupa comissões por criador e curso;
- a cada ciclo, o sistema também sincroniza payouts `processing` com o status mais recente no Asaas.

Estornos após pagamento:

- comissão ainda não paga vira `canceled` ou `refunded`;
- comissão já paga vira `refunded`;
- o sistema cria comissão negativa elegível imediatamente para abater o próximo repasse do mesmo criador e curso.

RPC transacional:

```text
register_creator_commission_payout(_creator_id, _commission_ids, _paid_at, _created_by, _notes, ...)
```

Responsabilidades:

- validar seleção;
- criar registro em `creator_payouts`;
- criar itens em `creator_payout_items`;
- marcar comissões como `paid`;
- registrar `paid_at`;
- executar tudo em uma única transação.

## 19. Relatorios do Criador

O criador acessa area propria, sem acesso ao builder completo.

Permissoes:

- ver apenas cursos vinculados;
- ver vendas agregadas;
- ver receita bruta;
- ver cancelamentos;
- ver comissoes;
- editar o proprio perfil.

Recorte de relatorio:

- periodos de seis meses a partir da data de lancamento;
- vendas por periodo;
- cancelamentos por periodo;
- receita bruta;
- comissao estimada/pendente/elegivel.

### 19.1 Dashboard executivo do criador

Rota principal:

```text
/criador/relatorios
```

Componentes da tela:

- filtro por curso vinculado;
- filtro por ciclo de seis meses;
- cards de vendas, receita bruta, cancelamentos, comissões pendentes, comissões pagas e comissões estornadas;
- seção de política de repasse com modo, intervalo, valor mínimo, próxima janela e última execução;
- cards de repasses em processamento, pagos e falhos;
- seção "Minha carteira de cursos" com cursos vinculados, status, preço, percentual de comissão, vendas, receita e cancelamentos;
- tabela de semestres por curso;
- tabela de meus repasses com método Asaas/externo, status e falhas;
- tabela de últimas comissões filtradas por curso/período;
- botão de atualização manual;
- est?do vazio quando não houver cursos vinculados;
- est?do vazio quando o filtro atual não tiver vendas ou comissões.

Fonte dos dados:

- `get_creator_sales_report()` para agregados semestrais;
- `creator_commissions` para histórico de comissão;
- `creator_payout_settings` para política global refletida ao criador;
- `creator_payouts` para histórico dos lotes de repasse;
- `courses` filtrado por `creator_id = auth.uid()` para carteira de cursos.

## 20. Regras de Acesso e Bloqueio

O acesso final a uma aula depende de todas as camadas:

1. usurio autenticado;
2. curso publicado;
3. curso liberado por usurio ou grupo;
4. libera??o ativa e dentro da validade;
5. m?dulo liberado;
6. aula liberada;
7. progressao linear satisfeita;
8. quiz liberado quando aplicvel.

Regra central:

- a regra mais restritiva vence.

Exemplos:

- curso liberado, m?dulo bloqueado por data: aluno n?o acessa aula.
- m?dulo liberado, aula bloqueada por data: aluno n?o acessa aula.
- aula liberada, m?dulo expirado: aluno n?o acessa aula.
- aluno com URL direta, mas sem libera??o: recebe erro/bloqueio.

## 21. Storage e Arquivos

Buckets/conceitos usados:

- imagens de capa;
- PDF base de m?dulo;
- arquivos de rodape da aula;
- assets de blocos interativos;
- materiais privados.

Regras:

- arquivo privado deve usar signed URL;
- PDF de m?dulo pode ser licenciado por aluno;
- URL permanente privada n?o deve ser exposta;
- ao trocar asset, idealmente limpar arquivo antigo;
- editor salva `storage_path`, n?o signed URL permanente.

## 22. Importacao e Exportacao de Contedo

### 22.1 Importacao

A plataforma aceita importacao de curso via JSON.

Uso:

- criar curso completo com IA;
- migrar contedo;
- acelerar cria??o de m?dulos, aulas e quizzes.

### 22.2 Exportacao

Exportacao baixa JSON completo do curso.

Deve conter:

- curso;
- m?dulos;
- aulas;
- contedos;
- quizzes;
- perguntas;
- configura??es pedagogicas.

## 23. Estrutura de Codigo

P?ginas principais:

```text
src/pages/admin/admin-courses-page.tsx
src/pages/admin/builder/course-overview-panel.tsx
src/pages/admin/builder/course-settings-panel.tsx
src/pages/admin/builder/module-editor-panel.tsx
src/pages/admin/builder/lesson-editor-panel.tsx
src/pages/admin/builder/lesson-materials-panel.tsx
src/pages/admin/builder/course-assessments-panel.tsx
src/pages/admin/builder/assessment-builder-panel.tsx

src/pages/student/student-dashboard-page.tsx
src/pages/student/student-courses-page.tsx
src/pages/student/student-course-details-page.tsx
src/pages/student/student-course-player-layout.tsx
src/pages/student/student-lesson-page.tsx
src/pages/student/student-assessment-execution-page.tsx

src/pages/public/public-courses-page.tsx
src/pages/public/public-course-details-page.tsx

api/checkout/asaas/start.ts
api/webhooks/asaas.ts
```

Features principais:

```text
src/features/admin/content
src/features/admin/assessments
src/features/admin/quiz-types
src/features/student/courses
src/features/student/assessments
src/features/public/courses
src/features/reviews
src/features/creator/reports
```

## 24. Contratos de Aceite

### 24.1 Admin

Um curso est? operacional quando o admin consegue:

- criar curso;
- editar capa, t?tulo e descri??o;
- configurar status;
- configurar preco;
- configurar slug;
- vincular criador;
- definir comissao;
- configurar tipos de quiz;
- criar m?dulos;
- criar aulas;
- criar quizzes;
- configurar liberacoes;
- publicar curso.

### 24.2 Aluno

O aluno deve conseguir:

- visualizar cursos liberados;
- abrir detalhe do curso;
- entrar no player;
- navegar por m?dulos;
- assistir aulas;
- ler contedo;
- interagir com hotspots de aula;
- baixar PDFs e materiais;
- marcar aulas como concluidas;
- responder quizzes;
- ver resultado;
- continuar de onde parou.

### 24.3 Compra

O fluxo comercial est? correto quando:

- curso gratuito libera acesso sem checkout pago;
- curso pago cria checkout Asaas;
- webhook confirmado libera acesso;
- cancelamento/expiracao n?o libera;
- estorno/chargeback revoga acesso gerenciado;
- comissao de criador e criada quando aplicvel;
- comissao e cancelada quando venda e estornada.

### 24.4 Seguranca

O sistema precisa garantir:

- aluno sem libera??o n?o acessa curso por URL direta;
- aluno sem progresso necessrio n?o pula sequencia quando progressao linear est? ativa;
- arquivos privados usam signed URL;
- service role fica apenas no backend;
- webhook n?o depende de chave publica;
- frontend n?o calcula nota final sozinho.

## 25. Guia de Reuso em Outra Plataforma

Para reutilizar essa estrutura em outro produto, implemente na seguinte ordem:

1. Autenticacao e roles.
2. Modelo `courses`, `course_modules`, `lessons`, `assessments`.
3. Modelo de liberacoes `course_releases`.
4. Painel admin de cursos.
5. Builder com sidebar e rotas aninhadas.
6. Editor de m?dulos.
7. Editor de aulas com blocos.
8. Builder de quizzes.
9. Player do aluno em tela cheia.
10. Catalogo pblico e p?gina de venda.
11. Checkout e webhook.
12. Comissao de criadores.
13. Relatorios.
14. Reviews e notificacoes.

N?o comece pelo checkout se o modelo de libera??o ainda n?o estiver pronto. O pagamento so deve dar acesso criando ou atualizando `course_releases`.

## 26. Regra de Manutencao deste Documento

Sempre que a estrutura de cursos, builder, player, liberacoes, checkout, pagamento, comissoes ou vendas de curso for alterada, este arquivo deve ser atualizado no mesmo commit.
