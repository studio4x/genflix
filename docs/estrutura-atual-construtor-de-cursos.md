# Estrutura Atual do Construtor de Cursos

## Objetivo

Este documento descreve a implementação atual do construtor de cursos do GenFlix no painel administrativo. O foco é registrar:

- estrutura funcional e rotas;
- composição de layout e navegação;
- componentes e painéis do builder;
- modelagem de dados usada pelo frontend;
- detalhes visuais, HTML/JSX, CSS e convenções de interface;
- integrações com Supabase e utilitários auxiliares.

O recorte documentado aqui corresponde ao builder acessado pela rota `/admin/cursos/:courseId/builder`.

## Mapa geral da implementação

### Arquivos centrais

- `src/app/router/index.tsx`
- `src/app/layouts/admin-course-builder-layout.tsx`
- `src/features/admin/content/components/course-tree-dnd.tsx`
- `src/pages/admin/builder/course-overview-panel.tsx`
- `src/pages/admin/builder/module-editor-panel.tsx`
- `src/pages/admin/builder/lesson-editor-panel.tsx`
- `src/pages/admin/builder/lesson-materials-panel.tsx`
- `src/pages/admin/builder/course-settings-panel.tsx`
- `src/pages/admin/builder/course-assessments-panel.tsx`
- `src/pages/admin/builder/assessment-builder-panel.tsx`
- `src/features/admin/content/api.ts`
- `src/features/admin/content/content-blocks.ts`
- `src/types/content.ts`
- `src/index.css`
- `src/components/ui/button.tsx`

### Rotas do builder

Em [src/app/router/index.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/app/router/index.tsx:1), o construtor é montado como um layout pai com `Outlet` e subrotas internas:

- `/admin/cursos/:courseId/builder`
  - visão geral do curso;
- `/admin/cursos/:courseId/builder/modulos/:moduleId`
  - editor de módulo;
- `/admin/cursos/:courseId/builder/modulos/:moduleId/aulas/:lessonId`
  - editor de aula;
- `/admin/cursos/:courseId/builder/modulos/:moduleId/aulas/:lessonId/materiais`
  - gestão de botões/arquivos do rodapé da aula;
- `/admin/cursos/:courseId/builder/modulos/:moduleId/avaliacoes/:assessmentId`
  - builder de quiz por módulo;
- `/admin/cursos/:courseId/builder/assessments/final`
  - builder da avaliação final;
- `/admin/cursos/:courseId/builder/settings`
  - configurações do curso;
- `/admin/cursos/:courseId/builder/releases`
  - liberação para alunos e grupos;
- `/admin/cursos/:courseId/builder/assessments`
  - painel agregador de avaliações.

## Arquitetura de layout

### Layout raiz do builder

O shell do construtor está em [src/app/layouts/admin-course-builder-layout.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/app/layouts/admin-course-builder-layout.tsx:1).

Ele faz cinco coisas principais:

1. lê `courseId` da URL;
2. carrega a árvore completa do curso com `fetchAdminCourseTree(courseId)`;
3. expõe `courseTree`, `refreshTree` e `isLoading` via `BuilderContext`;
4. desenha o frame visual do builder;
5. injeta os painéis filhos via `<Outlet />`.

### Estrutura visual macro

O HTML/JSX raiz é basicamente:

- `div.relative.flex.h-screen.w-full.flex-col`
  - `header`
  - `div.flex.flex-1.overflow-hidden`
    - `aside`
    - `main`
  - modais globais
  - selo de versão do build

Na prática isso define um workspace de tela cheia, dividido verticalmente em:

- topbar fixa;
- faixa central com sidebar à esquerda e canvas principal à direita;
- modais em `fixed inset-0`;
- versão no canto inferior direito.

### Topbar

A topbar contém:

- botão de voltar para `/admin/cursos`;
- botão de recolher sidebar;
- título do curso;
- badge de status `Publicado` ou `Rascunho`;
- botão `Visualizar` para abrir a visão do aluno em nova aba.

Padrão visual:

- altura curta: `h-14`;
- fundo branco;
- borda inferior `border-slate-200`;
- sombra discreta `shadow-sm`;
- texto em `slate`;
- ação principal em botões `ghost` ou `outline`.

### Sidebar

A sidebar é um `aside` colapsável controlado por `isSidebarOpen`.

Características:

- largura aberta fixa: `w-[252px]`;
- fundo branco;
- borda direita;
- transição suave `transition-all duration-300`;
- conteúdo principal: árvore do curso com drag and drop;
- rodapé da sidebar: links rápidos e ações de importação/exportação.

### Main canvas

O painel principal é:

- `main.flex-1.h-full.bg-slate-50/50.relative.overflow-y-auto.w-full`
- com um wrapper interno absoluto `inset-0 p-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7`.

Isso produz:

- scroll independente do conteúdo principal;
- sidebar e topbar permanecendo estáveis;
- espaçamento lateral responsivo;
- sensação de “canvas administrativo” em cima de um fundo cinza muito claro.

## Contexto e fluxo de dados

### BuilderContext

O builder usa um contexto simples:

- `courseTree: AdminCourseTree | null`
- `refreshTree: () => Promise<void>`
- `isLoading: boolean`

Isso centraliza o estado do curso completo e evita recargas dispersas entre painéis.

### Tipo `AdminCourseTree`

Definido em [src/features/admin/content/api.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/api.ts:1), o payload do builder reúne:

- `course`
- `modules`
  - cada módulo com `lessons`
  - cada módulo com `assessments`
- `courseAssessments`
  - avaliações de nível de curso, tipicamente a final.

Essa decisão é importante porque o frontend trabalha majoritariamente sobre uma árvore já agregada, e não sobre várias consultas pontuais por painel.

### Fontes de dados

O builder conversa com o Supabase via:

- tabelas `courses`, `course_modules`, `lessons`, `assessments`;
- tabelas auxiliares de perguntas, opções, estudos de caso e botões;
- buckets de storage:
  - `thumbnails`
  - `module-pdfs`
  - `lesson-footer-assets`
  - `lesson-content-assets`
  - `materials`

## Estrutura funcional por painel

### 1. Visão geral do curso

Arquivo: [src/pages/admin/builder/course-overview-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-overview-panel.tsx:1)

Função:

- dashboard resumido do curso dentro do builder.

Conteúdo:

- cabeçalho textual;
- cards de métricas:
  - módulos;
  - aulas;
  - duração estimada;
- mapa expandido do curso;
- bloco da avaliação final;
- entrada para análise com IA por módulo;
- modais de histórico e aplicação de revisão.

HTML/JSX dominante:

- `div.space-y-8`;
- `div.grid md:grid-cols-3` para cards de métricas;
- `div.rounded-2xl border bg-white shadow-sm` para cartões;
- módulos renderizados em lista vertical com cabeçalhos, badges e links.

Visualmente é um painel de overview clássico de admin:

- muito branco;
- bordas leves;
- métricas grandes em `text-3xl font-black`;
- labels pequenos em `uppercase tracking-widest`;
- uso forte de azul para ações e verde/âmbar para estados.

### 2. Editor de módulo

Arquivo: [src/pages/admin/builder/module-editor-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/module-editor-panel.tsx:1)

Função:

- criar ou editar um módulo;
- configurar nome, descrição, obrigatoriedade e regras de liberação;
- gerenciar PDF base do módulo;
- executar revisão com IA e aplicar ajustes.

Campos principais:

- título;
- descrição;
- `is_required`;
- `starts_at`;
- `ends_at`;
- `release_days_after_enrollment`.

Blocos visuais:

- card branco do formulário;
- toggle em caixa azul clara para obrigatoriedade;
- seção “Liberação Programada” com dois `datetime-local`;
- caixa extra para “Liberar após X dias da inscrição”;
- card para PDF base;
- rodapé com ações `Excluir Módulo` e `Salvar Alterações`.

HTML/JSX:

- `form.bg-white.rounded-2xl.border.shadow-sm.overflow-hidden`;
- inputs com `rounded-xl border border-slate-200 bg-slate-50/50`;
- seções agrupadas por `div.rounded-[24px]` e `div.rounded-2xl`.

Observação visual importante:

- embora o JSX use muitos `rounded-2xl`, `rounded-[24px]` e similares, o CSS global padroniza quase tudo para cantos menores.

### 3. Editor de aula

Arquivo: [src/pages/admin/builder/lesson-editor-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/lesson-editor-panel.tsx:1)

É o painel mais rico do builder hoje.

Funções:

- criar ou editar aula;
- alternar formato pedagógico:
  - `video`
  - `text`
  - `hybrid`
- editar conteúdo textual em blocos;
- configurar YouTube;
- moderar solicitações de narração;
- visualizar player de áudio administrativo;
- acessar materiais/botões do rodapé;
- definir duração e regras de conclusão.

#### Estrutura do formulário

O formulário é dividido em fieldsets numerados:

- `01 Identificação da Aula`
- `02 Formato Pedagógico`
- `03 Configurações de Conclusão`

Isso dá uma cara de wizard linear, embora tudo esteja numa única tela.

#### Alternância de tipo de aula

Há um seletor visual em grade `sm:grid-cols-3`, com botões tab-like:

- `Apenas Vídeo`
- `Apenas Texto`
- `Vídeo + Texto`

O estado ativo recebe:

- fundo branco;
- texto azul;
- `shadow-sm`;
- `ring-1 ring-slate-200`.

O estado inativo usa:

- texto cinza;
- hover mais escuro.

#### Conteúdo em blocos

Quando a aula é `text` ou `hybrid`, o conteúdo não é um campo HTML único na UI. Ele é quebrado em blocos:

- `rich-text`
- `table`
- `image-hotspots`

Essa lógica fica em [src/features/admin/content/content-blocks.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/content-blocks.ts:1).

O pipeline é:

1. carregar `text_content` salvo;
2. `splitContent(...)` separa trechos ricos, tabelas e blocos especiais;
3. o usuário edita cada bloco separadamente;
4. `mergeContent(...)` recompõe o HTML final antes de salvar.

#### Bloco de texto rico

Usa [src/components/forms/react-quill.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/components/forms/react-quill.tsx:1), mas o componente atual é um editor local baseado em `contentEditable`, não o `react-quill` oficial.

Ele entrega:

- toolbar simples;
- `execCommand`;
- área editável com placeholder;
- HTML retornado via `onInput` e `onBlur`.

Visualmente:

- toolbar cinza clara;
- botões brancos pequenos;
- área interna com bastante padding;
- borda sutil.

Além disso, o próprio `lesson-editor-panel.tsx` injeta um `<style>` local para simular aparência de Quill:

- `.quill`
- `.ql-toolbar`
- `.ql-container`
- `.ql-editor`

#### Bloco de tabela

O bloco de tabela tem duas partes:

- preview renderizado com `dangerouslySetInnerHTML`;
- textarea monoespaçada para editar HTML cru da tabela.

A preview aparece numa caixa branca com borda azul clara e label “Preview da Tabela”.
O editor cru aparece em fundo `slate-900` com texto `emerald-400`, reforçando visual de código.

#### Bloco de hotspots

O bloco `image-hotspots` usa o componente `LessonImageHotspotsBlockEditor`.

Conceitualmente ele encapsula:

- imagem base;
- largura/altura;
- lista de hotspots;
- coordenadas percentuais `x/y`;
- título e `body_html` por hotspot.

O conteúdo é serializado como um `div` com atributos `data-hcm-block` e `data-hcm-payload`, preservando o bloco especial dentro do HTML da aula.

#### Botões de manipulação de blocos

Cada bloco tem controles de:

- subir;
- descer;
- excluir.

Esses controles:

- só ganham opacidade total no hover do grupo;
- usam ícones do `lucide-react`;
- ficam visualmente discretos até o foco do usuário.

### 4. Materiais e botões do rodapé da aula

Arquivo: [src/pages/admin/builder/lesson-materials-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/lesson-materials-panel.tsx:1)

Função:

- gerenciar ações de rodapé da aula que aparecem no player do aluno.

Tipos de ação:

- arquivo;
- URL.

Estrutura visual em duas colunas:

- coluna esquerda:
  - escolha de template visual;
  - preview do botão;
  - upload de arquivo;
  - criação de link;
- coluna direita:
  - lista de ações já configuradas.

HTML/JSX dominante:

- `grid xl:grid-cols-[380px_minmax(0,1fr)]`;
- ambos os painéis em `rounded-[28px] border bg-white shadow-sm`.

Isso cria uma tela muito clara, com side panel operacional e uma lista de cards à direita.

### 5. Configurações do curso

Arquivo: [src/pages/admin/builder/course-settings-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-settings-panel.tsx:1)

Função:

- editar metadados principais do curso;
- configurar capa, slug, lançamento e preço;
- definir visibilidade pública;
- associar criador e comissão;
- configurar progressão linear;
- habilitar tipos de quiz;
- parametrizar padrões da IA;
- resetar progresso de alunos.

Seções principais:

- capa do curso;
- nome e metadados comerciais;
- descrição detalhada;
- status;
- progressão linear;
- tipos de quiz disponíveis;
- padrões do curso perfeito;
- renovação de progresso.

Visualmente, este é um painel mais “produto/comercial” do que “conteúdo”:

- muitos blocos em destaque;
- cards coloridos em `cyan`, `blue`, `violet`, `rose`;
- upload de thumb com área grande 4:3;
- uso intenso de headings e subtítulos.

### 6. Gestão de avaliações

Arquivo: [src/pages/admin/builder/course-assessments-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-assessments-panel.tsx:1)

Função:

- consolidar avaliação final e quizzes por módulo;
- criar, editar, excluir;
- importar/exportar JSON de IA.

A tela é composta por:

- card da avaliação final;
- seção listando todos os módulos com seus quizzes;
- modal de importação JSON.

É uma camada de navegação/organização, enquanto a edição profunda ocorre no `AssessmentBuilderPanel`.

### 7. Builder de avaliações

Arquivo: [src/pages/admin/builder/assessment-builder-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/assessment-builder-panel.tsx:1)

É o painel mais complexo do construtor junto com o editor de aula.

Função:

- criar avaliação final ou quiz de módulo;
- editar metadados da avaliação;
- criar perguntas;
- criar estudos de caso;
- configurar tipos gamificados;
- importar conteúdo estruturado de IA.

Tipos de questão suportados:

- `single_choice`
- `essay_ai`
- `case_study_ai`
- `case_study_single_choice`
- `drag_drop_labeling`
- `fill_in_the_blanks`
- `image_hotspot`
- `coloring`

Elementos visuais centrais:

- cabeçalho com resumo da regra de aprovação;
- cards de métrica de pontuação;
- cartões de perguntas;
- cartões de estudos de caso;
- grade de “Adicionar tipo de quiz” com botões grandes tracejados;
- modal para escolher modalidade de `image_hotspot`;
- modal de importação JSON.

Esse painel é mais “builder de objetos” que “formulário clássico”, com várias regiões dinâmicas e persistência incremental.

## Árvore lateral e navegação estrutural

Arquivo: [src/features/admin/content/components/course-tree-dnd.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/components/course-tree-dnd.tsx:1)

### Papel da árvore

A sidebar é a espinha dorsal do builder.

Ela exibe:

- visão geral do curso;
- módulos;
- aulas por módulo;
- quizzes por módulo;
- avaliação final;
- ações rápidas de criação.

### Drag and drop

Implementado com `@hello-pangea/dnd`.

Suporta:

- reordenação de módulos;
- reordenação de aulas dentro do módulo.

Não reordena quizzes nessa versão.

### Estrutura visual

Padrões de leitura:

- módulo:
  - linha mais robusta;
  - marcador `M1`, `M2`, etc.;
  - drag handle à esquerda;
  - lixeira visível no hover;
- aula:
  - indentada;
  - linha menor;
  - ícone por tipo:
    - vídeo;
    - texto;
  - destaque azul quando ativa;
- quiz:
  - linha de tonalidade âmbar;
  - ícone de escudo/check;
- avaliação final:
  - bloco separado com acento esverdeado.

### Hierarquia visual

Há uma linha vertical `border-l-2 border-slate-100` conectando as aulas e quizzes ao módulo pai, criando leitura clara de árvore.

### HTML/JSX recorrente

- `Link` como wrapper clicável de quase todos os nós;
- `button` para exclusão;
- `div.group` para hover contextual;
- `opacity-0 group-hover:opacity-100` para controles discretos.

## Detalhes de dados e modelagem

Arquivo base: [src/types/content.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/types/content.ts:1)

### Entidades principais

- `Course`
- `CourseModule`
- `Lesson`
- `Assessment`
- `AssessmentQuestion`
- `AssessmentCaseStudy`
- `AssessmentOption`
- `LessonFooterAction`
- `ButtonTemplate`

### Curso

Além dos campos tradicionais, o curso tem:

- `is_public`;
- `creator_id`;
- `creator_commission_percent`;
- `has_linear_progression`;
- `quiz_type_settings`.

### Módulo

O módulo possui:

- ordem `position`;
- obrigatoriedade;
- janela de liberação;
- `release_days_after_enrollment`;
- PDF base com metadados de storage.

### Aula

A aula possui:

- `lesson_type`:
  - `video`
  - `text`
  - `hybrid`;
- `youtube_url`;
- `text_content`;
- `estimated_minutes`;
- janelas de liberação.

### Conteúdo especial da aula

O HTML da aula pode conter:

- rich text comum;
- tabelas HTML sanitizadas;
- bloco serializado de hotspots de imagem.

### Avaliações

As avaliações suportam:

- nível módulo ou final;
- nota mínima;
- número máximo de tentativas;
- tempo estimado;
- perguntas com interação;
- answer key;
- modos de correção parcial ou all-or-nothing.

## Camada de API do builder

Arquivo: [src/features/admin/content/api.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/api.ts:1)

### Operações principais

- buscar curso;
- buscar módulos;
- buscar aulas;
- criar/editar/excluir curso;
- criar/editar/excluir módulo;
- criar/editar/excluir aula;
- reordenar módulos e aulas;
- upload de thumbnail;
- upload/remoção de PDF de módulo;
- upload/remoção de assets de conteúdo da aula;
- CRUD de botões do rodapé;
- exportar módulo;
- exportar curso;
- limpar curso;
- importar curso completo;
- importar módulos;
- importar avaliação final.

### Estratégia de importação

O builder possui forte suporte a importação de JSON gerado por IA.

Há três cenários:

- importação de curso completo;
- importação de módulos;
- importação de avaliação.

Recursos relevantes:

- limpeza opcional do curso inteiro;
- substituição de um módulo específico “in place”;
- normalização de JSON vindo dentro de blocos markdown;
- exportação espelhada em JSON para round-trip.

## HTML/JSX: padrões estruturais recorrentes

Embora o projeto use React, a composição segue uma gramática visual bem consistente.

### Containers

Os painéis usam repetidamente:

- `bg-white`
- `border border-slate-200`
- `shadow-sm`
- `overflow-hidden`

Isso cria cartões administrativos uniformes.

### Cabeçalhos de seção

Padrão típico:

- título grande em `font-black` ou `font-extrabold`;
- subtítulo curto em `text-sm text-slate-500`;
- divisória com `border-b`.

### Labels

Labels e micro-headings usam muito:

- `text-xs` ou `text-[10px]`;
- `font-black`;
- `uppercase`;
- `tracking-widest`.

Isso dá um aspecto editorial/técnico e melhora escaneabilidade.

### Inputs

Padrão recorrente:

- fundo `bg-slate-50/50` ou `bg-white`;
- borda `border-slate-200`;
- padding generoso;
- foco com ring azul;
- tipografia mais pesada que o default.

### Ações

Botões aparecem em três famílias:

- `default`/azul-gradiente;
- `outline`;
- `ghost`.

O componente base está em [src/components/ui/button.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/components/ui/button.tsx:1) e depois recebe muitas classes extras diretamente nos painéis.

## CSS e linguagem visual

Arquivo principal: [src/index.css](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/index.css:1)

### Base tipográfica

Fontes carregadas:

- `Geist Variable`
- `Manrope`
- `Readex Pro`

Na prática:

- `Geist` domina a base;
- `Manrope` e `Readex Pro` aparecem como assets disponíveis para outras áreas;
- o builder em si usa majoritariamente a pilha sans principal.

### Paleta

A identidade visual é guiada por variáveis CSS:

- `--genflix-accent: #1398b7`
- `--genflix-accent-hover: #0a3640`
- `--genflix-brand-gradient`
- `--genflix-bg-main`
- `--genflix-bg-soft`
- `--genflix-border-soft`

Apesar do JSX usar nomes como `blue`, `cyan`, `sky`, `teal`, o CSS global remapeia essas classes para a identidade GenFlix.

Consequência prática:

- `bg-blue-600` frequentemente não resulta num azul Tailwind puro;
- ela é sobrescrita para o gradiente/acento da marca;
- o builder inteiro fica visualmente coeso mesmo com classes semânticas variadas.

### Arredondamento global

Há uma decisão forte no CSS:

- várias classes `rounded-*` são normalizadas para raios menores via `!important`.

Então, mesmo quando o JSX sugere cantos grandes, o visual final tende a ser mais sóbrio e “quadrado”.

### Sombras

Sombras também são padronizadas para algo discreto:

- `0 4px 10px rgba(21, 50, 59, 0.06)`

Isso evita o visual exagerado de cards flutuando demais.

### Quill/editor rico

O CSS global define estilos para:

- `.quill`
- `.ql-toolbar.ql-snow`
- `.ql-container.ql-snow`
- `.ql-editor`

Mesmo com o editor atual sendo um wrapper customizado, o projeto conserva nomenclatura e aparência semelhantes às do Quill.

### Tabelas

Tabelas têm estilos globais importantes:

- largura 100%;
- bordas colapsadas;
- `th` com fundo claro;
- zebra em linhas pares;
- placeholder visual para célula vazia com `data-empty-cell="true"`.

Isso é relevante porque o builder de aula depende muito do HTML de tabela ser previsível e legível.

## Comportamentos especiais e diferenciais do builder

### 1. Revisão com IA

Presente em:

- visão geral do curso;
- editor de módulo.

O fluxo atual:

- analisar módulo;
- exibir score, resumo, issues e custo/token usage;
- opcionalmente aplicar ajustes;
- registrar histórico;
- publicar notice global de processamento.

### 2. Importação/exportação para IA

O builder foi claramente desenhado para operação híbrida humano + IA.

Sinais disso:

- múltiplos modais de JSON;
- limpeza e substituição de conteúdo;
- exportação de curso completo, módulo e avaliação;
- importação estruturada de quizzes;
- tratamento de JSON vindo com markdown fences.

### 3. Conteúdo de aula híbrido

A aula não é um simples `textarea` HTML.

O sistema já suporta:

- editor rico;
- editor de tabela com preview;
- bloco interativo de hotspots.

Isso torna o builder mais próximo de um page builder educacional do que de um CRUD simples.

### 4. Progressão pedagógica

O builder não edita só conteúdo visual. Ele também configura regras de aprendizagem:

- obrigatoriedade de módulos e aulas;
- datas de liberação;
- liberação relativa à inscrição;
- progressão linear;
- avaliação final;
- nota mínima e tentativas.

## Leitura crítica do layout atual

### Forças

- boa separação entre navegação estrutural e edição;
- árvore lateral funciona bem como mapa mental do curso;
- formulários amplos e escaneáveis;
- visual consistente entre módulos, aulas, avaliações e configurações;
- bom suporte a fluxos avançados com IA;
- builder de aula já suporta conteúdo rico real, não apenas texto.

### Características visuais marcantes

- fundo geral claro e neutro;
- muitos cartões brancos;
- baixa densidade visual;
- labels pequenas em uppercase;
- CTAs azuis da marca;
- estados verde/âmbar/rosa para feedback;
- bordas suaves e sombras discretas;
- forte uso de `slate` para hierarquia textual.

### Trade-offs percebidos

- parte do JSX sugere um visual mais “rounded/luxuoso”, mas o CSS global aplaina isso;
- existe mistura entre classes locais e sobrescritas globais, o que dificulta prever aparência final apenas lendo o JSX;
- o `ReactQuill` atual é um editor customizado simplificado, então a nomenclatura “Quill” no código é maior do que a biblioteca efetivamente usada.

## Resumo estrutural

Hoje o construtor de cursos do GenFlix é um sistema administrativo composto por:

- um layout mestre full-screen com topbar, sidebar em árvore e canvas principal;
- uma árvore pedagógica centralizada em `AdminCourseTree`;
- painéis especializados para curso, módulo, aula, materiais e avaliações;
- uma camada de persistência direta no Supabase;
- forte suporte a JSON de IA para importar/exportar estrutura;
- uma linguagem visual administrativa consistente, minimalista e fortemente ancorada na paleta da marca.

Em termos de maturidade, o builder atual já vai além de um CRUD convencional. Ele funciona como um editor de estrutura pedagógica, conteúdo multimodal e avaliação, com recursos operacionais suficientes para manutenção contínua de um catálogo educacional complexo.
