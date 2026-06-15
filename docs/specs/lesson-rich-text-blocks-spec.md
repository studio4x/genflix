# Especificacao tecnica dos blocos de texto rico das aulas

## Objetivo
Este documento descreve, de forma completa, como o LMS modela, edita, serializa, persiste e renderiza os blocos de contedo rico usados no campo `lessons.text_content`.

## Fonte de verdade no codigo
- `src/features/admin/content/content-blocks.ts`
- `src/features/admin/content/content-blocks-renderer.tsx`
- `src/features/admin/content/lesson-image-hotspots-block.tsx`
- `src/pages/admin/builder/lesson-editor-panel.tsx`
- `src/pages/student/student-lesson-page.tsx`
- `src/types/content.ts`
- `src/index.css`

## Modelo de bloco
O contedo de aula textual/hibrida e tratado como uma lista ordenada de blocos (union type `LessonContentBlock`).

```ts
export type LessonContentBlock =
  | { type: 'rich-text'; content: string }
  | { type: 'table'; content: string }
  | { type: 'html'; content: LessonHtmlBlockContent }
  | { type: 'image-hotspots'; content: LessonImageHotspotsBlockContent }
```

A ordem da lista representa exatamente a ordem de exibi??o no player.

## Bloco `rich-text`
### Descri??o
Bloco HTML livre vindo do ReactQuill (editor padrao da aula).

### Toolbar e formatos permitidos no editor
N?o editor de aula (`LessonEditorPanel`), o ReactQuill usa:
- Headers: `h1`, `h2`, `h3`
- Inline: `bold`, `italic`, `underline`, `strike`
- Listas: ordenada e bullet
- Link
- Blockquote
- Code block
- Clean formatting

### Persistencia
- O bloco e salvo como fragmento HTML em `content`.
- Na persistencia final, os blocos sao concatenados por `mergeContent(...)` e gravados em `lessons.text_content`.

### Renderizacao aluno
- Renderizado com `dangerouslySetInnerHTML` dentro de `.lesson-rich-text`.
- Estilos aplicados por `src/index.css` em `.lesson-content-html .lesson-rich-text ...`.

## Bloco `table`
### Descri??o
Bloco de tabela em HTML, editado como codigo bruto (`textarea`) no admin.

### Estrutura esperada
- Deve conter `<table>` v?lido.
- O parser separa tabelas do HTML geral para preservar ordem de blocos.

### Sanitizacao
A funcao `sanitizeTableHtml(tableHtml)` aplica whitelist estrita.

Tags permitidas:
- `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `caption`, `colgroup`, `col`

Atributos permitidos:
- `colspan`, `rowspan`, `scope`, `span`

Remocoes de seguran?a:
- Remove `script`, `style`, `iframe`, `object`, `embed`
- Remove `style`, qualquer `on*`, e atributos fora da whitelist
- Remove elementos fora da whitelist

Comportamento adicional:
- Celulas vazias (`th`/`td`) recebem `data-empty-cell="true"` para placeholder visual.

### Renderizacao aluno
- Encapsulada em card com `overflow-x-auto`.
- HTML sanitizado inserido via `dangerouslySetInnerHTML`.
- Estilos globais de tabela e placeholder em `src/index.css`.

## Bloco `html`
### Descri??o
Bloco para apresentar HTML complexo em uma aula, com duas origens possiveis:
- colagem direta do codigo HTML;
- upload de um arquivo `.html` ou `.htm`.

### Tipo de dados
`LessonHtmlBlockContent`:

```ts
{
  source_type: 'paste' | 'upload'
  html: string
  storage_path: string
  signed_url: string | null
  file_name: string
  mime_type: string | null
}
```

### Persistencia
- O HTML e guardado no payload do bloco e serializado dentro de `lessons.text_content`.
- Quando a origem e upload, o arquivo e salvo em `lesson-content-assets`.

### Renderizacao aluno
- O bloco e exibido em `iframe` com `sandbox` para isolar o conteudo.
- Quando existe `signed_url`, o arquivo enviado e aberto diretamente.
- Quando o HTML e colado, o bloco usa `srcDoc` com o HTML persistido.

### Editor admin
- Alternancia entre `Colar HTML` e `Subir arquivo`.
- Modo de colagem com `textarea` monoespaco.
- Modo de upload com seletor de arquivo HTML e preview interno.

## Bloco `image-hotspots`
### Descri??o
Bloco interativo com imagem base e pontos clicaveis que abrem contedo rico.

### Tipo de dados
`LessonImageHotspotsBlockContent`:

```ts
{
  asset: {
    storage_path: string
    signed_url: string | null
    alt: string
    width: number
    height: number
  }
  hotspots: Array<{
    id: string
    x: number
    y: number
    title: string
    body_html: string
  }>
}
```

### Regras de normalizacao
Aplicadas por `normalizeLessonImageHotspotsBlockContent(...)`:
- `id`: `trim()` e fallback `crypto.randomUUID()`
- `x` e `y`: clamp entre `0` e `100` e arredondamento para 2 casas
- `title`: fallback `Hotspot N`
- `body_html`: sanitizado por `sanitizeHotspotBodyHtml(...)`
- `asset.alt`: fallback `Imagem interativa da aula`
- `asset.width/height`: minimo `1`, fallback `1600x900`

### Sanitizacao de `body_html`
Whitelist de tags:
- `a`, `blockquote`, `br`, `code`, `em`, `h1`, `h2`, `h3`, `li`, `ol`, `p`, `pre`, `s`, `strong`, `u`, `ul`

Whitelist de atributos:
- `href`, `target`, `rel`

Regras de seguran?a:
- Remove `script`, `style`, `iframe`, `object`, `embed`
- Remove `style`, `on*`, e atributos n?o permitidos
- `<a>` so aceita `href` seguro: `https:`, `http:`, `mailto:`, `tel:`, `#`, `/`
- Links sao forcados para `target="_blank"` e `rel="noreferrer noopener"`

### Serializacao no HTML final
O bloco e serializado para um container especial:
- `data-hcm-block="image-hotspots"`
- `data-hcm-payload="<json-encoded-uri-component>"`

O payload contem:
- `asset` (sem expor obrigatriamente `signed_url`)
- `hotspots` normalizados

Tambem e inserido fallback HTML interno (`hcm-image-hotspots-fallback`) com t?tulo/lista de hotspots para casos sem parser customizado.

### Parse revers?o
`splitContent(...)` detecta esses containers, decodifica o payload e remonta o bloco tipado `image-hotspots`.

### Editor admin
`LessonImageHotspotsBlockEditor` oferece:
- Upload de imagem (`lesson-content-assets`)
- Leitura automtica de dimensoes da imagem
- Criacao de hotspot por clique
- Drag and drop para reposicionamento
- Ajuste manual `x/y`
- Edicao de t?tulo
- Edicao de `body_html` via ReactQuill

Toolbar do `body_html`:
- `bold`, `italic`, `underline`
- listas ordenada/bullet
- link
- blockquote
- clean

### Renderizacao aluno
`LessonImageHotspotsBlockRenderer`:
- Exibe imagem base (resolvendo signed URL quando necessrio)
- Renderiza hotspots como botoes absolutos por `%`
- Ao clicar, abre popup responsivo com `title` + `body_html`
- Contedo do popup usa classe `.lesson-hotspots-body`

## Pipeline de persistencia e leitura
### Salvamento (admin)
1. Usurio edita blocos no builder.
2. `mergeContent(blocks)` recompõe HTML unico.
3. Resultado vai para `text_content` da aula.

### Leitura (admin/aluno)
1. `text_content` e lido como HTML unico.
2. `splitContent(text_content)` separa blocos na ordem original.
3. Renderizador escolhe componente conforme `block.type`.

## Regras de fallback e robustez
- Ambiente sem DOM/`DOMParser`: `splitContent` cai para um unico bloco `rich-text` com HTML completo.
- Se havia marca de tabela no HTML bruto, mas parser n?o encontrou `<table>`, o parser cai para bloco unico `rich-text` (evita perda de contedo malformado).
- Fragmentos de tags de tabela dentro de `rich-text` sao removidos desse bloco para evitar mistura semantica com bloco `table`.
- Se payload de `image-hotspots` estiver inv?lido, o bloco e convertido para `rich-text` com o HTML interno remanescente.

## Relacao com `lesson_type`
Os blocos de texto rico so sao editados/renderizados quando `lesson_type` e:
- `text`
- `hybrid`

Para `video`, o contedo textual n?o e foco da tela de aula.

## Seguranca
O sistema usa `dangerouslySetInnerHTML` para renderizacao, por isso a seguran?a depende da sanitizacao por tipo de bloco:
- Tabela: whitelist fechada de tags/atributos
- Hotspot body: whitelist fechada de tags/atributos e validacao de URL de links
- HTML: renderizacao em iframe sandboxed, sem injeção direta no DOM principal
- Rich-text comum: segue o HTML produzido pelo Quill no fluxo normal

## Exemplo de estrutura logica de blocos
```json
[
  {
    "type": "rich-text",
    "content": "<h2>Introducao</h2><p>Texto da aula...</p>"
  },
  {
    "type": "table",
    "content": "<table><thead><tr><th>Etapa</th></tr></thead><tbody><tr><td>Admissao</td></tr></tbody></table>"
  },
  {
    "type": "image-hotspots",
    "content": {
      "asset": {
        "storage_path": "lessons/abc123/imagem.png",
        "alt": "Mapa do procedimento",
        "width": 1920,
        "height": 1080
      },
      "hotspots": [
        {
          "id": "a1",
          "x": 31.5,
          "y": 46.2,
          "title": "Ponto de atencao",
          "body_html": "<p>Descri??o detalhada...</p>"
        }
      ]
    }
  }
]
```

## Checklist rapido para evolucao futura
- N?ovos tipos de bloco exigem atualizar:
  - `LessonContentBlock`
  - `splitContent(...)`
  - `mergeContent(...)`
  - renderizador (`ContentBlocksRenderer`)
  - UI do editor (`LessonEditorPanel`)
- Qualquer bloco com HTML deve definir sanitizacao explicita antes de renderizar.
- Manter compatibilidade retroativa com `text_content` legado em HTML unico.
