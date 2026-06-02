# Estrutura Atual do Construtor de Cursos

## Objetivo

Este documento descreve em detalhe a implementação atual do construtor de cursos do GenFlix no painel administrativo. O foco aqui não é só listar arquivos, mas registrar:

- rotas e arquitetura do builder;
- composição de layout, HTML/JSX e linguagem visual;
- funcionalidades reais de cada tela principal;
- estrutura atual de módulos, aulas, quizzes e avaliação final;
- regras de importação/exportação em JSON;
- pontos de integração com Supabase, storage e utilitários internos.

O recorte documentado corresponde ao builder aberto dentro do admin, especialmente nas rotas:

- `/admin/cursos/:courseId/builder`
- `/admin/cursos/:courseId/builder/m?dulos/:moduleId`
- `/admin/cursos/:courseId/builder/m?dulos/:moduleId/aulas/:lessonId`
- `/admin/cursos/:courseId/builder/m?dulos/:moduleId/avalia??es/:assessmentId`
- `/admin/cursos/:courseId/builder/assessments/final`
- `/admin/cursos/:courseId/builder/settings`
- `/admin/cursos/:courseId/builder/assessments`

## Arquivos centrais

### Layout, rotas e shell do builder

- [src/app/router/index.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/app/router/index.tsx:1)
- [src/app/layouts/admin-course-builder-layout.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/app/layouts/admin-course-builder-layout.tsx:1)
- [src/features/admin/content/components/course-tree-dnd.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/components/course-tree-dnd.tsx:1)

### Painéis principais

- [src/pages/admin/builder/course-overview-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-overview-panel.tsx:1)
- [src/pages/admin/builder/module-editor-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/module-editor-panel.tsx:1)
- [src/pages/admin/builder/lesson-editor-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/lesson-editor-panel.tsx:1)
- [src/pages/admin/builder/lesson-materials-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/lesson-materials-panel.tsx:1)
- [src/pages/admin/builder/course-settings-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-settings-panel.tsx:1)
- [src/pages/admin/builder/course-assessments-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-assessments-panel.tsx:1)
- [src/pages/admin/builder/assessment-builder-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/assessment-builder-panel.tsx:1)

### Estruturas auxiliares

- [src/features/admin/content/api.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/api.ts:1)
- [src/features/admin/content/content-blocks.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/content-blocks.ts:1)
- [src/features/admin/assessments/gamified-question-editor.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/assessments/gamified-question-editor.tsx:1)
- [src/features/assessments/gamified.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/assessments/gamified.ts:1)
- [src/types/content.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/types/content.ts:1)
- [src/index.css](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/index.css:1)

## Mapa de rotas do builder

Em [src/app/router/index.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/app/router/index.tsx:1), o builder funciona como um layout pai com `Outlet` e subrotas filhas:

- `/admin/cursos/:courseId/builder`
  Centro de controle do curso, resumo geral e mapa macro.
- `/admin/cursos/:courseId/builder/m?dulos/novo`
  Criação de módulo.
- `/admin/cursos/:courseId/builder/m?dulos/:moduleId`
  Configurações completas do módulo.
- `/admin/cursos/:courseId/builder/m?dulos/:moduleId/aulas/nova`
  Criação de aula.
- `/admin/cursos/:courseId/builder/m?dulos/:moduleId/aulas/:lessonId`
  Editor completo da aula.
- `/admin/cursos/:courseId/builder/m?dulos/:moduleId/aulas/:lessonId/materiais`
  Gestão de botões e URLs no rodapé da aula.
- `/admin/cursos/:courseId/builder/m?dulos/:moduleId/avalia??es/nova`
  Criação de quiz do módulo.
- `/admin/cursos/:courseId/builder/m?dulos/:moduleId/avalia??es/:assessmentId`
  Builder do quiz do módulo.
- `/admin/cursos/:courseId/builder/assessments/final`
  Builder da avaliação final do curso.
- `/admin/cursos/:courseId/builder/settings`
  Configurações comerciais, pedagógicas e de IA do curso.
- `/admin/cursos/:courseId/builder/releases`
  Atribuição a alunos e grupos.
- `/admin/cursos/:courseId/builder/assessments`
  Hub agregador de quizzes e avaliação final.

## Arquitetura de layout do builder

### Layout raiz

O shell principal está em [src/app/layouts/admin-course-builder-layout.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/app/layouts/admin-course-builder-layout.tsx:1).

Ele executa cinco funções principais:

1. lê `courseId` da URL;
2. carrega a árvore consolidada com `fetchAdminCourseTree(courseId)`;
3. expõe `courseTree`, `refreshTree` e `isLoading` por `BuilderContext`;
4. monta o frame visual do workspace;
5. injeta os painéis internos via `<Outlet />`.

### Estrutura HTML/JSX macro

A composição principal é:

- `div.relative.flex.h-screen.w-full.flex-col.overflow-hidden`
  - `header`
  - `div.flex.flex-1.overflow-hidden`
    - `aside`
    - `main`
  - modais globais
  - `AppVersion`

Isso produz uma aplicação full-screen com:

- topbar horizontal fixa no topo;
- sidebar estrutural colapsável à esquerda;
- canvas principal com scroll vertical próprio;
- modais flutuantes centralizados;
- selo de build no canto inferior direito.

### Topbar

A topbar usa:

- `h-14`
- `border-b border-slate-200`
- `bg-white`
- `shadow-sm`
- `z-20`

Conteúdo:

- botão `Voltar`;
- separador vertical;
- botão de colapsar sidebar;
- título do curso;
- badge de status `Publicado` ou `Rascunho`;
- botão `Visualizar`, que abre a visão do aluno em nova aba.

Visualmente:

- tipografia compacta;
- ícones inline em SVG;
- predominância de branco, cinza e azul;
- aparência de ferramenta administrativa, não de landing page.

### Sidebar

A sidebar é um `aside` colapsável com:

- largura aberta `w-[252px]`;
- `bg-white`;
- `border-r border-slate-200`;
- `transition-all duration-300`.

Ela contém:

- árvore do curso com drag and drop;
- links rápidos para `Configurações do Curso`, `Atribuir a Alunos e Grupos` e `Gerenciar Avaliações`;
- ações de `Exportar Conteúdo` e `Importar Conteúdo (IA)`.

### Canvas principal

O conteúdo principal usa:

- `main.flex-1.h-full.bg-slate-50/50.relative.overflow-y-auto.w-full.border-t.border-slate-100.shadow-inner`
- wrapper interno `absolute inset-0 p-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7`

Consequências práticas:

- a sidebar não rola junto com o painel principal;
- o conteúdo interno sempre respira com padding consistente;
- o fundo levemente cinza reforça a leitura de cartões brancos.

## Fluxo de dados do builder

### BuilderContext

O contexto expõe:

- `courseTree: AdminCourseTree | null`
- `refreshTree: () => Promise<void>`
- `isLoading: boolean`

### Estrutura `AdminCourseTree`

Definida em [src/features/admin/content/api.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/api.ts:1), ela reúne:

- `course`
- `modules`
  - cada módulo com `lessons`
  - cada módulo com `assessments`
- `courseAssessments`

Essa árvore é o eixo do builder inteiro. Quase todas as telas dependem dela para:

- exibir a navegação lateral;
- montar métricas;
- localizar módulo ou aula atual;
- recalcular a interface após CRUD e importações.

### Tabelas e buckets mais relevantes

Tabelas:

- `courses`
- `course_modules`
- `lessons`
- `assessments`
- `assessment_questions`
- `assessment_options`
- `assessment_case_studies`
- `lesson_footer_actions`
- `button_templates`

Buckets:

- `thumbnails`
- `module-pdfs`
- `lesson-footer-assets`
- `lesson-content-assets`
- `materials`

## Página inicial do builder

### Rota

- exemplo: `https://genflix-omega.vercel.app/admin/cursos/:courseId/builder`
- arquivo: [course-overview-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-overview-panel.tsx:1)

### Papel funcional

Esta é a tela de entrada do construtor. Ela funciona como um centro de controle do curso e não como um formulário tradicional.

Ela reúne:

- métricas gerais;
- mapa expandido da hierarquia do curso;
- acesso direto para editar módulos, aulas e quizzes;
- visão da avaliação final;
- revisão com IA por módulo;
- histórico de revisões e aplicação de correções.

### Estrutura visual e layout

Wrapper principal:

- `div.w-full.space-y-8.pb-12.animate-in.fade-in.duration-500`

Blocos principais:

- cabeçalho superior com título e subtítulo;
- banner de erro ou sucesso;
- grid de métricas em 3 colunas;
- card grande `Mapa do Curso`;
- card `Avaliação Final`;
- modais de IA.

### Cabeçalho da página

O topo da tela usa:

- `border-b border-slate-200 pb-5`
- `h2.text-3xl.font-extrabold`
- parágrafo curto em `text-sm text-slate-500`

Ele comunica que a tela é um resumo e um ponto de navegação, não um editor de campo único.

### Cards de métricas

A grade usa:

- `grid grid-cols-1 gap-6 md:grid-cols-3`

Os três cards atuais mostram:

- quantidade de módulos;
- quantidade de aulas;
- duração estimada total do curso.

Cada card é:

- branco;
- centralizado;
- com ícone em círculo azul claro;
- valor grande em `text-3xl font-black`;
- rótulo pequeno em uppercase.

### Mapa do Curso

O bloco principal do overview tem duas camadas:

- cabeçalho do card com título, descrição e CTA `Adicionar Módulo`;
- corpo com a hierarquia dos módulos, aulas e quizzes.

Cada módulo aparece como card próprio, contendo:

- número sequencial `Módulo N`;
- badge `Obrigatório` se `is_required` estiver ativo;
- título do módulo;
- botões `Ultimas revis?es`, `Analisar com IA`, `Editar Módulo`, excluir;
- lista interna de aulas e quizzes.

Cada aula no mapa mostra:

- título;
- tipo pedagógico;
- link direto ao editor;
- exclusão direta.

Cada quiz do módulo mostra:

- título;
- passagem para o builder de avaliações;
- exclusão direta.

### Avaliação final no overview

A parte final da tela exibe:

- quizzes finais do curso, se existirem;
- título da avaliação;
- nota mínima;
- tentativas;
- botões `Editar` e excluir.

### Funcionalidades de IA nest? tela

O overview tem forte integração com revisão de módulo por IA:

- `Analisar com IA`
- reaproveitamento de análise já existente;
- histórico por módulo;
- modal completo com score, resumo, issues, custo e tokens;
- ação `Implementar Ajustes`.

O fluxo atual:

1. o usuário pede análise;
2. a IA devolve `quality_score`, `summary`, `issues` e, opcionalmente, `corrected_module`;
3. o resultado pode ser salvo em histórico;
4. o usuário pode aplicar a correção;
5. a aplicação reimporta o módulo com `importCourseContent`.

### Leitura visual da tela

É uma tela de dashboard administrativo clássica:

- muitos cards brancos;
- bordas leves;
- azul para ação primária;
- verde para est?do positivo;
- âmbar e rosa para alertas;
- conteúdo muito escaneável;
- baixa densidade e bastante espaçamento vertical.

## Configurações do módulo

### Rota

- exemplo: `https://genflix-omega.vercel.app/admin/cursos/:courseId/builder/m?dulos/:moduleId`
- arquivo: [module-editor-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/module-editor-panel.tsx:1)

### Papel funcional

Esta tela edita os metadados e as regras de liberação de um módulo específico.

Ela cobre:

- título;
- descrição;
- obrigatoriedade;
- janela de liberação;
- liberação após X dias da inscrição;
- PDF base do módulo;
- revisão com IA e histórico.

### Estrutura visual

Wrapper:

- `div.w-full.space-y-6.animate-in.fade-in.duration-500`

Blocos:

- cabeçalho da tela;
- barra de ações de IA;
- formulário principal;
- modais de IA.

### Cabeçalho

O topo alterna entre:

- `Criar N?ovo Módulo`
- `Configurações do Módulo`

Subtítulo:

- quando novo, explica que o módulo será uma seção principal do curso;
- quando existente, explica que ali se atualizam detalhes e restrições.

### Formulário principal

O formulário usa:

- `form.bg-white.rounded-2xl.border.border-slate-200.shadow-sm.overflow-hidden`

O corpo interno é:

- `p-6 md:p-8 space-y-6`

Campos atuais:

- `Capa / Título do Módulo`
- `Descrição Organizacional`
- toggle `Exigir Conclusão deste Módulo`
- bloco `Liberação Programada`
  - `Liberar em`
  - `Expirar em`
- bloco `Liberar após X dias da inscrição`

### Regra de liberação do módulo

Esse ponto é importante funcionalmente:

- o módulo pode ter data de início;
- data de fim;
- número de dias após inscrição;
- se houver data e número de dias, as regras são cumulativas.

Ou seja, o módulo só libera quando todas as condições aplicáveis forem atendidas.

### PDF base do módulo

Quando o módulo já existe, surge um card adicional:

- nome do PDF atual ou est?do vazio;
- descrição explicando que o aluno receberá versão licenciada com marca d'água;
- botão `Enviar PDF`;
- botão `Remover PDF`, se já houver arquivo.

### Rodapé do formulário

O rodapé tem:

- botão `Excluir Módulo`, quando não é criação;
- botão `Salvar Alterações`.

### Revisão com IA no módulo

A tela do módulo tem um segundo eixo além do CRUD:

- `Analisar com IA`
- `Ver ajustes realizados`
- histórico de revisão;
- modal de resultado;
- modal de histórico aplicado.

O conteúdo dessas revisões inclui:

- score;
- resumo;
- tokens de entrada e saída;
- custo estimado;
- lista de problemas;
- botão `Implementar Ajustes`.

### Layout e leitura visual

É uma tela muito mais “formulário de configuração” do que “builder visual”.

Padrões visuais:

- branco como base;
- blocos internos em cinza claro ou azul claro;
- labels pequenas em uppercase;
- dest?que azul em checkboxes e CTAs;
- modais grandes e muito informativos para IA.

## Editor da aula

### Rota

- exemplo: `https://genflix-omega.vercel.app/admin/cursos/:courseId/builder/m?dulos/:moduleId/aulas/:lessonId`
- arquivo: [lesson-editor-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/lesson-editor-panel.tsx:1)

### Papel funcional

É uma das telas mais importantes do builder. Aqui se define:

- identidade da aula;
- tipo pedagógico;
- conteúdo em vídeo e/ou texto;
- blocos ricos;
- duração;
- obrigatoriedade;
- janela de liberação;
- preview dos botões do rodapé;
- moderação de solicitações de narração.

### Estrutura geral

Wrapper:

- `div.w-full.space-y-6.animate-in.fade-in.duration-500.pb-20`

Blocos principais:

- `<style>` local com skin do editor rico;
- cabeçalho da página;
- player/admin de áudio e moderação, quando aplicável;
- formulário principal;
- rodapé de salvar/excluir.

### Cabeçalho da aula

Topo:

- título `Criar N?ova Aula` ou `Editor de Aula`;
- subtítulo curto;
- botão `Botoes e URLs da Aula` se a aula já existir.

Esse botão leva para:

- `/admin/cursos/:courseId/builder/m?dulos/:moduleId/aulas/:lessonId/materiais`

### Área de áudio e moderação

Quando a aula é `text` ou `hybrid` e já existe, aparecem:

- `LessonAudioPlayer` em modo admin;
- card de `Solicitações de moderação da narração`.

Esse card permite:

- listar solicitações abertas;
- ver solicitante;
- ver erro técnico, se houver;
- escrever resposta administrativa;
- marcar como resolvida.

### Formulário da aula

O formulário é um card grande:

- `bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col`

O corpo interno é organizado como se fosse um wizard, mas sem navegação entre etapas.

#### Bloco 01: Identificação da Aula

Contém:

- título obrigatório;
- descrição curta opcional.

#### Bloco 02: Formato Pedagógico

Contém o seletor de tipo:

- `Apenas Vídeo`
- `Apenas Texto`
- `Vídeo + Texto`

Visualmente é uma grade de 3 botões sobre:

- `bg-slate-100/80 p-1.5 rounded-2xl`

O est?do ativo recebe:

- branco;
- texto azul;
- sombra leve;
- ring sutil.

#### Campo de YouTube

Se a aula for `video` ou `hybrid`, aparece:

- input de URL do YouTube;
- ícone de vídeo;
- foco em `rose`.

#### Estrutura do conteúdo textual

Se a aula for `text` ou `hybrid`, surge a área mais rica do editor:

- lista de blocos;
- ações por bloco;
- botões para adicionar novos blocos.

Tipos de bloco:

- `rich-text`
- `table`
- `image-hotspots`

Essa estrutura é baseada em [content-blocks.ts](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/content-blocks.ts:1).

### Como o conteúdo da aula é persistido

O backend da aula continua recebendo um HTML único em `text_content`, mas a UI trabalha internamente com blocos.

Fluxo:

1. ao carregar, `splitContent(textContent)` quebra o HTML em blocos;
2. o usuário edita cada bloco separadamente;
3. ao salvar, `mergeContent(blocks)` recompõe o HTML final;
4. tabelas e hotspots passam por serialização e sanitização específicas.

### Bloco de texto rico

O editor usa [ReactQuill customizado](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/components/forms/react-quill.tsx:1), mas com skin própria.

O painel injeta CSS local para:

- `.quill`
- `.ql-toolbar`
- `.ql-container`
- `.ql-editor`

Visual:

- toolbar cinza clara;
- corpo branco;
- padding generoso;
- títulos fortes;
- tipografia confortável.

### Bloco de tabela

Esse bloco combina:

- preview renderizado;
- textarea monoespaçada para HTML da tabela.

A preview:

- fica em card branco com borda azul clara;
- exibe a tabela sanitizada.

O editor cru:

- usa `font-mono`;
- fundo `slate-900`;
- texto `emerald-400`;
- aparência de editor de código.

As tabelas são higienizadas por `sanitizeTableHtml`, que:

- remove tags perigosas;
- preserva apenas a estrutura permitida;
- marca células vazias com `data-empty-cell="true"`.

### Bloco de hotspots da aula

Esse bloco usa `LessonImageHotspotsBlockEditor` e é independente do sistema de quizzes.

Estrutura do payload:

- `asset`
  - `storage_path`
  - `signed_url`
  - `alt`
  - `width`
  - `height`
- `hotspots`
  - `id`
  - `x`
  - `y`
  - `title`
  - `body_html`

Persistência:

- o bloco é serializado dentro do HTML da aula com atributos:
  - `data-hcm-block="image-hotspots"`
  - `data-hcm-payload="..."`

### Ações por bloco

Cada bloco permite:

- mover para cima;
- mover para baixo;
- excluir.

Esses controles ficam discretos:

- `opacity-0 group-hover:opacity-100`

### Campo de carga horária

Ainda dentro do bloco 02:

- `Carga Horária Estimada (Min)`
- input numérico;
- valor salvo em `estimated_minutes`.

#### Bloco 03: Configurações de Conclusão

Contém:

- toggle `Marcar como Aula Obrigatória`;
- janela de liberação da aula;
- card de `Botoes no Rodape da Aula`.

Importante:

- a aula só libera se a própria aula estiver liberada;
- e também se o módulo pai estiver dentro das regras de liberação.

### Preview de botões do rodapé da aula

Quando a aula já existe:

- os `lesson_footer_actions` são carregados;
- a tela mostra preview dos botões configurados;
- o estilo do preview usa `getLessonFooterButtonClassName(action.template)`.

Isso permite ver rapidamente:

- ordem dos botões;
- rótulo;
- tipo `Arquivo` ou `URL`.

### Layout visual da tela

Esta tela mistura dois estilos:

- formulário administrativo clássico;
- mini page builder de conteúdo.

É a página com maior variedade visual dentro do builder:

- cards de moderação;
- editor rico;
- editor técnico de tabela;
- preview de interações;
- blocos reordenáveis.

## Todas as configurações e estrutura dos quizzes

## Entidade de avaliação

O sistema trata avaliações em dois níveis:

- `assessment_type: 'module'`
- `assessment_type: 'final'`

Campos principais da avaliação:

- `title`
- `description`
- `passing_score`
- `max_attempts`
- `estimated_minutes`
- `is_required`
- `is_active`
- vínculo com `course_id`
- vínculo opcional com `module_id`

## Hub de avaliações

### Rota

- `/admin/cursos/:courseId/builder/assessments`
- arquivo: [course-assessments-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-assessments-panel.tsx:1)

### Papel funcional

É uma tela agregadora. Ela não é o editor profundo da avaliação, mas o índice de navegação e manutenção.

Ela mostra:

- avaliação final do curso;
- quizzes por módulo;
- ações de criar, editar, importar e excluir.

### Layout

Blocos visuais:

- card da avaliação final;
- lista de cards de módulos com quizzes;
- modal de importação de avaliação via IA.

### Funcionalidades

Avaliação final:

- exportar JSON;
- importar IA;
- configurar final;
- editar;
- excluir.

Quizzes por módulo:

- adicionar quiz;
- editar quiz existente;
- excluir quiz;
- importar quiz por IA diretamente para um módulo.

## Construtor de avaliações

### Rotas

- quiz de módulo:
  - `/admin/cursos/:courseId/builder/m?dulos/:moduleId/avalia??es/:assessmentId`
- avaliação final:
  - `/admin/cursos/:courseId/builder/assessments/final`

Arquivo:

- [assessment-builder-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/assessment-builder-panel.tsx:1)

### Papel funcional

É o editor profundo dos quizzes. Ele administra:

- metadados da avaliação;
- perguntas independentes;
- estudos de caso;
- questões gamificadas;
- importação estruturada;
- regras de pontuação.

### Estrutura visual do builder

A tela é composta por:

- cabeçalho da avaliação;
- linha de controles rápidos;
- banners de erro;
- cards de métricas;
- cartões de questões;
- cartões de estudos de caso;
- grade de botões para adicionar novos tipos;
- modal para escolher modalidade do hotspot;
- modal de importação JSON.

### Cabeçalho da avaliação

O topo permite editar inline:

- título;
- descrição;
- nota mínima;
- tentativas;
- duração.

Esses campos têm persistência incremental em blur.

### Métricas e regra de aprovação

O builder calcula:

- quantidade de questões pontuáveis;
- nota mínima real em pontos;
- total de pontos do quiz;
- explicação textual da regra de aprovação.

Regra importante:

- `essay_ai` não soma pontos;
- a aprovação considera a soma final de pontos do quiz;
- o aluno precisa atingir o corte definido em `passing_score`.

### Tipos de pergunta suportados hoje

Perguntas independentes:

- `single_choice`
- `essay_ai`
- `drag_drop_labeling`
- `fill_in_the_blanks`
- `image_hotspot`
- `coloring`

Perguntas dentro de estudo de caso:

- `case_study_single_choice`
- `case_study_ai`

Estrutura de grupo:

- `case_study`

### Multipla escolha

Tipos:

- `single_choice`
- `case_study_single_choice`

Estrutura:

- texto da pergunta;
- lista de alternativas;
- pontos;
- identificação da correta.

É o formato mais clássico do builder.

### Discursiva com IA

Tipos:

- `essay_ai`
- `case_study_ai`

Estrutura:

- texto da pergunta;
- `essay_expected_answer`;
- feedback orientado por IA.

Regra importante:

- não entra na nota final do quiz;
- aparece como questão com validação qualitativa;
- exige resposta esperada para comparação.

### Arrastar e soltar

Tipo:

- `drag_drop_labeling`

Estrutura da interação:

- `instruction`
- `asset`
- `tokens`
- `targets`

Cada `target` tem:

- `id`
- `x`
- `y`
- `w`
- `h`
- `label`

O gabarito é um mapeamento `slot_id -> token_id`.

Modos de correção:

- `partial_by_item`
- `all_or_nothing`

### Preencher lacunas

Tipo:

- `fill_in_the_blanks`

Estrutura:

- `instruction`
- `segments`
  - texto;
  - lacunas;
- `tokens`
- `editor_groups`

O editor atual modela a pergunta como grupos visuais, cada um com:

- texto inicial;
- uma ou várias lacunas;
- placeholder de cada lacuna;
- resposta correta;
- texto após a lacuna;
- tokens extras como distratores.

O gabarito também é `slot_id -> token_id`.

### Quiz de hotspot

Tipo:

- `image_hotspot`

Estrutura:

- `instruction`
- `mode`
- `asset`
- `targets`
- `outside_click_feedback`
- `show_feedback_as_popup`

Cada hotspot tem:

- `id`
- `x`
- `y`
- `w`
- `h`
- `label`
- `is_correct`
- `feedback_text`

Modos suportados:

- `single_attempt`
  encerra no primeiro clique relevante;
- `find_all`
  o aluno vai encontrando todos os hotspots corretos.

O gabarito é:

- `correct_target_ids`

### Quiz de colorir

Tipo:

- `coloring`

É o tipo gamificado mais complexo hoje.

Estrutura base:

- `instruction`
- `asset`
- `tokens`
  - cada token possui `label` e `hex`

Modos de renderização:

- `legacy_rect`
- `svg_regions`

#### `legacy_rect`

Usa áreas retangulares/points posicionados sobre a imagem.

Estrutura:

- `targets`
  - `id`
  - `x`
  - `y`
  - `w`
  - `h`
  - `label`

#### `svg_regions`

Usa SVG real com regiões detectáveis.

Estrutura:

- `svg_markup`
- `regions`
  - `region_id`
  - `label`

Esse modo permite importar:

- arquivo SVG;
- markup SVG/XML direto;
- regiões com `data-region-id`.

### Modos de correção das questões gamificadas

Todos os tipos gamificados trabalham com:

- `answer_key`
- `grading_mode`

Modos:

- `partial_by_item`
  a nota da pergunta é dividida entre os itens corretos;
- `all_or_nothing`
  só pontua se acertar tudo.

### Como o builder explica a pontuação

O painel gera textos de ajuda baseados em:

- tipo da pergunta;
- quantidade de slots;
- pontuação;
- modo de correção.

Isso deixa a lógica da avaliação mais explícita para quem está montando o quiz.

### Estudos de caso

O builder também suporta blocos de `case_study`.

Cada estudo de caso possui:

- `title`
- `case_text`
- lista de perguntas internas

Essas perguntas podem ser:

- `case_study_single_choice`
- `case_study_ai`

Visualmente, o estudo de caso é um card próprio com cabeçalho âmbar, texto longo e perguntas filhas abaixo.

### Controle por tipos de quiz habilitados

O builder de avaliações respeita duas camadas de permissão:

- tipos de quiz ativos globalmente;
- tipos de quiz ativos no curso.

Se um tipo estiver desativado:

- ele some da grade de criação;
- o builder mostra avisos de indisponibilidade;
- estudos de caso também podem ser bloqueados.

### Modal de importação da avaliação

O modal aceita JSON com:

- `questions`
- `case_studies`
- `interaction`
- `grading`

O texto da própria UI explicita que o JSON pode misturar:

- perguntas avulsas;
- estudos de caso;
- interações gamificadas.

## Página de configurações do curso

### Rota

- exemplo: `https://genflix-omega.vercel.app/admin/cursos/:courseId/builder/settings`
- arquivo: [course-settings-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-settings-panel.tsx:1)

### Papel funcional

Esta tela mistura três camadas:

- comercial;
- pedagógica;
- operacional.

Ela cobre:

- capa do curso;
- nome e descrição;
- slug, lançamento e preço;
- moeda;
- visibilidade pública;
- criador vinculado e comissão;
- status;
- progressão linear;
- tipos de quiz permitidos;
- padrões de revisão com IA;
- renovação do progresso de todos os alunos.

### Layout visual

A tela é mais colorida que o rest?nte do builder.

Ela usa:

- card branco grande para dados principais;
- bloco ciano para checkout e vendas;
- cartões de tipos de quiz por cor/est?do;
- card preto/cinza para padrões da IA;
- card rosa para reset de progresso.

### Seção de thumbnail

O upload da capa é uma área 4:3 grande com:

- drag/click;
- preview da imagem;
- overlay de alteração;
- botão remover quando já existe.

### Seção comercial

Campos:

- `title`
- `slug`
- `launch_date`
- `price_cents`
- `currency`
- `creator_id`
- `creator_commission_percent`
- `is_public`

Essa seção conversa com:

- catálogo público;
- checkout;
- repasse para criador.

### Descrição detalhada

Usa editor rico com `ReactQuill` customizado.

Serve mais ao catálogo e à venda do que ao builder interno.

### Status do curso

O curso pode est?r em:

- `draft`
- `published`
- `archived`

### Progressão linear

Toggle:

- `has_linear_progression`

Quando ativado:

- o aluno precisa concluir a aula atual para liberar a próxima;
- o módulo seguinte depende da conclusão do módulo anterior;
- quizzes entram nessa progressão.

### Tipos de quiz disponíveis no curso

A tela exibe cartões para os tipos globais visíveis e permite ligar/desligar por curso:

- multipla escolha;
- discursiva com IA;
- arrastar e soltar;
- preencher lacunas;
- hotspot;
- colorir;
- estudo de caso, quando suportado pela combinação de tipos.

Também mostra:

- quantos tipos estão ativos;
- quantos estão ocultos por bloqueio global;
- aviso sobre uso de estudo de caso.

### Padrões do curso perfeito

É a camada que orienta a IA na revisão de módulos.

Campos:

- `ideal_course_structure`
- `required_elements`
- `bibliography_rules`
- `table_formatting_rules`
- `additional_review_rules`

### Renovar progresso do curso

É uma ação destrutiva de administração.

Apaga:

- progresso do curso;
- progresso das aulas;
- tentativas e resultados das avaliações;
- pedidos de tentativa extra;
- grants de tentativa extra.

A UI mostra:

- aviso explícito;
- cards com o que será apagado;
- resumo do que foi impactado após a execução.

## Árvore lateral do builder

Arquivo:

- [course-tree-dnd.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/features/admin/content/components/course-tree-dnd.tsx:1)

### Papel funcional

É a espinha dorsal de navegação do construtor.

Mostra:

- visão geral do curso;
- módulos;
- aulas por módulo;
- quizzes por módulo;
- avaliação final;
- atalhos rápidos para adicionar aula, quiz e módulo.

### Reordenação

Implementada com `@hello-pangea/dnd`.

Suporta:

- reorder de módulos;
- reorder de aulas dentro do módulo.

Não reordena quizzes nessa versão.

### Leitura visual

Módulo:

- linha principal forte;
- drag handle;
- marcador `M1`, `M2`, etc.;
- botão de excluir em hover.

Aula:

- indentada;
- ícone por tipo;
- dest?que azul quando ativa.

Quiz:

- linha com tom âmbar;
- ícone de avaliação;
- dest?que âmbar quando ativo.

Avaliação final:

- bloco próprio ao final da árvore;
- dest?que esverdeado.

### Quick actions

Dentro de cada módulo aparecem, no hover:

- `Aula`
- `Quiz`

N?o final da árvore:

- `N?ovo Módulo`

## Exportar conteúdo em JSON

### Onde aparece na UI

N?o shell do builder, via botão `Exportar Conteúdo` na sidebar.

Arquivo de layout:

- [admin-course-builder-layout.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/app/layouts/admin-course-builder-layout.tsx:1)

### Modal de exportação

O modal oferece três saídas:

- curso completo;
- módulo selecionado;
- avaliação final.

Layout:

- cabeçalho com título e subtítulo;
- botões `outline` em lista;
- select para escolher módulo.

### Formatos exportados

#### Curso completo

Estrutura:

- `title`
- `description`
- `workload_minutes`
- `thumbnail_url`
- `status`
- `quiz_type_settings`
- `modules`

Cada módulo exportado contém:

- `title`
- `description`
- `lessons`
- `assessments`

#### Módulo

Estrutura:

- `title`
- `description`
- `lessons`
- `assessments`

Cada aula exporta:

- `title`
- `description`
- `lesson_type`
- `youtube_url`
- `text_content`
- `estimated_minutes`

Cada assessment exporta o conteúdo estruturado do quiz.

#### Avaliação final

É exportada por API própria do domínio de assessments.

### APIs envolvidas

- `exportFullCourseContent(courseId)`
- `exportModuleContent(moduleId)`
- `exportFinalAssessmentContent(courseId)`

### Comportamento prático

O export baixa arquivo JSON usando `downloadJsonFile(...)`, já nomeado com:

- nome do curso;
- nome do módulo;
- ou avaliação final.

## Importar conteúdo em JSON

### Onde aparece na UI

Existem três frentes principais:

- importação massiva no shell do builder;
- importação de avaliação no hub de avaliações;
- importação dentro do builder de avaliação.

## Importação massiva do curso e dos módulos

### Local

- sidebar do builder, botão `Importar Conteúdo (IA)`
- arquivo: [admin-course-builder-layout.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/app/layouts/admin-course-builder-layout.tsx:1)

### O que o modal permite

- colar JSON cru;
- colar JSON dentro de bloco markdown;
- adicionar novos módulos;
- substituir um módulo existente;
- limpar o curso inteiro antes da importação.

### Tratamento do JSON

O código faz:

- trim;
- remoção de fences ```json;
- tentativa de `JSON.parse`;
- fallback para conserto de quebras de linha;
- limpeza de aspas escapadas problemáticas.

### Modos de importação

#### Adicionar novos módulos

Mantém o conteúdo atual e anexa novos módulos ao final.

#### Substituir módulo existente

Usa `moduleIdToReplace`.

Fluxo:

1. atualiza título e descrição do módulo;
2. apaga quizzes do módulo;
3. apaga aulas do módulo;
4. recria aulas e quizzes a partir do JSON;
5. pode seguir inserindo módulos adicionais depois do substituído.

#### Limpar curso inteiro

Antes de importar:

- remove avaliação final sem módulo;
- remove todos os módulos do curso;
- o cascade do banco cuida do rest?nte dependente.

### Formatos aceitos

Pode receber:

- `ImportCourseFullData`
- `ImportModuleData[]`
- `ImportAssessmentData`

Ou seja, o importador central também aceita importação de avaliação final isolada.

## Importação de avaliação pelo hub de avaliações

### Local

- [course-assessments-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/course-assessments-panel.tsx:1)

### Comportamento

Se `targetModuleId` existir:

- cria um novo quiz do módulo;
- importa o JSON para dentro dele.

Se `targetModuleId` não existir:

- procura a avaliação final;
- se não existir, cria uma;
- importa o JSON nela.

### Campos considerados no JSON

O fluxo lê, quando disponíveis:

- `title`
- `description`
- `passing_score`
- `max_attempts`
- `estimated_minutes`
- `questions`
- `case_studies`

## Importação de avaliação no builder profundo

### Local

- [assessment-builder-panel.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/pages/admin/builder/assessment-builder-panel.tsx:1)

### Papel

Permite reimportar a estrutura inteira de uma avaliação já aberta.

O texto da interface deixa explícito que o JSON pode misturar:

- perguntas independentes;
- `case_studies`;
- `interaction`;
- `grading`.

### Observação importante

Na prática, o sistema atual foi desenhado para round-trip entre:

- IA;
- JSON estruturado;
- builder;
- exportação novamente para JSON.

## Padrões de HTML/JSX e CSS do builder

## Containers recorrentes

Ao longo de todas as telas, o padrão dominante é:

- `bg-white`
- `border border-slate-200`
- `rounded-2xl` ou `rounded-[28px]/[32px]`
- `shadow-sm`

Isso cria uma linguagem de “cartões administrativos brancos sobre fundo cinza muito claro”.

## Tipografia

Padrões muito usados:

- títulos grandes em `font-black` ou `font-extrabold`;
- subtítulos em `text-sm text-slate-500`;
- labels em `text-xs` ou `text-[10px]`;
- uppercase com `tracking-widest`.

## Inputs

Inputs seguem um padrão consistente:

- borda clara;
- fundo branco ou `slate-50/50`;
- padding generoso;
- foco com ring azul;
- peso tipográfico relativamente forte.

## Botões

O builder usa o `Button` base em [src/components/ui/button.tsx](/c:/PLATAFORMAS%20VS%20CODE/GENFLIX/genflix/src/components/ui/button.tsx:1), mas com muitas classes adicionais por tela.

Famílias mais comuns:

- CTA azul;
- `outline`;
- `ghost`;
- destrutivo em rosa/vermelho.

## Paleta visual

Predomina:

- branco;
- `slate` para texto e fundo suave;
- azul como ação principal;
- ciano/teal para blocos pedagógicos;
- âmbar para quizzes e estudos de caso;
- esmeralda para sucesso e avaliação final;
- rosa/vermelho para destruição e reset.

## Resumo crítico

Hoje o construtor de cursos do GenFlix já funciona como uma aplicação administrativa completa, e não como um CRUD simples.

Ele combina:

- shell de navegação full-screen;
- árvore pedagógica lateral;
- overview operacional do curso;
- edição profunda de módulo;
- edição multimodal de aula;
- hub e builder avançado de avaliações;
- importação/exportação em JSON orientada a IA;
- regras reais de progressão e liberação;
- configuração comercial e pedagógica do curso.

Os pontos mais sofisticados atualmente são:

- sistema de blocos no editor da aula;
- builder de quizzes com tipos gamificados;
- importação estruturada de conteúdo e avaliação;
- revisão com IA aplicada a módulo;
- integração entre curso, progressão, quizzes e catálogo.

Em termos de maturidade, a implementação atual já suporta manutenção contínua de cursos complexos, com conteúdo multimodal, avaliação rica e operação híbrida humano + IA.
