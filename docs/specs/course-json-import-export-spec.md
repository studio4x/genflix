# Especificacao Completa do Mdulo de Importacao e Exportacao de Cursos via JSON

## Objetivo

Este documento descreve a implementacao real do m?dulo de importacao e exportacao de cursos via JSON usada no LMS HomeCare Match, para que o mesmo comportamento possa ser reproduzido em outra plataforma com estrutura equivalente.

O m?dulo cobre tres frentes:

1. Importacao e exportacao de curso completo.
2. Importacao e exportacao de m?dulo isolado.
3. Importacao e exportacao de avalia??o final ou quiz de m?dulo.

O foco dest? spec e preservar:

- formato dos payloads;
- regras de normalizacao;
- efeitos colaterais no banco;
- comportamento destrutivo de replace/clear;
- defaults aplicados silenciosamente;
- limitacoes atuais do export/import.

## Escopo Funcional

### Entrada suportada

O sistema aceita JSON em tres formas:

1. Curso completo.
2. Lista de m?dulos.
3. Avalia??o isolada.

O parser aceita tanto JSON puro quanto JSON dentro de bloco Markdown:

```json
{ "title": "..." }
```

ou:

````md
```json
{ "title": "..." }
```
````

### Saida suportada

O sistema exporta:

1. Curso completo em um unico arquivo JSON.
2. Um m?dulo especifico em um unico arquivo JSON.
3. A avalia??o final de um curso em um unico arquivo JSON.

Os arquivos baixados usam `JSON.stringify(data, null, 2)` e nome sanitizado para arquivo.

## Localizacao da Implementacao Original

### Importacao/exportacao de curso e m?dulo

- `src/features/admin/content/api.ts`
- `src/pages/admin/admin-courses-page.tsx`
- `src/app/layouts/admin-course-builder-layout.tsx`

### Importacao/exportacao de avalia??es

- `src/features/admin/assessments/api.ts`
- `src/pages/admin/builder/course-assessments-panel.tsx`

### Tipos estruturais usados pelo m?dulo

- `src/types/content.ts`
- `src/features/assessments/gamified.ts`

## Modos de Operacao

## 1. Importacao de curso completo

Cria um novo curso e depois importa seus m?dulos e quizzes.

Fluxo:

1. Parse do JSON informado.
2. Criacao do curso base em `courses`.
3. Importacao do contedo estrutural em `course_modules`, `lessons`, `assessments`, `assessment_questions`, `assessment_options`, `assessment_case_studies`, `assessment_question_interactions` e `assessment_question_answer_keys`.

Funcao principal:

- `importFullCourse(data, userId)`

## 2. Importacao de contedo em curso existente

Atualiza metadados do curso atual e injeta ou substitui m?dulos/avalia??es.

Funcao principal:

- `importCourseContent(courseId, input, clearExisting = false, moduleIdToReplace)`

Esse fluxo suporta:

- adicionar novos m?dulos ao final do curso;
- substituir um m?dulo existente em linha;
- limpar todo o curso antes de reconstruir;
- importar somente avalia??o final.

## 3. Exportacao de curso completo

Funcao principal:

- `exportFullCourseContent(courseId)`

Retorna um JSON com:

- metadados do curso;
- configura??o de tipos de quiz;
- lista ordenada de m?dulos;
- aulas por m?dulo;
- quizzes de m?dulo completos.

## 4. Exportacao de m?dulo

Funcao principal:

- `exportModuleContent(moduleId)`

Retorna:

- t?tulo e descri??o do m?dulo;
- aulas ordenadas;
- quizzes de m?dulo completos.

## 5. Exportacao de avalia??o final

Funcao principal:

- `exportFinalAssessmentContent(courseId)`

Retorna apenas o contrato da avalia??o.

## Contratos JSON

## 1. Contrato de curso completo

### Estrutura

```json
{
  "title": "Curso de Exemplo",
  "description": "<p>Descri??o em HTML ou texto</p>",
  "workload_minutes": 240,
  "thumbnail_url": "https://...",
  "status": "draft",
  "quiz_type_settings": {
    "single_choice": true,
    "essay_ai": true,
    "drag_drop_labeling": true,
    "fill_in_the_blanks": true,
    "image_hotspot": true,
    "coloring": true,
    "case_study": true
  },
  "modules": [
    {
      "title": "Mdulo 1",
      "description": "Descri??o do m?dulo",
      "lessons": [],
      "assessments": []
    }
  ]
}
```

### Campos aceitos

| Campo | Tipo | Obrigatorio | Observacoes |
|---|---|---|---|
| `title` | string | sim | usado tamb?m para atualizar o curso existente em importacao inline |
| `description` | string | n?o | pode conter HTML |
| `workload_minutes` | number | n?o | se ausente ou falsy, vira `0` na importacao |
| `thumbnail_url` | string | n?o | exportado, mas n?o e reaplicado ao atualizar curso existente |
| `status` | `draft \| published` no import full; export pode trazer `archived` | n?o | no `importFullCourse`, default e `draft` |
| `quiz_type_settings` | objeto | n?o | normalizado antes de persistir |
| `modules` | array | sim | deve conter ao menos um m?dulo, exceto em importacao exclusiva de avalia??o |

### Observacao importante sobre `thumbnail_url`

Existe assimetria na implementacao:

- `importFullCourse` persiste `thumbnail_url` ao criar um novo curso.
- `importCourseContent` n?o atualiza `thumbnail_url` quando recebe um curso completo para um curso ja existente.

Se a outra plataforma quiser reproduzir o comportamento exato, mantenha essa assimetria.
Se quiser corrigir, trate isso como melhoria explicita, n?o como replica fiel.

## 2. Contrato de m?dulo

### Estrutura

```json
{
  "title": "Mdulo 1",
  "description": "Descri??o do m?dulo",
  "lessons": [
    {
      "title": "Aula 1",
      "description": "Descri??o da aula",
      "lesson_type": "video",
      "youtube_url": "https://youtube.com/...",
      "text_content": "<p>Contedo</p>",
      "estimated_minutes": 12
    }
  ],
  "assessments": [
    {
      "title": "Quiz do m?dulo",
      "description": "Descri??o",
      "assessment_type": "module",
      "passing_score": 70,
      "max_attempts": 3,
      "estimated_minutes": 10,
      "questions": [],
      "case_studies": []
    }
  ]
}
```

### Campos aceitos

| Campo | Tipo | Obrigatorio | Observacoes |
|---|---|---|---|
| `title` | string | sim | t?tulo do m?dulo |
| `description` | string | n?o | descri??o textual/HTML |
| `lessons` | array | n?o | aulas do m?dulo |
| `assessments` | array | n?o | quizzes de m?dulo |

### Campos de m?dulo que NAO fazem parte do contrato JSON atual

Os seguintes campos existem no banco, mas n?o sao importados/exportados pelo m?dulo atual:

- `is_required`
- `starts_at`
- `ends_at`
- `release_days_after_enrollment`
- `module_pdf_storage_path`
- `module_pdf_file_name`
- `module_pdf_uploaded_at`

Na pratica:

- exportacao de m?dulo/curso perde esses metadados;
- importacao reconstrutora n?o os rest?ura;
- m?dulo importado usa defaults do banco para o que n?o foi informado.

## 3. Contrato de aula

### Estrutura

```json
{
  "title": "Aula 1",
  "description": "Descri??o da aula",
  "lesson_type": "video",
  "youtube_url": "https://youtube.com/...",
  "text_content": "<p>Contedo da aula</p>",
  "blocks": [
    { "type": "rich-text", "content": "<p>Contedo da aula</p>" }
  ],
  "estimated_minutes": 15
}
```

### Campos aceitos

| Campo | Tipo | Obrigatorio | Observacoes |
|---|---|---|---|
| `title` | string | sim | t?tulo da aula |
| `description` | string | n?o | descri??o curta |
| `lesson_type` | `video \| text \| hybrid` | sim | persistido como veio |
| `youtube_url` | string | n?o | usado em aulas `video` e `hybrid` |
| `text_content` | string | n?o | HTML/texto da aula |
| `blocks` | array | n?o | estrutura completa dos blocos inseridos na aula |
| `estimated_minutes` | number | n?o | default de importacao: `10` |

### Campos de aula que ficam fora da spec atual

N?o sao importados/exportados:

- `is_required`
- `starts_at`
- `ends_at`
- anexos de `lesson_materials`
- acoes de rodape em `lesson_footer_actions`
- assets internos de blocos ricos, exceto quando o HTML referencia URLs externas ou paths persistidos em texto

Observacao:

- a exportacao de aula passa a incluir `blocks` para preservar a estrutura rica do editor;
- `text_content` segue sendo exportado por compatibilidade e continua sendo a base do armazenamento no banco;
- na importacao, quando `blocks` estiver presente, ele tem prioridade na reconstrucao do `text_content`.

## 4. Contrato de avalia??o

### Estrutura

```json
{
  "title": "Avalia??o Final",
  "description": "Descri??o da prova",
  "passing_score": 70,
  "max_attempts": 3,
  "estimated_minutes": 20,
  "questions": [],
  "case_studies": []
}
```

### Campos aceitos

| Campo | Tipo | Obrigatorio | Observacoes |
|---|---|---|---|
| `title` | string | sim | t?tulo da avalia??o |
| `description` | string | n?o | descri??o |
| `passing_score` | number | n?o | default de importacao: `70` |
| `max_attempts` | number | n?o | default de importacao: `3` |
| `estimated_minutes` | number | n?o | default de importacao: `10` |
| `questions` | array | n?o | perguntas avulsas |
| `case_studies` | array | n?o | estudos de caso com perguntas internas |

### Observacao sobre `assessment_type`

N?o export de quiz de m?dulo, cada item dentro de `assessments` recebe:

```json
{ "assessment_type": "module" }
```

Mas o importador de avalia??o n?o depende desse campo. O destino e definido pelo fluxo:

- quiz de m?dulo: criado dentro de um m?dulo;
- avalia??o final: criada ou atualizada como `assessment_type = final`.

## 5. Contrato de pergunta

### Estrutura base

```json
{
  "question_text": "Pergunta",
  "question_type": "single_choice",
  "points": 1,
  "is_required": true,
  "essay_expected_answer": "",
  "options": [],
  "interaction": {},
  "grading": {
    "mode": "partial_by_item",
    "answer_key": {}
  }
}
```

### Campos aceitos

| Campo | Tipo | Obrigatorio | Observacoes |
|---|---|---|---|
| `question_text` | string | sim | enunciado |
| `question_type` | enum | n?o | ha normalizacao silenciosa, detalhada abaixo |
| `points` | number | n?o | default `1`, exceto `essay_ai` standalone que vira `0` |
| `is_required` | boolean | n?o | default `true` |
| `essay_expected_answer` | string | n?o | so persistido para tipos discursivos |
| `options` | array | n?o | apenas para tipos de multipla escolha |
| `interaction` | objeto | n?o | usado em perguntas gamificadas |
| `grading` | objeto | n?o | usado em perguntas gamificadas |

### Tipos de pergunta suportados

- `single_choice`
- `essay_ai`
- `case_study_ai`
- `case_study_single_choice`
- `drag_drop_labeling`
- `fill_in_the_blanks`
- `image_hotspot`
- `coloring`

## 6. Contrato de opcao

```json
{
  "option_text": "Alternativa A",
  "is_correct": true
}
```

Campos:

- `option_text`: string obrigatria.
- `is_correct`: boolean obrigatrio.

## 7. Contrato de estudo de caso

```json
{
  "title": "Caso Clinico 1",
  "case_text": "Texto do caso",
  "questions": [
    {
      "question_text": "Pergunta do caso",
      "question_type": "case_study_single_choice",
      "points": 1,
      "is_required": true,
      "options": [
        { "option_text": "A", "is_correct": true }
      ]
    }
  ]
}
```

Campos:

- `title`: string opcional.
- `case_text`: string obrigatria.
- `questions`: array obrigatria.

## Regras de N?ormalizacao e Defaults

## 1. Parsing tolerante de JSON

Antes de importar, o sistema:

1. faz `trim()`;
2. tenta extrair contedo de bloco Markdown `````json ... `````;
3. tenta `JSON.parse`;
4. se falhar, tenta substituir quebras de linha literais por `\\n` com regex defensiva;
5. no builder, faz uma limpeza adicional de strings:
   - `\\"` vira `"`
   - `\\'` vira `'`

Essa tolerancia existe para lidar com JSON copiado de IA.

## 2. Defaults aplicados na importacao

### Curso

- `workload_minutes`: `0` se ausente/falsy.

### Aula

- `estimated_minutes`: `10` se ausente/falsy.

### Avalia??o

- `passing_score`: `70` se ausente/falsy.
- `max_attempts`: `3` se ausente/falsy.
- `estimated_minutes`: `10` se ausente/falsy.

### Pergunta

- `is_required`: `true` se ausente.
- `points`: `1` se ausente, exceto `essay_ai` fora de estudo de caso, que grava `0`.

## 3. N?ormalizacao de `question_type`

### Fora de estudo de caso

`normalizeImportQuestionType(questionType, false)` aplica:

- `essay_ai` permanece `essay_ai`
- `drag_drop_labeling` permanece
- `fill_in_the_blanks` permanece
- `image_hotspot` permanece
- `coloring` permanece
- qualquer outro valor cai para `single_choice`

Consequencia:

- `single_choice` permanece funcional por cair no default;
- `case_study_single_choice` fora de estudo de caso cai para `single_choice`;
- `case_study_ai` fora de estudo de caso cai para `single_choice`.

### Dentro de estudo de caso

`normalizeImportQuestionType(questionType, true)` aplica:

- `case_study_ai` permanece
- `case_study_single_choice` permanece
- qualquer outro valor cai para `case_study_single_choice`

Consequencia importante:

- `essay_ai` dentro de `case_studies` n?o vira `case_study_ai` automticamente;
- se vier `essay_ai`, o importador rebaixa para `case_study_single_choice`.

Para reproduzir fielmente, mantenha essa regra.

## 4. Regras de opcoes

`options` so sao inseridas se o tipo final da pergunta for de multipla escolha:

- `single_choice`
- `case_study_single_choice`

Para outros tipos, o array e ignorado.

## 5. Regras de interacao e gabarito

Para tipos gamificados:

- `drag_drop_labeling`
- `fill_in_the_blanks`
- `image_hotspot`
- `coloring`

o sistema executa validacao estrutural via `validateInteractionBundle`.

Se o tipo da pergunta n?o for gamificado:

- quaisquer dados anteriores de interacao e gabarito sao apagados;
- `interaction` e `grading` no JSON n?o tem efeito persistente.

## Contrato das Interacoes Gamificadas

## 1. `drag_drop_labeling`

```json
{
  "kind": "drag_drop_labeling",
  "instruction": "Arraste os rótulos para as áreas corretas.",
  "asset": {
    "storage_path": "assessment-assets/arquivo.png",
    "signed_url": "https://...",
    "alt": "Imagem do exercício",
    "width": 1200,
    "height": 800
  },
  "tokens": [
    { "id": "token-1", "label": "Pulmão" }
  ],
  "targets": [
    { "id": "slot-1", "x": 10, "y": 20, "w": 15, "h": 10, "label": "Área 1" }
  ]
}
```

`grading.answer_key` esperado:

```json
{
  "entries": [
    { "slot_id": "slot-1", "token_id": "token-1" }
  ]
}
```

## 2. `fill_in_the_blanks`

```json
{
  "kind": "fill_in_the_blanks",
  "instruction": "Preencha as lacunas.",
  "segments": [
    { "type": "text", "text": "A " },
    { "type": "blank", "id": "blank-1", "placeholder": "resposta" },
    { "type": "text", "text": " correta." }
  ],
  "tokens": [
    { "id": "token-1", "label": "conduta" }
  ],
  "editor_groups": [
    {
      "id": "group-1",
      "leading_text": "A ",
      "blanks": [
        {
          "blank_id": "blank-1",
          "token_id": "token-1",
          "placeholder": "resposta",
          "answer_text": "conduta",
          "trailing_text": " correta."
        }
      ],
      "extra_tokens": []
    }
  ]
}
```

`grading.answer_key` esperado:

```json
{
  "entries": [
    { "slot_id": "blank-1", "token_id": "token-1" }
  ]
}
```

## 3. `image_hotspot`

```json
{
  "kind": "image_hotspot",
  "mode": "single_attempt",
  "instruction": "Clique no hotspot correto.",
  "asset": {
    "storage_path": "assessment-assets/arquivo.png",
    "signed_url": "https://...",
    "alt": "Imagem hotspot",
    "width": 1200,
    "height": 800
  },
  "targets": [
    {
      "id": "hotspot-1",
      "x": 20,
      "y": 30,
      "w": 10,
      "h": 8,
      "label": "Alvo 1",
      "is_correct": true,
      "feedback_text": "Correto"
    }
  ],
  "outside_click_feedback": "Clique em uma área valida.",
  "show_feedback_as_popup": true
}
```

`grading.answer_key` esperado:

```json
{
  "kind": "image_hotspot",
  "correct_target_ids": ["hotspot-1"]
}
```

## 4. `coloring`

### Modo legado

```json
{
  "kind": "coloring",
  "instruction": "Pinte as áreas.",
  "asset": {
    "storage_path": "assessment-assets/arquivo.png",
    "signed_url": "https://...",
    "alt": "Imagem para colorir",
    "width": 1200,
    "height": 800
  },
  "tokens": [
    { "id": "color-1", "label": "Azul", "hex": "#2563eb" }
  ],
  "targets": [
    { "id": "area-1", "x": 10, "y": 10, "w": 20, "h": 20, "label": "Area 1" }
  ]
}
```

### Modo SVG

```json
{
  "kind": "coloring",
  "render_mode": "svg_regions",
  "instruction": "Pinte as regiões.",
  "asset": {
    "storage_path": "assessment-assets/arquivo.svg",
    "signed_url": "https://...",
    "alt": "Imagem para colorir",
    "width": 1200,
    "height": 800
  },
  "svg_markup": "<svg>...</svg>",
  "tokens": [
    { "id": "color-1", "label": "Azul", "hex": "#2563eb" }
  ],
  "regions": [
    { "region_id": "region-1", "label": "Região 1" }
  ]
}
```

`grading.answer_key` esperado:

```json
{
  "entries": [
    { "slot_id": "area-1", "token_id": "color-1" }
  ]
}
```

ou, no modo SVG, usando `region_id` como `slot_id`.

## Ordem e Posicionamento

## 1. Mdulos

Na importacao incremental:

- busca-se o maior `position` atual do curso;
- novos m?dulos entram a partir dali.

Na substituicao de m?dulo:

- o m?dulo existente e mantido;
- seu t?tulo e descri??o sao atualizados;
- suas aulas e quizzes sao apagados;
- o contedo novo e recriado dentro do mesmo m?dulo;
- se vierem m?dulos adicionais no JSON, os demais sao inseridos depois dos existentes.

## 2. Aulas

As aulas sao inseridas na ordem do array com `position = index + 1`.

## 3. Avalia??es

Quizzes de m?dulo sao criados em ordem de iteracao.

## 4. Perguntas

### Perguntas avulsas

Recebem `position` sequencial crescente.

### Estudos de caso

Cada estudo de caso ocupa um `position` unico no fluxo da avalia??o.
Todas as perguntas internas do caso recebem esse mesmo `position`, e a ordem interna e controlada por `case_question_position`.

Isso significa:

- a avalia??o mistura perguntas avulsas e blocos de estudo de caso em um eixo unico;
- dentro de um caso, a ordem visivel depende de `case_question_position`.

## Comportamento Destrutivo

## 1. `clearExisting = true`

Executa `clearCourseContent(courseId)`.

Isso:

1. apaga primeiro as avalia??es sem m?dulo do curso, ou seja, a avalia??o final;
2. apaga todos os m?dulos do curso;
3. depende de cascade delete no banco para remover:
   - aulas;
   - materiais;
   - quizzes de m?dulo;
   - questoes;
   - opcoes;
   - estudos de caso;
   - interacoes e gabaritos relacionados.

Esse modo e destrutivo e reinicia o curso do zero.

## 2. Substituicao em linha de m?dulo

`replaceModuleContentInPlace(courseId, moduleId, moduleData)` faz:

1. update de `title` e `description` do m?dulo;
2. delete de todas as avalia??es do m?dulo;
3. delete de todas as aulas do m?dulo;
4. recria??o das aulas;
5. recria??o dos quizzes.

Campos do m?dulo fora do contrato JSON permanecem como estavam, exceto o que foi apagado por cascata.

## 3. Importacao de avalia??o final

Quando o input e somente avalia??o:

1. faz `upsert` da avalia??o final com conflito em `course_id, assessment_type`;
2. apaga todos os estudos de caso da avalia??o;
3. apaga todas as questoes da avalia??o;
4. recria tudo.

## Comportamento de Exportacao

## 1. O que o export preserva

### Curso completo

- `title`
- `description`
- `workload_minutes`
- `thumbnail_url`
- `status`
- `quiz_type_settings`
- m?dulos ordenados
- aulas ordenadas
- quizzes de m?dulo completos

### Mdulo

- `title`
- `description`
- aulas
- quizzes de m?dulo

### Avalia??o

- `title`
- `description`
- `passing_score`
- `max_attempts`
- `estimated_minutes`
- perguntas avulsas
- estudos de caso
- interacoes gamificadas
- gabaritos gamificados

## 2. O que o export NAO preserva

### Curso

- `display_order`
- `has_linear_progression`
- `created_by`
- timest?mps

### Mdulo

- `is_required`
- janelas de libera??o
- PDF do m?dulo
- timest?mps

### Aula

- `is_required`
- datas de libera??o
- materiais anexos
- acoes de rodape
- timest?mps

### Avalia??o

- `is_required`
- `is_active`
- `created_by`
- timest?mps

### Perguntas/opcoes

- IDs de banco
- timest?mps

## Entidades de Banco Impactadas

O m?dulo atual interage diretamente com est?s tabelas:

- `courses`
- `course_modules`
- `lessons`
- `assessments`
- `assessment_questions`
- `assessment_options`
- `assessment_case_studies`
- `assessment_question_interactions`
- `assessment_question_answer_keys`

Dependendo do modo destrutivo, a consistencia depende de cascade delete entre essas entidades.

## Pseudofluxos para Reimplementar

## 1. Criar curso completo

```text
parse input
criar curso em courses
para cada m?dulo:
  criar m?dulo
  para cada aula:
    criar aula
  para cada quiz:
    criar assessment module
    importar estrutura da avalia??o
retornar curso criado
```

## 2. Importar em curso existente

```text
parse input
se clearExisting:
  apagar avalia??o final
  apagar m?dulos

se input tiver modules:
  atualizar metadados do curso atual

se input for avalia??o apenas:
  criar/atualizar assessment final
  limpar questoes e estudos de caso
  recriar estrutura da avalia??o
  encerrar

se houver moduleIdToReplace:
  atualizar m?dulo alvo
  apagar aulas e quizzes desse m?dulo
  recriar contedo com o primeiro m?dulo do JSON
  se houver m?dulos adicionais:
    inseri-los depois

se n?o houver replace:
  inserir todos os m?dulos no final do curso
```

## 3. Exportar curso completo

```text
carregar curso
carregar m?dulos ordenados
para cada m?dulo:
  carregar aulas ordenadas
  carregar quizzes de m?dulo
  exportar cada quiz
retornar objeto final
```

## Regras de UX da Implementacao Original

## 1. Importacao aceita JSON vindo de IA

O texto da UI explicitamente orienta colar JSON gerado por IA.

Por isso, a implementacao inclui:

- remo??o de fences Markdown;
- parse tolerante;
- tentativa de corrigir quebras de linha;
- limpeza de escape adicional em algumas telas.

## 2. Modos expostos ao admin

N?o builder de curso existente, a UI permite:

- adicionar novos m?dulos;
- substituir um m?dulo existente;
- limpar todo o curso antes.

Na p?gina de cursos, a UI permite:

- importar um curso completo e criar um curso novo.

Na tela de avalia??es, a UI permite:

- importar JSON para avalia??o final;
- importar JSON para criar novo quiz de m?dulo.

## Limitacoes e Gaps Conhecidos

## 1. Round-trip n?o e total

Exportar e reimportar um curso n?o preserva 100% da plataforma.

Perdem-se principalmente:

- regras de libera??o de m?dulo/aula;
- obrigatoriedade de m?dulo/aula;
- materiais anexos;
- botoes/acoes de rodape;
- PDF de m?dulo;
- `has_linear_progression`;
- flags de `is_required` e `is_active` em avalia??o.

## 2. `thumbnail_url` n?o e atualizado em importacao inline

Ja descrito acima. E um gap de compatibilidade da implementacao atual.

## 3. N?ormalizacao de tipos em estudo de caso e agressiva

Dentro de `case_studies`, qualquer tipo n?o explicito cai para `case_study_single_choice`.

## 4. Dependencia de assets externos

Interacoes gamificadas exportam `storage_path` e eventualmente `signed_url`, mas a reutilizacao desses assets em outra plataforma so funciona se:

- o mesmo bucket/storage existir;
- os arquivos ainda existirem;
- os paths forem v?lidos no ambiente de destino.

Se a nova plataforma usar outro storage, sera necessrio:

1. migrar os arquivos;
2. reescrever `storage_path`;
3. opcionalmente recalcular `signed_url`.

## 5. Dependencia de integridade no banco

O m?dulo assume integridade referencial correta e deletes em cascata entre tabelas relacionadas.
Sem isso, o modo destrutivo pode falhar ou deixar lixo relacional.

## Recomendacoes para Reimplementacao na Outra Plataforma

1. Preserve os mesmos contratos JSON para compatibilidade operacional com este LMS.
2. Mantenha o parser tolerante a bloco Markdown e a quebras de linha ruins.
3. Implemente importacao em transacao quando a stack permitir, porque o fluxo atual e multi-etapas e pode ficar parcial em caso de erro.
4. Decida explicitamente se deseja copiar os gaps atuais ou corrigi-los.
5. Se houver storage diferente, trate assets gamificados como uma camada separada da importacao estrutural.
6. Se precisar de round-trip completo, estenda o contrato para incluir metadados hoje ignorados.

## Contratos Minimos para Compatibilidade

Se a prioridade for compatibilidade e n?o replica integral de interface, a outra plataforma precisa no minimo suportar:

- curso com `title`, `description`, `workload_minutes`, `status`, `quiz_type_settings`, `modules`;
- m?dulo com `title`, `description`, `lessons`, `assessments`;
- aula com `title`, `description`, `lesson_type`, `youtube_url`, `text_content`, `estimated_minutes`;
- avalia??o com `title`, `description`, `passing_score`, `max_attempts`, `estimated_minutes`, `questions`, `case_studies`;
- perguntas de:
  - `single_choice`
  - `essay_ai`
  - `case_study_ai`
  - `case_study_single_choice`
  - `drag_drop_labeling`
  - `fill_in_the_blanks`
  - `image_hotspot`
  - `coloring`

## Exemplo Completo de Curso

```json
{
  "title": "Boas Praticas em Home Care",
  "description": "<p>Curso introdutorio.</p>",
  "workload_minutes": 180,
  "thumbnail_url": "https://cdn.exemplo.com/thumb.jpg",
  "status": "published",
  "quiz_type_settings": {
    "single_choice": true,
    "essay_ai": true,
    "drag_drop_labeling": true,
    "fill_in_the_blanks": true,
    "image_hotspot": true,
    "coloring": true,
    "case_study": true
  },
  "modules": [
    {
      "title": "Fundamentos",
      "description": "Base teorica",
      "lessons": [
        {
          "title": "Introducao",
          "description": "Visao geral",
          "lesson_type": "hybrid",
          "youtube_url": "https://www.youtube.com/watchv=abc123",
          "text_content": "<p>Contedo introdutorio</p>",
          "estimated_minutes": 15
        }
      ],
      "assessments": [
        {
          "title": "Quiz Fundamentos",
          "description": "Checagem inicial",
          "assessment_type": "module",
          "passing_score": 70,
          "max_attempts": 3,
          "estimated_minutes": 10,
          "questions": [
            {
              "question_text": "Qual e a conduta inicial",
              "question_type": "single_choice",
              "points": 1,
              "is_required": true,
              "options": [
                { "option_text": "Opcao A", "is_correct": true },
                { "option_text": "Opcao B", "is_correct": false }
              ]
            }
          ],
          "case_studies": [
            {
              "title": "Caso 1",
              "case_text": "Paciente em atendimento domiciliar...",
              "questions": [
                {
                  "question_text": "Qual seria a melhor decisao",
                  "question_type": "case_study_single_choice",
                  "points": 1,
                  "is_required": true,
                  "options": [
                    { "option_text": "Alternativa 1", "is_correct": false },
                    { "option_text": "Alternativa 2", "is_correct": true }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Resumo Executivo

O m?dulo atual e um importador/exportador estrutural de curso, n?o um backup integral da plataforma.
Ele funciona muito bem para:

- clonar curso;
- portar curso entre ambientes;
- alimentar construcao por IA;
- reconstruir m?dulos e quizzes rapidamente.

Ele n?o cobre, por padrao:

- todo o ecossistema de anexos;
- toda a configura??o de libera??o;
- todo o est?do operacional do curso.

Se a outra plataforma usar a mesma modelagem base, replicar este contrato e suficiente para compatibilidade funcional de contedo.
