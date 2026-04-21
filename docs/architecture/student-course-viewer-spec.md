# SPEC: Visualizador de Cursos do Aluno

## 1. Objetivo do documento

Este documento descreve, em nivel funcional, visual e tecnico, como a experiencia atual de visualizacao de cursos do aluno esta implementada na GenFlix.

O escopo cobre toda a jornada de consumo do curso dentro da area logada do aluno, incluindo:

- pagina de detalhes do curso;
- player de aulas em tela cheia;
- execucao de quizzes modulares e prova final;
- recursos auxiliares da aula, como PDF, audio narrado e bloco de notas;
- logica de progresso, bloqueios e liberacao de conteudo.

Este spec representa o estado atual do codigo, e nao uma proposta futura.

## 2. Arquivos-fonte principais

### 2.1 Rotas

- `src/app/router/index.tsx`

### 2.2 Pagina de detalhes do curso

- `src/pages/student/student-course-details-page.tsx`

### 2.3 Player do curso

- `src/pages/student/student-course-player-layout.tsx`
- `src/pages/student/student-lesson-page.tsx`
- `src/pages/student/student-assessment-execution-page.tsx`

### 2.4 Dados de progresso e liberacao

- `src/features/student/courses/api.ts`
- `src/features/student/assessments/api.ts`
- `src/types/content.ts`

### 2.5 Recursos complementares dentro da aula

- `src/features/student/notes/lesson-notes-panel.tsx`
- `src/features/student/lesson-audio/lesson-audio-player.tsx`
- `src/features/student/content/pdf-exporter.ts`
- `src/features/admin/content/api.ts`

## 3. Posicionamento da experiencia na arquitetura do aluno

## 3.1 Rotas da jornada

Fluxo atual:

```text
/aluno/cursos
  -> catalogo interno do aluno

/aluno/cursos/:courseId
  -> pagina de detalhes do curso

/aluno/cursos/:courseId/player/aulas/:lessonId
  -> player da aula

/aluno/cursos/:courseId/player/avaliacoes/:assessmentId
  -> execucao do quiz do modulo ou prova final
```

## 3.2 Papel de cada etapa

### 3.2.1 Pagina de detalhes do curso

Funciona como hub academico daquele treinamento. Ela combina:

- hero do curso;
- indicador geral de progresso;
- CTA principal de continuar estudo;
- descricao editorial;
- grade curricular completa;
- quizzes do modulo;
- prova final, quando existir;
- agregacao das anotacoes do aluno.

### 3.2.2 Player do curso

O player serve como ambiente focado de consumo, sem sidebar geral da area do aluno. Ele concentra:

- navegacao lateral por modulos e aulas;
- conteudo ativo da aula ou avaliacao;
- navegacao sequencial;
- progresso resumido;
- retorno rapido para a pagina do curso.

## 4. Modelo geral da experiencia

## 4.1 Estrutura de dados base

O visualizador depende de tres grupos de dados:

1. `Course`
   - metadados do curso, imagem de capa, descricao e carga horaria.
2. `StudentCourseModuleProgress[]`
   - modulos com estado de liberacao e lista de aulas liberadas para o aluno.
3. `StudentCourseAssessmentSummary[]`
   - quizzes de modulo e prova final, com estado de acesso, tentativas e aprovacao.

Esses dados sao consumidos tanto na pagina de detalhes quanto no player.

## 4.2 Fontes de verdade

### 4.2.1 Cursos publicados

- `fetchReleasedCourseById(courseId)`
- consulta `courses` com `status = 'published'`

### 4.2.2 Progresso modular do aluno

- `fetchStudentCourseContentWithProgress(courseId)`
- consome os RPCs:
  - `get_student_course_modules_progress`
  - `get_student_unlocked_lessons_progress`

### 4.2.3 Estado das avaliacoes

- `fetchStudentCourseAssessments(courseId)`
- consome RPC `get_student_course_assessments`

### 4.2.4 Estado macro da jornada

- `fetchStudentCourseStatus(courseId)`
- consome RPC `get_student_course_status`

Esse estado e resumido por `getStudentCourseJourneyStatus`, que retorna:

- `in_progress`
- `final_pending`
- `completed`

## 4.3 Modo de preview para admin

Nas rotas do aluno, quando o usuario atual tem role `admin`, as telas fazem bypass das travas academicas e carregam dados a partir de `fetchAdminCourseTree(courseId)`.

Efeito pratico:

- modulos e aulas ficam sempre acessiveis;
- quizzes ficam sempre acessiveis;
- estados de progresso sao sinteticos;
- isso permite validar visual e conteudo do curso sem depender da jornada real do aluno.

## 5. Pagina `/aluno/cursos/:courseId`

## 5.1 Objetivo da pagina

Essa pagina apresenta o curso como um produto academico ja liberado, com forte enfase em progresso, continuidade e legibilidade da grade curricular.

Ela nao e uma landing page publica. E uma tela operacional de acompanhamento do treinamento.

## 5.2 Estrutura visual geral

Canvas principal:

- container vertical com `space-y-12`;
- padding inferior amplo `pb-24`;
- animacao de entrada `fade-in`.

A tela e organizada em cinco blocos:

1. hero do curso;
2. alertas de conclusao ou pendencia da prova final;
3. barra persistente de progresso;
4. descricao do curso;
5. grade curricular;
6. secao consolidada de anotacoes.

## 5.3 Hero do curso

### 5.3.1 Bloco visual

O hero e um painel premium de grande impacto com:

- `rounded-[48px]`;
- `overflow-hidden`;
- fundo base `bg-slate-900`;
- altura minima `400px`;
- padding `p-8` no mobile e `md:p-16` no desktop;
- sombra forte `shadow-2xl`.

### 5.3.2 Midia de fundo

Se o curso possui `thumbnail_url`:

- a imagem ocupa todo o fundo;
- usa `object-cover`;
- opacidade reduzida para `0.40`.

Se nao possui imagem:

- entra um gradiente decorativo azul/indigo.

Em ambos os casos existe um overlay escuro vertical:

- `bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent`

### 5.3.3 Conteudo textual

O conteudo do hero inclui:

- titulo gigante do curso;
- metadados de carga horaria;
- quantidade total de modulos;
- barra de progresso inline;
- percentual concluido;
- CTA principal.

### 5.3.4 CTA principal

O botao principal e branco sobre fundo escuro, com:

- altura `64px`;
- padding horizontal largo;
- `rounded-2xl`;
- fonte grande e muito pesada.

O label muda conforme a jornada:

- `Iniciar Aprendizado`
- `Continuar Aprendizado`
- `Revisar Aprendizado`

O destino e a primeira aula do primeiro modulo que tenha aula.

## 5.4 Alertas de status da jornada

## 5.4.1 Curso concluido

Quando `courseJourneyStatus === 'completed'`, aparece um banner comemorativo:

- gradiente `emerald -> teal`;
- icone circular branco transluzido;
- titulo `Missao Cumprida!`;
- copy de celebracao;
- botao de certificado.

Observacao:

- o botao `Baixar Certificado` ja existe visualmente, mas neste estado o documento e mais um placeholder de UX do que um fluxo tecnico totalmente descrito neste spec.

## 5.4.2 Conteudo concluido sem prova final aprovada

Quando `courseJourneyStatus === 'final_pending'`, aparece um banner em:

- gradiente `amber -> orange`;
- copy explicando que o conteudo foi concluido;
- CTA para `Fazer Prova Final`.

## 5.5 Barra persistente de progresso

Esse bloco resume o estado atual da trilha e fica logo abaixo do hero.

### 5.5.1 Estrutura

- cartao branco;
- `rounded-[32px]`;
- borda `border-slate-100`;
- `p-6`;
- sombra suave.

### 5.5.2 Componentes

O bloco combina:

- grafico circular pequeno com percentual;
- titulo `Resumo da Jornada`;
- barra horizontal secundaria;
- card lateral de contagem de modulos concluidos.

### 5.5.3 Formula atual de progresso

O percentual do curso e calculado com base apenas no estado dos modulos:

- `completed modules / total modules`

Ou seja:

- progresso macro do curso e modular;
- nao e um percentual por aula individual.

## 5.6 Descricao do curso

Quando `course.description` existe, a pagina mostra a secao `Sobre este Treinamento`.

Caracteristicas:

- cartao branco grande;
- `rounded-[40px]`;
- padding alto;
- renderizacao HTML via `dangerouslySetInnerHTML`;
- preservacao de estilos do editor com classes `ql-editor`.

Isso indica que a descricao aceita conteudo rico vindo do admin.

## 5.7 Grade curricular

## 5.7.1 Estrutura geral

A grade ocupa largura total e e desenhada como uma timeline modular.

Cada modulo aparece com:

- marcador numerado ou check na coluna lateral;
- card branco principal;
- titulo e descricao;
- badge de estado;
- botao `Baixar PDF`;
- lista de aulas;
- bloco de quiz do modulo, quando houver.

## 5.7.2 Estados do modulo

Os estados principais usados na camada visual sao:

- `blocked`
- `completed`
- `in_progress`

Tratamento visual:

- `blocked`
  - tons neutros e opacidade reduzida;
- `completed`
  - verde com check;
- `in_progress`
  - azul.

## 5.7.3 Lista de aulas

Cada aula aparece em uma linha com dois elementos:

1. botao de marcar conclusao;
2. card clicavel para abrir o player.

Comportamentos:

- aula concluida recebe check verde;
- aula nao concluida usa visual neutro;
- o titulo pode aparecer com `line-through` quando concluido;
- aulas obrigatorias exibem selo textual pequeno `Obrigatoria`.

## 5.7.4 Acao de marcar aula como concluida

A acao usa:

- `setLessonCompletion`
- `upsert` em `lesson_progress`

Depois disso a tela recarrega:

- modulos com progresso;
- avaliacoes do curso;
- status geral do curso.

## 5.7.5 Quiz do modulo dentro da grade

Quando existe quiz modular, ele aparece abaixo das aulas do modulo em um card destacado.

Estados visuais tratados:

- quiz bloqueado porque aulas do modulo nao foram concluidas;
- quiz disponivel;
- quiz aprovado;
- quiz com tentativas esgotadas.

O CTA muda de acordo com o estado:

- `Iniciar Quiz`
- `Refazer Quiz`
- `Ver Status`
- texto explicativo para concluir as aulas antes.

## 5.7.6 PDF do modulo

Cada modulo pode expor o botao `Baixar PDF`.

Fluxo:

- se o modulo tem `module_pdf_storage_path`, usa exportacao licenciada;
- caso contrario, o PDF pode ser gerado dinamicamente por `exportModuleToPdf`.

## 5.8 Secao `Minhas Anotacoes`

Essa secao agrega as anotacoes de todas as aulas do curso em uma unica listagem.

### 5.8.1 Estados

- carregando;
- erro;
- vazio;
- lista de notas.

### 5.8.2 Conteudo de cada nota

Cada card de anotacao mostra:

- modulo de origem;
- timestamp de ultima atualizacao;
- titulo da aula;
- texto da anotacao;
- CTA `Abrir aula`;
- CTA `Excluir nota`.

## 6. Player `/aluno/cursos/:courseId/player`

## 6.1 Papel do layout

O `StudentCoursePlayerLayout` cria uma experiencia LMS de tela cheia, separada do restante da area do aluno.

Objetivos:

- reduzir distracoes;
- manter navegacao lateral sempre visivel;
- permitir troca rapida entre aulas e avaliacoes;
- sustentar leitura longa, video e prova em um mesmo shell.

## 6.2 Estrutura geral do player

Canvas:

- `display: flex`;
- altura total da viewport;
- largura total;
- fundo `bg-slate-50`.

Divisao:

- sidebar esquerda colapsavel;
- area principal a direita.

## 6.3 Sidebar do player

## 6.3.1 Caracteristicas visuais

- fundo branco;
- borda direita `border-slate-200`;
- largura expandida `w-80`;
- estado colapsado `w-0 overflow-hidden`;
- transicao suave.

## 6.3.2 Cabecalho da sidebar

Topo com:

- link de voltar para a pagina do curso;
- titulo do curso truncado.

## 6.3.3 Bloco de progresso

Logo abaixo do topo:

- label `Progresso`;
- percentual do curso;
- barra horizontal azul.

## 6.3.4 Navegacao por modulos

Cada modulo aparece com:

- titulo `MODULO X`;
- nome do modulo;
- lista das aulas;
- quizzes do modulo;
- prova final ao final da sidebar, quando existir.

### 6.3.4.1 Aula na sidebar

Cada item de aula mostra:

- circulo de status;
- titulo;
- metadado de tipo e duracao.

Tipos visuais de aula:

- video;
- texto;
- hibrida.

### 6.3.4.2 Estados de aula

- ativa;
- concluida;
- bloqueada;
- neutra.

Estado ativo:

- fundo azul claro;
- titulo em azul forte.

Estado concluido:

- circulo verde preenchido com check.

Estado bloqueado:

- opacidade;
- grayscale;
- clique impedido.

### 6.3.4.3 Quiz na sidebar

Os quizzes aparecem em cards menores, com estrutura similar a chips enriquecidos.

Elementos:

- label superior em caps;
- titulo do quiz;
- icone documental;
- cor que indica estado.

Estados tratados:

- `QUIZ DO MODULO`
- `QUIZ BLOQUEADO`
- `TENTATIVAS ESGOTADAS`
- aprovado.

### 6.3.4.4 Prova final

A prova final aparece como um bloco proprio ao fim da sidebar.

Segue a mesma logica de estados:

- bloqueada;
- disponivel;
- aprovada;
- tentativas esgotadas.

## 6.4 Header superior do player

Header horizontal com:

- botao de colapsar sidebar;
- titulo do curso em caps;
- resumo de progresso no desktop;
- link `Sair do Player`.

Caracteristicas:

- fundo branco;
- borda inferior;
- altura fixa `64px`.

## 6.5 Conteudo principal do player

A area principal usa:

- `Outlet`;
- scroll vertical interno;
- largura flexivel.

O outlet recebe por contexto:

- `course`
- `modules`
- `assessments`
- `setModules`
- `setAssessments`

Isso permite que paginas-filhas atualizem o estado do shell apos uma conclusao de aula ou submissao de quiz.

## 7. Pagina de aula `StudentLessonPage`

## 7.1 Objetivo

Entregar a experiencia de consumo da aula em si, seja:

- video;
- texto;
- hibrida.

## 7.2 Estrutura visual

O container central usa:

- largura maxima `1440px`;
- padding generoso;
- espaco vertical entre blocos;
- rodape sticky de navegacao.

## 7.3 Cabecalho da aula

O topo da aula inclui:

- badge `Aula Atual`;
- badge `Video + Texto` quando `lesson_type === 'hybrid'`;
- CTA `Baixar PDF do Modulo`;
- titulo grande da aula;
- descricao da aula, quando existir.

## 7.4 Midia principal

## 7.4.1 Video

Quando a aula tem YouTube:

- usa `iframe`;
- container `aspect-video`;
- `rounded-[32px]`;
- fundo preto;
- sombra forte.

O ID do video e extraido por `extractVideoId`.

## 7.4.2 Conteudo textual

Quando a aula tem texto:

- a pagina carrega o `LessonAudioPlayer`;
- em seguida renderiza o conteudo em card branco com padding grande;
- o texto e quebrado por `splitContent`;
- a exibicao e feita com `ContentBlocksRenderer`.

Isso mostra que a aula textual suporta blocos ricos e nao apenas HTML cru.

## 7.5 Bloco `Texto para Fala`

O `LessonAudioPlayer` fica acima do texto e oferece narracao gerada por IA.

### 7.5.1 Estados principais

- narracao inexistente;
- carregando;
- pronta para reproduzir;
- erro;
- solicitacao de moderacao enviada.

### 7.5.2 Acoes

- `Gerar Narracao`
- `Gerar Novamente` para admin
- aviso para moderacao quando ha erro tecnico persistente

### 7.5.3 Reproducao

Se a narracao for longa, ela pode vir em partes:

- o player avanca automaticamente entre trechos;
- cada trecho tem `url` assinada.

## 7.6 Bloco de recursos da aula

A aula possui um card `Botoes e Recursos` que lista:

- links externos;
- arquivos;
- recursos configurados no rodape da aula.

Os botoes usam o sistema de templates do admin:

- icones derivados por `button-template-icons`;
- classes visuais dinamicas por template;
- abertura em nova aba.

## 7.7 Bloco de notas dentro da aula

`LessonNotesPanel` fica abaixo dos recursos.

### 7.7.1 Comportamento

- painel recolhivel;
- carrega a nota atual da aula;
- auto-save com debounce de 700ms;
- permite excluir a nota;
- mostra ultimo timestamp quando houver.

### 7.7.2 Visual

O bloco usa:

- cartao branco;
- badge `Bloco de Notas`;
- textarea ampla;
- mensagem de status de salvamento automatico.

## 7.8 Rodape sticky da aula

No final da pagina existe um rodape fixo com:

- botao `Marcar como Concluida` ou `Aula Concluida`;
- repeticao dos recursos principais;
- navegacao `Anterior`;
- navegacao principal para `Proxima Aula` ou `Ir para o Quiz do Modulo`.

Esse rodape e:

- `sticky bottom-4`;
- branco transluzido;
- com `backdrop-blur`.

## 7.9 Regras de navegacao sequencial

O timeline interno da aula percorre as aulas em ordem dos modulos.

Regras:

- `prevItem` aponta para a aula anterior;
- `nextItem` aponta para a proxima aula liberada;
- se a aula atual for a ultima do modulo e houver quiz modular:
  - o CTA principal passa a ser `Ir para o Quiz do Modulo`.

## 8. Pagina de avaliacao `StudentAssessmentExecutionPage`

## 8.1 Papel da tela

Executar quizzes modulares e prova final dentro do mesmo shell do player.

Ela suporta:

- multipla escolha;
- discursiva com IA;
- estudo de caso;
- interacoes gamificadas;
- hotspot de imagem;
- coloracao e outras modalidades vindas do motor de assessment.

## 8.2 Preparacao de dados

Ao abrir uma avaliacao, a tela carrega em paralelo:

1. estrutura da avaliacao;
2. ultima revisao do aluno;
3. eventual pedido de nova tentativa.

Chamadas principais:

- `fetchAssessmentForExecution`
- `fetchOwnAssessmentReview`
- `fetchOwnAssessmentAttemptRequest`

## 8.3 Estados de bloqueio antes da prova

A pagina trata explicitamente varios estados impeditivos antes de renderizar o formulario:

- quiz modular bloqueado por aulas incompletas;
- avaliacao com tentativas esgotadas;
- prova final bloqueada por modulo ou quiz obrigatorio pendente;
- erro de carregamento.

Cada estado tem sua propria tela dedicada com:

- icone central;
- fundo em gradiente suave;
- copy explicativa;
- CTA de retorno ou solicitacao.

## 8.4 Estrutura do formulario de avaliacao

Quando a prova esta disponivel, a experiencia segue a logica de `executionItems`, que podem ser:

- questao simples;
- bloco de estudo de caso com multiplas questoes.

A tela trabalha com:

- indice atual;
- percentual de progresso da avaliacao;
- estado de resposta por pergunta;
- tentativa ativa.

## 8.5 Tipos de pergunta

### 8.5.1 Multipla escolha

Opcoes aparecem como cards grandes com:

- borda forte;
- circulo de selecao;
- destaque azul quando selecionada;
- destaque verde em review aprovado perfeito.

### 8.5.2 Discursiva

Usa `textarea` grande, com:

- minimo de altura elevado;
- visual de resposta aberta;
- possibilidade de mostrar `Feedback da IA` em review.

### 8.5.3 Image hotspot

Usa `ImageHotspotInteraction`, com modo:

- `single_attempt`
- `find_all`

### 8.5.4 Outras interacoes gamificadas

Usa `GamifiedInteraction` e o schema `assessmentInteractionContentSchema`.

## 8.6 Submissao e refresh de estado

Ao enviar:

- a tela serializa respostas por tipo;
- chama `submitAssessmentAttempt`;
- atualiza modulos e assessments do player com `refreshCourseState`.

Isso garante que:

- aprovacoes liberem proximos passos;
- estados da sidebar reflitam imediatamente a tentativa enviada.

## 8.7 Tela de resultado

Quando `result` existe, a pagina deixa de mostrar o formulario e passa a renderizar um resumo de desempenho.

Elementos esperados:

- aprovacao ou reprovacao;
- score percentual;
- pontos obtidos;
- tentativas restantes;
- feedback por tipo de questao;
- CTA contextual para proximo modulo, prova final ou retorno ao curso.

## 8.8 Pedido de nova tentativa

Quando a avaliacao entra em `failed_limit`, o aluno pode:

- ver status do limite;
- ler resposta do administrador, se houver;
- solicitar nova tentativa.

Esse estado e importante para a prova final e para quizzes obrigatorios de modulo.

## 9. Regras de bloqueio e liberacao

## 9.1 Conteudo de modulo

Um modulo pode estar:

- livre;
- bloqueado;
- bloqueado por agenda.

Quando bloqueado:

- a sidebar desabilita clique;
- a grade curricular da pagina do curso exibe card de `Conteudo Bloqueado`.

## 9.2 Quiz de modulo

Um quiz modular so fica plenamente disponivel quando:

- o modulo esta liberado;
- todas as aulas do modulo foram concluidas, salvo preview admin.

## 9.3 Prova final

A prova final depende de:

- modulos obrigatorios concluidos;
- quizzes obrigatorios aprovados.

Quando algo impede a prova final, a tela tenta explicar o motivo com granularidade:

- modulo incompleto;
- quiz obrigatorio ainda nao aprovado;
- quiz obrigatorio com limite de tentativas atingido.

## 10. Iconografia e linguagem visual

## 10.1 Direcao estetica

O visualizador do aluno usa uma linguagem mais academica e operacional do que o site publico.

Padroes recorrentes:

- `slate` como base neutra;
- `blue` para progresso, foco e acao primaria;
- `emerald` para conclusao e aprovacao;
- `amber` para alerta e pre-condicao;
- `rose` para falha ou limite atingido.

## 10.2 Escala de cantos

O modulo do aluno usa cantos bem grandes:

- `rounded-[24px]`
- `rounded-[32px]`
- `rounded-[40px]`
- `rounded-[48px]`

Isso reforca a linguagem premium e difere da UI mais utilitaria do admin.

## 10.3 Tipografia

Predomina:

- titulos pesados com `font-black`;
- labels auxiliares em uppercase com tracking amplo;
- textos corridos com `font-medium`.

## 10.4 Icones

Ha mistura de:

- SVG inline em grande parte da experiencia;
- componentes especializados em fluxos de avaliacao;
- icones oriundos dos templates de botoes do admin para recursos da aula.

## 11. Estados de carregamento e erro

## 11.1 Carregamento

Padroes comuns:

- spinner circular azul;
- texto curto com tom humano;
- fundos claros e neutros.

Exemplos:

- `Povoando seu ecossistema...`
- `Preparando a sala de aula...`
- `Preparando ambiente de prova...`

## 11.2 Erros

Os erros costumam aparecer em cards centralizados com:

- icone forte;
- borda tintada;
- fundo de alerta;
- CTA de retorno.

## 12. Dependencias de backend relevantes

O visualizador depende fortemente de:

- RPCs de progresso por modulo e aula;
- RPC de status geral do curso;
- RPC de assessments do aluno;
- Edge Functions para execucao e submissao de avaliacao;
- storage para PDFs e recursos;
- tabelas de notas por aula;
- fluxo de narracao em audio.

## 13. Observacoes importantes do estado atual

1. A pagina de detalhes do curso e altamente informativa e mistura descoberta, acompanhamento e operacao.
2. O player usa um shell proprio, separado do layout padrao do aluno.
3. Admins visualizam essa experiencia em modo de preview sem travas reais.
4. O percentual macro do curso e modular, e nao calculado por aula.
5. A prova final possui regras de bloqueio explicadas de forma relativamente sofisticada para o aluno.
6. A experiencia da aula ja inclui uma camada rica de recursos: video, texto estruturado, PDF, audio IA e notas.
7. A experiencia de avaliacao ja suporta questoes interativas alem do quiz tradicional.

## 14. Resumo executivo

O visualizador de cursos do aluno na GenFlix e uma experiencia em duas camadas:

- uma pagina de detalhes orientada a progresso e leitura da trilha;
- um player focado em consumo de aula e execucao de avaliacao.

Visualmente, ele combina cards grandes, estados muito explicitos, cores de status bem marcadas e tipografia forte. Tecnicamente, ele depende de uma combinacao de RPCs de progresso, Edge Functions de assessment, storage para recursos e componentes locais de apoio, como notas e narracao em audio.

O resultado e um ambiente que funciona ao mesmo tempo como:

- vitrine interna do curso liberado;
- LMS de execucao;
- painel de acompanhamento academico do aluno.
