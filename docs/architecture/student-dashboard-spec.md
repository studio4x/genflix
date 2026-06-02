# SPEC: Dashboard do Aluno

## 1. Objetivo do documento

Este documento descreve, em nivel funcional, visual e tecnico, como a experiencia atual do dashboard do aluno est? implementada na GenFlix.

O foco principal e a p?gina inicial da area do aluno em `/aluno/dashboard`, mas o documento tamb?m cobre a casca compartilhada da area logada do aluno, porque essa estrutura define:

- header interno;
- navegacao lateral;
- cartao de identidade do aluno;
- centro de notificacoes;
- area de contedo principal;
- footer interno com links legais e build.

Este spec representa o est?do atual do codigo, e n?o uma proposta futura.

## 2. Arquivos-fonte principais

### 2.1 Layout da area do aluno

- `src/app/layouts/student-layout.tsx`
- `src/features/notifications/notification-center.tsx`
- `src/components/layout/platform-footer.tsx`

### 2.2 P?gina inicial do dashboard

- `src/pages/student/student-dashboard-page.tsx`

### 2.3 Rotas relacionadas

- `src/app/router/index.tsx`

### 2.4 Dados e logica de cursos

- `src/features/student/courses/api.ts`
- `src/types/content.ts`

## 3. Posicionamento da rota

### 3.1 Entrada do m?dulo

O m?dulo do aluno fica protegido por `ProtectedRoute` para roles `student` e `aluno`.

Fluxo atual:

```text
/aluno
  -> redirect para /aluno/dashboard

/aluno/dashboard
  -> p?gina inicial do aluno

/aluno/cursos
  -> catalogo interno de treinamentos liberados

/aluno/cursos/:courseId
  -> p?gina de detalhes do curso

/aluno/cursos/:courseId/player
  -> player LMS em tela cheia

/aluno/mensagens
  -> central de mensagens

/aluno/notificacoes
  -> preferencias de notificacao

/aluno/minha-conta
  -> dados pessoais, senha e configura??es de perfil
```

### 3.2 Papel do dashboard

O dashboard do aluno funciona como hub inicial de acompanhamento e orientacao. Ele n?o tenta substituir a p?gina de cursos nem o player. Em vez disso, ele concentra:

- saudacao e contexto da sessao;
- indicadores resumidos da jornada;
- atalhos para voltar a estudar;
- recomendacoes de cursos em aberto;
- resumo do perfil;
- leitura rapida do status academico.

## 4. Estrutura visual da area do aluno

## 4.1 Canvas geral

O `StudentLayout` cria um canvas de painel com est?s caracteristicas:

- fundo geral da tela: `#F2F7F9`;
- tipografia base: `font-manrope`;
- cor principal de texto: `#163138`;
- estrutura em duas colunas no desktop:
  - sidebar fixa a esquerda com largura de `280px`;
  - area principal flexivel a direita;
- estrutura em uma coluna no mobile/tablet.

Container principal:

- `main` ocupa altura minima de tela inteira;
- grid principal usa `lg:grid-cols-[280px_minmax(0,1fr)]`;
- espacos externos com `px-4 py-5`, crescendo em `sm` e `lg`.

## 4.2 Header interno fixo

O header da area do aluno e `sticky` no topo, com:

- borda inferior `#D8E6EB`;
- fundo semitransparente `#F2F7F9/95`;
- `backdrop-blur-md`;
- altura minima aproximada de `68px`.

Elementos do header:

1. Logo GenFlix com link para `/aluno/dashboard`.
2. Selo textual `Area do aluno` em desktop pequeno para cima.
3. Texto central decorativo `Meu aprendizado` visivel a partir de `md`.
4. Centro de notificacoes.
5. Atalho para `Minha conta` no desktop.
6. Botao `Sair`.

N?o mobile:

- o texto central some;
- o selo `Area do aluno` aparece em uma linha secundaria abaixo do header.

## 4.3 Sidebar lateral

A sidebar fica:

- dentro de um cartao branco;
- com borda `#D8E6EB`;
- raio grande `rounded-[30px]`;
- sombra suave `shadow-[0_20px_50px_rgba(22,49,56,0.05)]`;
- comportamento `sticky` em desktop com `top-[120px]`.

### 4.3.1 Bloco de identidade do aluno

O topo da sidebar mostra:

- avatar circular com gradiente `from-[#1398B7] to-[#0A3640]`;
- iniciais derivadas do primeiro nome;
- nome completo ou fallback do e-mail;
- label `Aluno`;
- e-mail do usurio.

### 4.3.2 Menu lateral

Links atuais do menu:

1. `Inicio` -> `/aluno/dashboard`
2. `Cursos` -> `/aluno/cursos`
3. `Mensagens` -> `/aluno/mensagens`
4. `N?otificacoes` -> `/aluno/notificacoes`
5. `Minha Conta` -> `/aluno/minha-conta`

Cada item possui:

- icone;
- label principal;
- descri??o secundaria;
- est?do ativo por `location.pathname.startsWith(link.to)`.

Estado ativo:

- fundo `#1398B7`;
- texto branco;
- sombra azul.

Estado inativo:

- texto `#5f7077`;
- hover com fundo `#F2F7F9`;
- icones em `#8BA0A7`.

### 4.3.3 Acao de saida

N?o rodape da sidebar existe um botao em largura total:

- label `Sair da conta`;
- borda `#D8E6EB`;
- visual outline branco.

## 4.4 Area principal de contedo

A coluna de contedo usa:

- um cartao branco principal com borda `#D8E6EB`;
- raio `rounded-[34px]`;
- padding `p-5` no mobile e `sm:p-7` em telas maiores;
- sombra suave `shadow-[0_20px_50px_rgba(22,49,56,0.04)]`.

Dentro desse cartao entra o `Outlet` da rota ativa do aluno.

Abaixo do contedo fica o `PlatformFooter`, tamb?m em cartao branco, com:

- links legais;
- numero do build.

## 5. Centro de notificacoes no dashboard do aluno

O `N?otificationCenter` aparece no header e e compartilhado com outras areas.

### 5.1 Comportamento

- abre em dropdown flutuante alinhado a direita;
- consome `fetchN?otifications` e `fetchUnreadN?otificationCount`;
- escuta `postgres_changes` em tempo real via canal Supabase por `user_id`;
- permite:
  - atualizar lista;
  - marcar uma notificacao como lida;
  - marcar todas como lidas;
  - navegar para `action_url` quando houver.

### 5.2 Estado visual

Botao disparador:

- quadrado `40x40`;
- borda `#D8E6EB`;
- fundo branco;
- icone `Bell` de `lucide-react`;
- badge de n?o lidas no canto superior direito.

Dropdown:

- largura maxima de `420px`;
- fundo branco;
- cabe?alho com fundo `#F2F7F9`;
- lista rolavel com altura maxima de `420px`.

## 6. Estrutura da p?gina `/aluno/dashboard`

## 6.1 Visao geral

A p?gina usa um empilhamento vertical com `space-y-8` e est? organizada em quatro blocos principais:

1. header da p?gina;
2. faixa de metricas;
3. grid principal de contedo em duas colunas;
4. cards auxiliares da coluna lateral.

## 6.2 Header da p?gina

O header da p?gina tem:

- borda inferior `border-slate-100`;
- padding inferior `pb-8`;
- layout vertical no mobile e horizontal no desktop extra large.

### 6.2.1 Badge do m?dulo

Badge superior:

- texto `Painel do Aluno`;
- fundo `blue-50`;
- borda `blue-100`;
- texto `blue-600`;
- fonte super forte, uppercase, tracking amplo.

Icone do badge:

- icone de usurio em SVG outline.

### 6.2.2 Saudacao principal

Contedos:

- t?tulo `Ola, {firstName}!`
- e-mail do aluno abaixo do t?tulo;
- texto de apoio:
  `Gerencie sua jornada de aprendizado, acompanhe sua evolucao e retome seus treinamentos com a linguagem da GenFlix.`

Regras:

- `firstName` vem de `profile.full_name`;
- se n?o houver nome, usa prefixo do e-mail;
- se tamb?m n?o houver e-mail, usa `Aluno`.

### 6.2.3 Acao de refresh

Existe um botao `Atualizar Painel` no lado direito:

- variante `outline`;
- altura `48px`;
- texto `font-bold`;
- icone de refresh com animacao `spin` enquanto `isLoading = true`;
- aciona `loadDashboard()`.

## 6.3 Estado de erro

Se `error` existir, a p?gina exibe um bloco de erro logo abaixo do header:

- fundo vermelho claro;
- borda vermelha;
- texto vermelho;
- padding `p-5`;
- tipografia de dest?que.

N?o existe est?do de skeleton especifico no dashboard inicial. Durante loading, os indicadores numericos usam `-` e o rest?nte da tela continua renderizado.

## 6.4 Faixa de metricas

A primeira secao de contedo e um grid responsivo:

- `grid gap-4`;
- `sm:grid-cols-2`;
- `xl:grid-cols-4`.

Metricas atuais:

1. `Cursos liberados`
2. `Em andamento`
3. `Prova final pendente`
4. `Concluidos`

### 6.4.1 Estilo das metricas

Cada metrica e um card compacto com:

- raio `rounded-[28px]`;
- padding `p-5`;
- t?tulo pequeno uppercase;
- numero principal em `text-4xl font-black`.

Paletas:

- total: slate;
- em andamento: azul;
- prova final pendente: amber;
- concluidos: emerald.

### 6.4.2 Origem dos dados

Esses dados sao calculados em `journeySummary` com base em:

- `courses`
- `courseStatuses`

Regra:

- `total` = quantidade de cursos liberados;
- `completed` = cursos com `journeyStatus = completed`;
- `finalPending` = cursos com `journeyStatus = final_pending`;
- `inProgress` = todos os demais.

## 6.5 Grid principal da p?gina

Depois das metricas, o dashboard entra em uma secao em duas colunas:

- coluna esquerda maior: `minmax(0,1.1fr)`
- coluna direita menor: `minmax(360px,0.9fr)`

N?o mobile e tablet, esse grid colapsa em uma coluna unica.

## 7. Coluna esquerda do dashboard

## 7.1 Card "Atalhos do aluno"

Esse card e o primeiro da coluna esquerda.

Estilo:

- fundo branco;
- borda `border-slate-200`;
- raio `rounded-[32px]`;
- padding `p-6`;
- sombra `shadow-sm`.

Cabe?alho:

- eyebrow `Acesso rapido`;
- t?tulo `Atalhos do aluno`.

### 7.1.1 Atalho "Explorar meus cursos"

Link:

- destino `/aluno/cursos`
- fundo `blue-50`
- borda `blue-100`
- hover com azul mais visivel

Contedo:

- icone de livro dentro de quadrado branco arredondado;
- t?tulo `Explorar meus cursos`;
- descri??o `Acesse todos os treinamentos liberados para sua conta.`;
- seta de navegacao no lado direito.

### 7.1.2 Atalho dinamico do curso em dest?que

Esse bloco so aparece se existir `featuredCourse`.

Destino:

- `/aluno/cursos/{featuredCourse.id}`

Estilo:

- fundo `slate-50`;
- borda `slate-200`;
- hover em `slate-100/70`.

Contedo:

- icone de play dentro de quadrado branco;
- label dinamico baseada na jornada:
  - `Revisar Aprendizado`
  - `Continuar Aprendizado`
  - `Iniciar Aprendizado`
- subt?tulo com o t?tulo do curso truncado;
- seta no lado direito.

### 7.1.3 Regra de selecao do curso em dest?que

`featuredCourse` segue a regra:

1. pega o primeiro curso que ainda n?o esteja concluido;
2. se todos estiverem concluidos, usa o primeiro curso da lista;
3. se n?o houver curso, retorna `null`.

## 7.2 Card "Proximos cursos recomendados"

Esse card e o segundo grande bloco da coluna esquerda.

Cabe?alho:

- eyebrow `Dest?que`
- t?tulo `Proximos cursos recomendados`

### 7.2.1 Regra de recomendacao

`recommendedCourses` funciona assim:

1. filtra cursos n?o concluidos;
2. se existir pelo menos um, usa essa lista;
3. se todos estiverem concluidos, usa a lista completa;
4. limita para os dois primeiros itens.

### 7.2.2 Estrutura do card de curso recomendado

Cada card recomendado possui:

- container com fundo `slate-50`;
- borda `slate-200`;
- raio `rounded-[28px]`;
- bloco superior de imagem em proporcao `4/3`;
- bloco inferior textual com `p-5`.

#### 7.2.2.1 Midia

Se `course.thumbnail_url` existir:

- renderiza imagem com `object-cover`.

Se n?o existir:

- renderiza placeholder escuro com gradiente de `slate-900` para `slate-700`;
- texto fantasma `LMS`.

Sobre a imagem existe um degrad e inferior para dar acabamento visual.

#### 7.2.2.2 Status

Existe um pill branco com o status:

- `Concluido`
- `Prova final pendente`
- `Em andamento`

#### 7.2.2.3 Corpo textual

Elementos:

- t?tulo do curso com clamp em 2 linhas;
- descri??o com clamp em 3 linhas.

Descri??o usa `sanitizeDescription()`:

- remove HTML;
- se descri??o for nula, usa fallback:
  `Contedo liberado para desenvolver sua pratica profissional com mais seguran?a.`

#### 7.2.2.4 Acoes

Existem dois botoes:

1. CTA principal para o curso:
   - destino `/aluno/cursos/{course.id}`
   - label dinamica:
     - `Revisar Aprendizado`
     - `Continuar Aprendizado`
     - `Iniciar Aprendizado`
   - visual azul preenchido.

2. CTA secundario:
   - destino `/aluno/cursos`
   - label `Ver catalogo`
   - visual branco com borda.

### 7.2.3 Estado vazio

Se n?o houver cursos recomendados:

- aparece um bloco centralizado;
- texto principal:
  `Nenhum curso liberado no momento.`
- texto de apoio:
  `Assim que novos treinamentos forem atribuidos, eles aparecerao aqui.`

## 8. Coluna direita do dashboard

## 8.1 Card "Resumo do perfil"

Cabe?alho:

- eyebrow `Situacao da conta`
- t?tulo `Resumo do perfil`

### 8.1.1 Box de status da conta

Bloco verde superior:

- fundo `emerald-50`;
- borda `emerald-100`;
- icone de check dentro de container branco;
- t?tulo `Conta ativa para aprendizagem`;
- descri??o:
  `Seus treinamentos liberados est?o disponiveis para acesso e continuidade.`

Esse bloco hoje e est?tico. Ele n?o depende de condicao real de assinatura, inadimplencia ou bloqueio.

### 8.1.2 Informacoes pessoais

Em seguida existe um grid com dois mini-cards:

1. `N?ome`
   - mostra `profile.full_name`
   - fallback `N?o informado`
2. `E-mail`
   - mostra `profile.email`

### 8.1.3 CTA de conta

Botao final:

- destino `/aluno/minha-conta`
- label `Editar meus dados`
- visual outline branco.

## 8.2 Card "Status da jornada"

Cabe?alho:

- eyebrow `Leitura rapida`
- t?tulo `Status da jornada`

Contedo:

- tres linhas de resumo:
  1. `Cursos em andamento`
  2. `Aguardando prova final`
  3. `Cursos concluidos`

Cada linha possui:

- label textual;
- badge numerico colorido no lado direito.

Paletas:

- andamento: azul;
- prova final: amber;
- concluidos: emerald.

Esse card repete de forma compacta parte do resumo das metricas superiores, servindo como uma leitura lateral persistente.

## 9. Regras de dados do dashboard

## 9.1 Fontes consultadas

Ao carregar, o dashboard executa `loadDashboard()` e chama em paralelo:

1. `fetchReleasedCourses()`
2. `fetchStudentCoursesStatusMap(courseIds)`
3. `fetchStartedCourseIds(courseIds)`

### 9.1.1 `fetchReleasedCourses()`

Busca em `courses` com:

- `status = 'published'`
- ordenacao por `display_order` ascendente
- fallback por `created_at` descendente

Observacao importante:

N?o est?do atual, essa funcao consulta cursos publicados em geral. O recorte final da experiencia de aluno depende do rest?nte do fluxo de acesso, progresso e p?ginas derivadas. Se houver necessidade de listar apenas cursos efetivamente liberados por release, essa funcao e um ponto de revis?o futura.

### 9.1.2 `fetchStudentCoursesStatusMap()`

Para cada curso, chama `fetchStudentCourseStatus(courseId)`, que usa a RPC:

- `get_student_course_status`

Estrutura retornada por curso:

- `is_completed`
- `required_modules_total`
- `required_modules_completed`
- `has_required_final_assessment`
- `required_final_assessment_approved`

### 9.1.3 `fetchStartedCourseIds()`

Consulta `course_progress` para descobrir se o aluno ja iniciou o curso.

Esse dado e usado para diferenciar:

- `Iniciar Aprendizado`
- `Continuar Aprendizado`

## 9.2 Regra de status da jornada

A funcao `getStudentCourseJourneyStatus()` retorna:

### 9.2.1 `completed`

Quando `status.is_completed = true`.

### 9.2.2 `final_pending`

Quando:

- todos os m?dulos obrigatrios est?o concluidos;
- existe avalia??o final obrigatria;
- a avalia??o final ainda n?o foi aprovada.

### 9.2.3 `in_progress`

Todos os demais cenarios.

## 10. Iconografia atual

## 10.1 Icones da casca do aluno

Menu lateral:

1. `Inicio`
   - icone de casa/home
2. `Cursos`
   - icone de livro aberto
3. `Mensagens`
   - icone de balao de conversa
4. `N?otificacoes`
   - icone de sino
5. `Minha Conta`
   - icone de usurio

Header:

- notificacoes usa `Bell` de `lucide-react`
- acoes internas usam avatar textual em vez de icone grafico

## 10.2 Icones do dashboard

P?gina `/aluno/dashboard`:

1. badge `Painel do Aluno`
   - icone de usurio
2. botao `Atualizar Painel`
   - icone de refresh
3. atalho `Explorar meus cursos`
   - icone de livro aberto
4. atalho do curso em dest?que
   - icone de play em circulo
5. setas de navegacao laterais
   - chevron para a direita
6. box `Conta ativa para aprendizagem`
   - icone de check

## 11. Contedo textual atual da p?gina inicial

## 11.1 Copys principais

Header:

- `Painel do Aluno`
- `Ola, {firstName}!`
- `Gerencie sua jornada de aprendizado, acompanhe sua evolucao e retome seus treinamentos com a linguagem da GenFlix.`

Metricas:

- `Cursos liberados`
- `Em andamento`
- `Prova final pendente`
- `Concluidos`

Card de atalhos:

- `Acesso rapido`
- `Atalhos do aluno`
- `Explorar meus cursos`
- `Acesse todos os treinamentos liberados para sua conta.`

Card de recomendados:

- `Dest?que`
- `Proximos cursos recomendados`
- `Ver catalogo`

Card de perfil:

- `Situacao da conta`
- `Resumo do perfil`
- `Conta ativa para aprendizagem`
- `Editar meus dados`

Card lateral de status:

- `Leitura rapida`
- `Status da jornada`

## 11.2 Fallbacks textuais

N?ome:

- fallback geral de saudacao: `Aluno`

Descri??o de curso sem contedo:

- `Contedo liberado para desenvolver sua pratica profissional com mais seguran?a.`

Estado vazio de recomendacoes:

- `Nenhum curso liberado no momento.`
- `Assim que novos treinamentos forem atribuidos, eles aparecerao aqui.`

## 12. Responsividade

## 12.1 Mobile

Comportamentos principais:

- header interno simplificado;
- texto central `Meu aprendizado` escondido;
- selo `Area do aluno` em linha separada;
- layout geral em coluna unica;
- sidebar deixa de ser lateral e passa a ser um bloco acima do contedo;
- grid de metricas quebra em 2 colunas a partir de `sm`;
- grid principal do dashboard empilha todos os cards.

## 12.2 Desktop

Comportamentos principais:

- header completo com bloco central e atalho de conta;
- sidebar fixa na esquerda;
- contedo principal em cartao grande a direita;
- dashboard em duas colunas com peso maior para contedo e recomendacoes.

## 13. Dependencias e acoplamentos importantes

## 13.1 Dependencia de autentica??o

O dashboard depende de `useAuth()` para:

- `profile.full_name`
- `profile.email`

Esses dados alimentam:

- saudacao;
- e-mail abaixo do t?tulo;
- cartao lateral de identidade;
- resumo do perfil.

## 13.2 Dependencia do m?dulo de cursos

O dashboard n?o possui API propria. Ele e uma composicao de dados do m?dulo de cursos do aluno.

Isso significa que qualquer alteracao nas regras de:

- progresso;
- inicio de curso;
- aprova??o em avalia??o final;
- ordenacao de cursos;

afeta diretamente:

- metricas;
- curso em dest?que;
- recomendacoes;
- labels de CTA.

## 13.3 Dependencia do centro de notificacoes

O header do layout do aluno depende do m?dulo de notificacoes em tempo real.

Se esse m?dulo falhar:

- o dashboard continua funcional;
- mas perde o canal rapido de avisos e navegações contextuais.

## 14. Decisoes atuais de UX

O dashboard atual segue algumas escolhas claras:

1. Prioriza continuidade de estudo antes de an?lise profunda.
2. Repete informacoes-chave em mais de um bloco para melhorar escaneabilidade.
3. Usa cards com alto contraste leve e cantos grandes para manter a linguagem visual da GenFlix.
4. Evita tabelas e listas densas.
5. Mantem foco em CTA de retorno ao curso e exploracao do catalogo interno.

## 15. Limites atuais do dashboard

N?o est?do atual, o dashboard n?o inclui:

- cronograma detalhado;
- calendario de liberacoes;
- hist?rico de certificados;
- progresso percentual por curso na home;
- ranking, gamificacao ou streak;
- feed editorial;
- recomendacao inteligente personalizada por categoria;
- diferenciacao visual entre cursos comprados, liberados por admin ou por grupo.

Tambem n?o existe, nest? p?gina, controle explicito de:

- bloqueio de conta;
- inadimplencia;
- expiracao de acesso;
- mensagem de curso agendado para o futuro.

## 16. Resumo executivo

Hoje, o dashboard do aluno da GenFlix e uma home interna orientada a retomada de estudo. Ele combina:

- shell lateral consistente;
- header com notificacoes;
- metricas resumidas;
- atalhos de retomada;
- cards de recomendacao;
- resumo de perfil;
- leitura rapida da jornada.

Tecnicamente, a p?gina e simples do ponto de vista de composicao visual, mas depende fortemente das regras de progresso e do modelo de cursos do aluno. Por isso, qualquer evolucao nessa area deve considerar sempre o conjunto:

- `StudentLayout`
- `StudentDashboardPage`
- `student/courses/api`
- roteamento de `/aluno`
- p?gina de cursos e player do aluno

