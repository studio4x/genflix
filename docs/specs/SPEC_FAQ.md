# ESPECIFICAÇÕES - MÓDULO DE FAQ (PERGUNTAS FREQUENTES)

## Visão Geral

Módulo de **FAQ** centraliza perguntas e respostas da plataforma para reduzir volume de suporte, melhorar conversão e acelerar onboarding de usuários (candidatos, empresas, afiliados e admins). Inclui busca, categorização, ranqueamento por relevância, analytics e gestão editorial via painel administrativo.

---

## 1. ARQUITETURA

### Objetivos do Módulo

- Disponibilizar respostas rápidas e confiáveis para dúvidas recorrentes
- Reduzir tickets repetitivos no suporte
- Melhorar SEO com conteúdo de intenção informacional
- Permitir governança editorial (workflow, revisão e publicação)

### Canais de Exposição

| Canal | Local | Público | Função |
|------|------|---------|--------|
| **Página pública FAQ** | `/faq` | Visitantes + usuários logados | Consulta geral |
| **Contextual in-app** | Tooltips/cards em fluxos críticos | Usuários logados | Ajuda contextual |
| **Busca global** | Barra de busca principal | Todos | Encontrar FAQ junto com outros conteúdos |
| **Admin FAQ** | `/admin/faq` | Time interno | CRUD + analytics |

### Tipos de Conteúdo

```
- Pergunta e resposta textual
- Passo a passo (lista ordenada)
- Links internos (documentação/páginas)
- Vídeo curto opcional (URL externa)
- CTA final (ex: "Abrir ticket")
```

---

## 2. TABELAS DE BANCO DE DADOS

### `faq_categories`

```sql
id UUID PRIMARY KEY
slug VARCHAR UNIQUE NOT NULL -- ex: "planos-pagamentos"
name VARCHAR(120) NOT NULL
description TEXT
icon VARCHAR(80) -- opcional (nome de ícone)
display_order INTEGER DEFAULT 0
is_active BOOLEAN DEFAULT true

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `faq_articles`

```sql
id UUID PRIMARY KEY
category_id UUID (FK faq_categories.id)
slug VARCHAR UNIQUE NOT NULL -- ex: "como-cancelar-assinatura"
question VARCHAR(220) NOT NULL
answer_md TEXT NOT NULL -- markdown
answer_html TEXT -- cache opcional para render
summary VARCHAR(300)
tags TEXT[] -- ['assinatura','cancelamento']

-- SEO
seo_title VARCHAR(70)
seo_description VARCHAR(160)
canonical_url TEXT

-- Conteúdo
video_url TEXT
cta_label VARCHAR(80)
cta_url TEXT

-- Controle editorial
status ENUM: 'draft'|'in_review'|'published'|'archived'
version INTEGER DEFAULT 1
published_at TIMESTAMP
published_by UUID (FK profiles.id)
created_by UUID (FK profiles.id)
updated_by UUID (FK profiles.id)

-- Relevância
is_featured BOOLEAN DEFAULT false
helpful_count INTEGER DEFAULT 0
not_helpful_count INTEGER DEFAULT 0
views_count INTEGER DEFAULT 0

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `faq_article_revisions`

```sql
id UUID PRIMARY KEY
article_id UUID (FK faq_articles.id)
version INTEGER NOT NULL
question VARCHAR(220)
answer_md TEXT
change_notes TEXT
changed_by UUID (FK profiles.id)

created_at TIMESTAMP
```

### `faq_feedback`

```sql
id UUID PRIMARY KEY
article_id UUID (FK faq_articles.id)
user_id UUID NULL (FK profiles.id) -- visitante pode ser null
session_id TEXT -- para visitantes anônimos
is_helpful BOOLEAN NOT NULL
comment TEXT NULL

created_at TIMESTAMP
```

### `faq_search_logs`

```sql
id UUID PRIMARY KEY
query TEXT NOT NULL
results_count INTEGER DEFAULT 0
clicked_article_id UUID NULL (FK faq_articles.id)
user_id UUID NULL (FK profiles.id)
session_id TEXT
source VARCHAR -- 'faq_page'|'global_search'|'contextual_help'

created_at TIMESTAMP
```

---

## 3. COMPONENTES (FRONTEND)

### FAQHomePage

**Localização sugerida**: `src/pages/FAQPage.tsx`

**Blocos**:
- Hero com campo de busca
- Grid de categorias
- FAQs em destaque
- Lista por categoria (accordion)
- CTA final para suporte

### FAQSearchBar

```typescript
<FAQSearchBar
  placeholder="Busque sua dúvida"
  onSearch={handleSearch}
  debounceMs={300}
/>
```

### FAQAccordionItem

```typescript
<FAQAccordionItem
  question={article.question}
  answerHtml={article.answer_html}
  onOpen={() => trackView(article.id)}
/>
```

### FAQHelpfulVote

```typescript
<FAQHelpfulVote
  articleId={article.id}
  onVote={(isHelpful) => submitVote(article.id, isHelpful)}
/>
```

---

## 4. FLUXO FUNCIONAL

### Publicação de Artigo

```text
1. Admin cria artigo (draft)
2. Editor revisa (in_review)
3. Aprovação -> status published
4. Cache invalidation (faq + busca)
5. Artigo disponível em /faq e busca global
```

### Consulta de Usuário

```text
1. Usuário acessa /faq
2. Busca por termo ou navega por categoria
3. Abre artigo
4. Sistema incrementa view_count
5. Usuário vota "foi útil?"
6. Feedback alimenta ranking de relevância
```

### No Results (Zero-Result)

```text
1. Busca sem resultado
2. Exibir sugestões automáticas (top FAQs + categorias)
3. CTA: "Não encontrou? Abrir ticket"
4. Registrar query em faq_search_logs
```

---

## 5. ENDPOINTS / EDGE FUNCTIONS

### `get-faq-categories`

```text
GET /functions/v1/get-faq-categories
Auth: opcional
Response: { categories[] }
```

### `search-faq`

```text
GET /functions/v1/search-faq?q=assinatura&category=planos&limit=20
Auth: opcional
Response: { items[], total, took_ms, suggestions[] }
```

### `get-faq-article`

```text
GET /functions/v1/get-faq-article?slug=como-cancelar-assinatura
Auth: opcional
Response: { article, related_articles[] }
```

### `vote-faq-helpful`

```text
POST /functions/v1/vote-faq-helpful
Auth: opcional (aceita anônimo)
Body: { article_id: UUID, is_helpful: boolean, comment?: string }
Response: { success: true }
```

### `admin-upsert-faq-article`

```text
POST /functions/v1/admin-upsert-faq-article
Auth: Bearer token (admin/editor)
Body: { ...articlePayload }
Response: { id, status, version }
```

### `admin-publish-faq-article`

```text
POST /functions/v1/admin-publish-faq-article
Auth: Bearer token (admin/editor)
Body: { article_id: UUID }
Response: { success: true, published_at }
```

---

## 6. BUSCA E RELEVÂNCIA

### Estratégia de Busca

```text
- Full-text em question + answer_md + tags
- Boost por título da pergunta
- Boost por helpful_rate
- Boost por recência de atualização
```

### Score Sugerido

```text
score =
  (text_rank * 0.55)
+ (helpful_rate * 0.20)
+ (views_normalized * 0.10)
+ (freshness * 0.10)
+ (is_featured * 0.05)
```

### Sinônimos (exemplos)

```text
"cancelar" ~ "encerrar" ~ "desativar"
"pagamento" ~ "cobrança" ~ "fatura"
"candidato" ~ "profissional" ~ "cuidador"
```

---

## 7. PÁGINA ADMIN - `/admin/faq`

### Features

#### 1. Gestão de Categorias

```text
- Criar/editar/ordenar categorias
- Ativar/desativar categoria
- Definir ícone e descrição
```

#### 2. Gestão de Artigos

```text
- Criar artigo (editor markdown)
- Salvar rascunho
- Enviar para revisão
- Publicar/despublicar
- Duplicar artigo
- Arquivar
```

#### 3. Moderação de Feedback

```text
- Ver comentários negativos
- Marcar como "revisado"
- Criar tarefa para ajuste de conteúdo
```

#### 4. Analytics de FAQ

```text
- Top artigos mais vistos
- Helpful rate por artigo
- Queries sem resultado
- Redução de tickets por tema
```

---

## 8. LAYOUT & UX - `/admin/faq`

### Estrutura (Desktop)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ FAQ Admin                                          [Período ▼] [Exportar]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ KPI: Artigos Publicados | Helpful Rate | Zero-Result Queries | Views       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tabs: [Artigos] [Categorias] [Feedback] [Analytics]                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filtros: Status ▼ Categoria ▼ Autor ▼ Busca [__________]  [Novo Artigo]    │
├───────────────────────────────────────────────┬─────────────────────────────┤
│ Lista/tabela                                  │ Painel de detalhes          │
│ - draft/review/published                      │ - preview markdown          │
│ - ordenação e paginação                       │ - histórico de revisões     │
│ - ações rápidas                               │ - métricas do artigo        │
└───────────────────────────────────────────────┴─────────────────────────────┘
```

### Estados de Tela

```text
loading: skeleton em KPIs e tabela
empty: "Nenhum artigo encontrado"
error: "Falha ao carregar FAQ" + retry
no_permission: sem acesso ao módulo
```

### Regras de Interação

- Busca com debounce de 400ms
- Filtros persistidos na URL
- Autosave no editor (a cada 15s)
- Confirmação para despublicar/arquivar
- Preview em tempo real (markdown -> html)

---

## 8.1 LAYOUTS DETALHADOS DAS PÁGINAS ADMIN

### A. Página: Lista de Artigos (`/admin/faq`)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ FAQ Admin / Artigos                                 [Novo Artigo] [Exportar]│
├─────────────────────────────────────────────────────────────────────────────┤
│ Filtros: Status ▼ Categoria ▼ Autor ▼ Atualizado em ▼ Busca [___________]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tabela:                                                                     │
│ [ ] Pergunta | Categoria | Status | Helpful % | Views | Updated At | Ações │
│ [ ] ...                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Ações em lote: [Publicar] [Arquivar] [Mover Categoria] [Excluir Draft]     │
│ Paginação: « 1 2 3 ... »                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Colunas mínimas**:
- `question`
- `category`
- `status` (`draft`, `in_review`, `published`, `archived`)
- `helpful_rate`
- `views_count`
- `updated_at`
- `updated_by`

**Ações por linha**:
- `Editar`
- `Duplicar`
- `Publicar/Despublicar` (conforme status)
- `Arquivar`
- `Ver histórico`

### B. Página: Editor de Artigo (`/admin/faq/novo` e `/admin/faq/:id/editar`)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Editor FAQ                                   [Salvar Draft] [Enviar Revisão]│
├─────────────────────────────────────────────────────────────────────────────┤
│ Pergunta: [______________________________________________________________]  │
│ Slug:     [_______________________]  Categoria: [______________ ▼]          │
│ Tags:     [assinatura] [cancelamento] [+]                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ SEO: Título [____________________] Descrição [___________________________]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Resposta (Markdown)                   | Preview                             │
│ ------------------------------------- | ----------------------------------- │
│ # Como cancelar...                    | Como cancelar...                    │
│ 1. Acesse ...                         | 1. Acesse ...                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ CTA Label [____________]  CTA URL [______________________________________]  │
│ Vídeo URL [______________________________________________________________]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Histórico de versões | Comentários de revisão | Checklist de publicação     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Checklist de publicação (bloqueios)**:
- Pergunta preenchida
- Resposta com mínimo de conteúdo
- Categoria definida
- `seo_title` e `seo_description` válidos
- Sanitização sem erro

### C. Página: Categorias (`/admin/faq/categorias`)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ FAQ Admin / Categorias                                      [Nova Categoria]│
├─────────────────────────────────────────────────────────────────────────────┤
│ Lista ordenável (drag and drop):                                            │
│ [↕] Conta e Acesso      (12 artigos) [Ativa] [Editar] [Desativar]          │
│ [↕] Planos e Pagamentos (18 artigos) [Ativa] [Editar] [Desativar]          │
│ [↕] Suporte Técnico      (6 artigos) [Ativa] [Editar] [Desativar]          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Formulário lateral: Nome, Slug, Ícone, Descrição, Status, Ordem            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Regras**:
- Não permitir excluir categoria com artigos publicados (apenas desativar ou mover artigos)
- Slug único
- Ordem persistida por `display_order`

### D. Página: Feedback (`/admin/faq/feedback`)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ FAQ Admin / Feedback                                  [Exportar CSV]        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filtros: Tipo ▼ (útil/não útil) Categoria ▼ Período ▼ Sem comentário ☑     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tabela: Data | Artigo | Voto | Comentário | Usuário | Status revisão | Ação│
│ ...                                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Painel de ação rápida: [Marcar revisado] [Criar tarefa conteúdo]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Fluxo operacional**:
- Item negativo relevante -> criar tarefa de conteúdo
- Vincular tarefa ao artigo
- Reprocessar métrica após atualização do artigo

### E. Página: Analytics (`/admin/faq/analytics`)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ FAQ Admin / Analytics                               [Período ▼] [Comparar]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ KPI: Views | Helpful Rate | Search Success | Zero-Result | Deflection Rate │
├─────────────────────────────────────────────────────────────────────────────┤
│ Gráfico 1: Views por dia                                                    │
│ Gráfico 2: Helpful rate por categoria                                       │
│ Gráfico 3: Top queries sem resultado                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tabela: Top artigos (views, helpful, exits, avg time)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Blocos obrigatórios**:
- `Top 20` queries sem resultado
- `Top 20` artigos com menor helpful rate
- Correlação `tema FAQ x volume de tickets`

### F. Responsividade (Admin FAQ)

```text
- Breakpoint <= 1024px: tabela vira cards com ações em menu kebab
- Breakpoint <= 768px: filtros colapsam em drawer
- Editor: preview passa para aba separada (não side-by-side)
- Botões primários em sticky footer no mobile
```

### G. Estados e Mensagens Padrão (Admin)

```text
loading:
- \"Carregando dados do FAQ...\"

empty:
- \"Nenhum item encontrado com os filtros atuais.\"

error:
- \"Não foi possível carregar os dados. Tente novamente.\"

success:
- \"Alterações salvas com sucesso.\"

validation_error:
- \"Revise os campos obrigatórios antes de publicar.\"
```

---

## 9. PERMISSÕES (RBAC)

| Ação | Role sugerida |
|------|---------------|
| Ver `/admin/faq` | `admin`, `editor`, `support_lead` |
| Criar/editar artigo | `admin`, `editor` |
| Publicar/despublicar | `admin`, `editor_senior` |
| Gerir categorias | `admin` |
| Ver analytics completo | `admin`, `support_lead` |

### Segurança

```text
- Sanitização de markdown (anti-XSS)
- Rate limit no voto "foi útil"
- Revalidação de permissão no backend
- Logs de auditoria para publicação e arquivamento
```

---

## 10. SEO E CONTEÚDO

### Boas Práticas

- URL amigável por `slug`
- `seo_title` e `seo_description` por artigo
- Dados estruturados FAQPage (schema.org)
- Canonical URL para evitar conteúdo duplicado
- Interlinking com páginas de produto/planos/suporte

### Exemplo de JSON-LD (FAQPage)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Como cancelar minha assinatura?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Você pode cancelar em Configurações > Assinatura..."
      }
    }
  ]
}
```

---

## 11. MÉTRICAS E OBSERVABILIDADE

### KPIs Principais

```text
- FAQ deflection rate (% tickets evitados)
- Helpful rate global e por categoria
- Search success rate (buscas com clique)
- Zero-result rate
- Tempo médio até resposta encontrada
```

### Alertas Operacionais

```text
- zero_result_rate > 20% por 24h
- helpful_rate < 60% em categoria crítica
- erro de busca > 2% por 15 min
```

---

## 12. CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Tabelas: faq_categories, faq_articles, faq_revisions, faq_feedback, faq_search_logs
- [ ] Página pública `/faq`
- [ ] Busca full-text com ranking
- [ ] Feedback "Foi útil?"
- [ ] Painel `/admin/faq` (CRUD + workflow)
- [ ] Controle de revisão/publicação
- [ ] Analytics + queries sem resultado
- [ ] Schema.org FAQPage
- [ ] Sanitização markdown + proteção XSS
- [ ] Auditoria de ações administrativas

---

## 13. ROADMAP

- [ ] Sugestão automática de FAQ por IA no suporte
- [ ] Tradução multilíngue (PT/EN/ES)
- [ ] FAQ contextual por etapa do funil
- [ ] Teste A/B de resposta (versão curta vs longa)
- [ ] Recomendação personalizada por perfil
- [ ] Integração com chatbot

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: 🟡 Planejado
