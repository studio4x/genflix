# Especificação do Projeto para Geração de Testes

## Objetivo

Este documento descreve o projeto GenFlix em um formato preparado para geração de testes automatizados na plataforma Test Sprite.

O foco é orientar a criação de testes que cubram:

- navegação principal da aplicação;
- autenticação e perfis de acesso;
- área pública do site;
- área do aluno;
- painel administrativo;
- construtor de cursos;
- importação e exportação de conteúdo;
- blog;
- notificações;
- interações com formulários, uploads e modais.

## Visão Geral do Produto

O GenFlix é uma plataforma LMS para criação, venda e entrega de cursos online.

O sistema possui três grandes superfícies:

1. Site público.
2. Área do aluno.
3. Painel administrativo.

Além disso, existe um construtor de cursos que concentra a criação de:

- módulos;
- aulas;
- quizzes;
- avaliação final;
- botões de rodapé da aula;
- página pública do curso.

## Objetivos de Teste

Os testes gerados para esta aplicação devem validar:

- renderização correta das páginas principais;
- persistência de formulários;
- comportamento de modais e painéis laterais;
- exibição condicional de campos e seções;
- carregamento de dados reais vindos do backend;
- recuperação de erros de rede e de módulos dinâmicos;
- consistência entre o cadastro principal e as páginas derivadas;
- comportamento de upload e preview de imagens;
- funcionamento dos fluxos de importação e exportação JSON;
- continuidade da navegação após refresh.

## Perfis de Usuário

### Visitante

Usuário sem login. Pode acessar:

- home pública;
- lista de cursos;
- blog;
- páginas institucionais;
- página pública de cursos e artigos;
- checkout quando aplicável.

### Aluno

Usuário autenticado com acesso a cursos liberados. Pode acessar:

- dashboard;
- lista de cursos liberados;
- página do curso;
- página da aula;
- mensagens e notificações;
- pagamentos;
- suporte;
- conta.

### Admin

Usuário com acesso ao painel administrativo. Pode acessar:

- dashboard admin;
- gestão de cursos;
- construtor de cursos;
- editor de aulas;
- quizzes e avaliação final;
- importação/exportação de conteúdo;
- blog;
- banners;
- notificações;
- usuários e grupos;
- configurações gerais.

### Criador / Professor

Usuário com permissões de conteúdo e acompanhamento. Pode acessar partes do admin relacionadas a:

- cursos vinculados;
- relatórios;
- suporte;
- notificações;
- áreas permitidas por role.

## Estrutura de Rotas

### Público

- `/`
- `/cursos`
- `/cursos/:slug`
- `/blog`
- `/blog/:slug`
- `/contato`
- `/suporte`
- `/comunidade`
- `/sobre`
- `/termos`
- `/privacidade`
- `/cookies`

### Autenticação

- `/login`
- `/cadastro`
- `/recuperar-senha`
- `/resetar-senha`
- `/auth/callback`

### Aluno

- `/aluno`
- `/aluno/cursos`
- `/aluno/cursos/:courseId`
- `/aluno/cursos/:courseId/aulas/:lessonId`
- `/aluno/conta`
- `/aluno/pagamentos`
- `/aluno/notificacoes`
- `/aluno/suporte`
- `/aluno/pedidos`

### Admin

- `/admin`
- `/admin/cursos`
- `/admin/cursos/:courseId/builder`
- `/admin/cursos/:courseId/builder/modulos/:moduleId`
- `/admin/cursos/:courseId/builder/modulos/:moduleId/aulas/:lessonId`
- `/admin/cursos/:courseId/builder/modulos/:moduleId/materiais`
- `/admin/cursos/:courseId/builder/settings`
- `/admin/cursos/:courseId/builder/pagina-publica`
- `/admin/cursos/:courseId/builder/avaliacoes`
- `/admin/cursos/:courseId/builder/avaliacoes/final`
- `/admin/cursos/:courseId/builder/liberacoes`
- `/admin/blog`
- `/admin/notificacoes`
- `/admin/usuarios`
- `/admin/grupos`
- `/admin/banners`
- `/admin/configuracoes`

## Entidades Principais

### Curso

Campos comuns relevantes:

- `id`
- `title`
- `category`
- `description`
- `status`
- `slug`
- `launch_date`
- `price_cents`
- `currency`
- `thumbnail_url`
- `student_hero_image_url`
- `is_public`
- `creator_id`
- `creator_commission_percent`
- `has_linear_progression`
- `quiz_type_settings`

### Módulo

- `id`
- `course_id`
- `title`
- `description`
- `display_order`
- `is_required`
- `starts_at`
- `ends_at`
- `release_days_after_enrollment`

### Aula

- `id`
- `module_id`
- `title`
- `description`
- `lesson_type`
- `text_content`
- `youtube_url`
- `estimated_minutes`
- `is_required`
- `release_at`
- `expires_at`

### Avaliação

- `id`
- `course_id`
- `module_id`
- `assessment_type`
- `title`
- `description`
- `passing_score`
- `max_attempts`
- `estimated_minutes`
- `questions`

### Blog Post

- `id`
- `title`
- `slug`
- `excerpt`
- `content`
- `status`
- `cover_image_url`
- `seo_title`
- `seo_description`
- `seo_canonical_url`
- `seo_robots`
- `seo_og_title`
- `seo_og_description`
- `seo_og_image_url`
- `focus_keyword`

## Fluxos Críticos para Testes

### 1. Login e sessão

- login com credenciais válidas;
- logout;
- expiração de sessão;
- redirecionamento após autenticação;
- persistência de acesso após refresh.

### 2. Navegação pública

- home carrega conteúdo real;
- lista de cursos mostra somente cursos publicados;
- página de curso carrega capa, título, preço e descrição;
- página de blog lista apenas artigos publicados;
- página de artigo abre pelo slug;
- páginas institucionais carregam sem erro.

### 3. Área do aluno

- lista de cursos liberados;
- abertura de curso;
- navegação entre módulos e aulas;
- desbloqueio progressivo;
- exibição de botões de aula;
- carregamento de banner do curso do aluno;
- notificação de progresso e status.

### 4. Construtor de cursos

- criação de curso;
- edição de curso;
- criação de módulo;
- criação de aula;
- criação de quiz;
- criação de avaliação final;
- ordenação de módulos e aulas;
- exclusão de itens;
- importação JSON;
- exportação JSON;
- substituição de módulo;
- limpeza completa antes da importação;
- preview da página pública;
- preview da capa e do banner do aluno;
- upload de imagens.

### 5. Blog administrativo

- criação e edição de artigo;
- salvamento de SEO;
- preenchimento de campos via IA;
- upload de imagem de capa;
- revisão e histórico;
- publicação, rascunho e agendamento;
- preview do artigo;
- categorias e tags.

### 6. Notificações

- abertura do modal;
- atualização da lista;
- marcar todas como lidas;
- limpar visualização;
- persistência após reload;
- badge do sino;
- textos com encoding correto;
- contagem consistente.

### 7. Uploads e previews

- upload de capa do curso;
- upload do banner do aluno;
- upload de capa do blog;
- abertura da imagem atual;
- remoção da imagem;
- exibição de estado de upload;
- exibição de preview quando o arquivo já existe.

## Regras de Interface Relevantes

### Campos bloqueados

Alguns campos são apenas informativos e não devem ser editáveis em determinadas telas:

- nome do curso em configurações do curso;
- categoria do curso em páginas derivadas;
- campos herdados do cadastro principal.

### Imagens do curso

Padrões atuais:

- capa principal do curso: `4:3`
- banner da área do aluno: `3:1`

Os testes devem validar:

- presença do preview;
- texto de orientação;
- exibição correta do aspecto esperado;
- ausência de sombra no banner do aluno na página pública.

### Botões de rodapé da aula

Na página pública da aula:

- botões devem aparecer juntos;
- sem identificação visual de origem;
- sem fundo cinza adicional;
- com alinhamento consistente.

No construtor:

- a origem do botão deve aparecer apenas para edição;
- botões globais do curso e do módulo devem ficar marcados como globais.

## Estados de Erro Importantes

Os testes devem cobrir estes cenários:

- falha ao buscar cursos;
- falha ao buscar artigos;
- falha ao carregar módulo dinâmico;
- erro de importação JSON;
- erro de upload de imagem;
- erro de permissão/autorização;
- sessão expirada;
- página inexistente;
- conteúdo vazio;
- campo inválido no formulário;
- API indisponível.

## Dados de Teste Recomendados

### Curso

- curso publicado com capa e banner do aluno;
- curso rascunho;
- curso sem categoria;
- curso com preço;
- curso com preço zerado;
- curso com progresso linear ativado;
- curso com múltiplos módulos.

### Módulo

- módulo com 3 aulas e 1 quiz;
- módulo sem aula publicada;
- módulo com quiz final;
- módulo importado via JSON.

### Aula

- aula com texto rico;
- aula com vídeo;
- aula com arquivos anexados;
- aula com botões de rodapé globais e locais.

### Blog

- artigo publicado;
- rascunho;
- artigo agendado;
- artigo com SEO preenchido;
- artigo com imagem de capa.

## Critérios de Aceitação para Testes Automatizados

Um conjunto de testes gerado a partir deste documento deve conseguir validar:

- carregamento sem erros das rotas críticas;
- visibilidade correta de conteúdos publicados;
- consistência entre admin e público;
- persistência das alterações após salvar;
- comportamento esperado de botões e modais;
- recuperação após refresh;
- ausência de elementos duplicados ou ocultos indevidos;
- integridade dos fluxos de importação/exportação;
- previews e uploads funcionando como esperado.

## Observações de Implementação

- A aplicação usa React + TypeScript.
- O backend principal usa Supabase.
- Há uso de Vite com chunks dinâmicos.
- O projeto possui muitos estados assíncronos e modais, então os testes devem considerar tempo de carregamento e renderização progressiva.
- O build versionado é exibido no footer e muda a cada build local.

## Arquivos Relacionados

- [`README.md`](../../README.md)
- [`docs/specs/course-json-import-export-spec.md`](./course-json-import-export-spec.md)
- [`docs/specs/estrutura-atual-construtor-de-cursos.md`](./estrutura-atual-construtor-de-cursos.md)
- [`docs/specs/lesson-rich-text-blocks-spec.md`](./lesson-rich-text-blocks-spec.md)
- [`docs/specs/SPEC_REVIEWS.md`](./SPEC_REVIEWS.md)
- [`docs/specs/SPEC_NOTIFICATIONS_SYSTEM.md`](./SPEC_NOTIFICATIONS_SYSTEM.md)

## Versão do Documento

- Criado em: `2026-06-11`
- Finalidade: base para geração de testes automatizados na plataforma Test Sprite
