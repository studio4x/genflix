# Especificacao Completa do Modulo de Importacao e Exportacao de Cursos via JSON

## Objetivo

Este documento descreve a implementacao real do modulo de importacao e exportacao de cursos via JSON usada no LMS HomeCare Match, para que o mesmo comportamento possa ser reproduzido em outra plataforma com estrutura equivalente.

O modulo cobre tres frentes:

1. Importacao e exportacao de curso completo.
2. Importacao e exportacao de modulo isolado.
3. Importacao e exportacao de avaliacao final ou quiz de modulo.

O foco desta spec e preservar:

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
2. Lista de modulos.
3. Avaliacao isolada.

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
2. Um modulo especifico em um unico arquivo JSON.
3. A avaliacao final de um curso em um unico arquivo JSON.

Os arquivos baixados usam `JSON.stringify(data, null, 2)` e nome sanitizado para arquivo.

## Localizacao da Implementacao Original

### Importacao/exportacao de curso e modulo

- `src/features/admin/content/api.ts`
- `src/pages/admin/admin-courses-page.tsx`
- `src/app/layouts/admin-course-builder-layout.tsx`

### Importacao/exportacao de avaliacoes

- `src/features/admin/assessments/api.ts`
- `src/pages/admin/builder/course-assessments-panel.tsx`

### Tipos estruturais usados pelo modulo

- `src/types/content.ts`
- `src/features/assessments/gamified.ts`

## Modos de Operacao

## 1. Importacao de curso completo

Cria um novo curso e depois importa seus modulos e quizzes.

Fluxo:

1. Parse do JSON informado.
2. Criacao do curso base em `courses`.
3. Importacao do conteudo estrutural em `course_modules`, `lessons`, `assessments`, `assessment_questions`, `assessment_options`, `assessment_case_studies`, `assessment_question_interactions` e `assessment_question_answer_keys`.

Funcao principal:

- `importFullCourse(data, userId)`

## 2. Importacao de conteudo em curso existente

Atualiza metadados do curso atual e injeta ou substitui modulos/avaliacoes.

Funcao principal:

- `importCourseContent(courseId, input, clearExisting = false, moduleIdToReplace?)`

Esse fluxo suporta:

- adicionar novos modulos ao final do curso;
- substituir um modulo existente em linha;
- limpar todo o curso antes de reconstruir;
- importar somente avaliacao final.

## 3. Exportacao de curso completo

Funcao principal:

- `exportFullCourseContent(courseId)`

Retorna um JSON com:

- metadados do curso;
- configuracao de tipos de quiz;
- lista ordenada de modulos;
- aulas por modulo;
- quizzes de modulo completos.

## 4. Exportacao de modulo

Funcao principal:

- `exportModuleContent(moduleId)`

Retorna:

- titulo e descricao do modulo;
- aulas ordenadas;
- quizzes de modulo completos.

## 5. Exportacao de avaliacao final

Funcao principal:

- `exportFinalAssessmentContent(courseId)`

Retorna apenas o contrato da avaliacao.

## Contratos JSON

## 1. Contrato de curso completo

### Estrutura

```json
{
  "title": "Curso de Exemplo",
  "description": "<p>Descricao em HTML ou texto</p>",
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
      "title": "Modulo 1",
      "description": "Descricao do modulo",
      "lessons": [],
      "assessments": []
    }
  ]
}
```

### Campos aceitos

| Campo | Tipo | Obrigatorio | Observacoes |
|---|---|---|---|
| `title` | string | sim | usado tambem para atualizar o curso existente em importacao inline |
| `description` | string | nao | pode conter HTML |
| `workload_minutes` | number | nao | se ausente ou falsy, vira `0` na importacao |
| `thumbnail_url` | string | nao | exportado, mas nao e reaplicado ao atualizar curso existente |
| `status` | `draft \| published` no import full; export pode trazer `archived` | nao | no `importFullCourse`, default e `draft` |
| `quiz_type_settings` | objeto | nao | normalizado antes de persistir |
| `modules` | array | sim | deve conter ao menos um modulo, exceto em importacao exclusiva de avaliacao |

### Observacao importante sobre `thumbnail_url`

Existe assimetria na implementacao:

- `importFullCourse` persiste `thumbnail_url` ao criar um novo curso.
- `importCourseContent` nao atualiza `thumbnail_url` quando recebe um curso completo para um curso ja existente.

Se a outra plataforma quiser reproduzir o comportamento exato, mantenha essa assimetria.
Se quiser corrigir, trate isso como melhoria explicita, nao como replica fiel.

## 2. Contrato de modulo

### Estrutura

```json
{
  "title": "Modulo 1",
  "description": "Descricao do modulo",
  "lessons": [
    {
      "title": "Aula 1",
      "description": "Descricao da aula",
      "lesson_type": "video",
      "youtube_url": "https://youtube.com/...",
      "text_content": "<p>Conteudo</p>",
      "estimated_minutes": 12
    }
  ],
  "assessments": [
    {
      "title": "Quiz do modulo",
      "description": "Descricao",
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
| `title` | string | sim | titulo do modulo |
| `description` | string | nao | descricao textual/HTML |
| `lessons` | array | nao | aulas do modulo |
| `assessments` | array | nao | quizzes de modulo |

### Campos de modulo que NAO fazem parte do contrato JSON atual

Os seguintes campos existem no banco, mas nao sao importados/exportados pelo modulo atual:

- `is_required`
- `starts_at`
- `ends_at`
- `release_days_after_enrollment`
- `module_pdf_storage_path`
- `module_pdf_file_name`
- `module_pdf_uploaded_at`

Na pratica:

- exportacao de modulo/curso perde esses metadados;
- importacao reconstrutora nao os restaura;
- modulo importado usa defaults do banco para o que nao foi informado.

## 3. Contrato de aula

### Estrutura

```json
{
  "title": "Aula 1",
  "description": "Descricao da aula",
  "lesson_type": "video",
  "youtube_url": "https://youtube.com/...",
  "text_content": "<p>Conteudo da aula</p>",
  "estimated_minutes": 15
}
```

### Campos aceitos

| Campo | Tipo | Obrigatorio | Observacoes |
|---|---|---|---|
| `title` | string | sim | titulo da aula |
| `description` | string | nao | descricao curta |
| `lesson_type` | `video \| text \| hybrid` | sim | persistido como veio |
| `youtube_url` | string | nao | usado em aulas `video` e `hybrid` |
| `text_content` | string | nao | HTML/texto da aula |
| `estimated_minutes` | number | nao | default de importacao: `10` |

### Campos de aula que ficam fora da spec atual

Nao sao importados/exportados:

- `is_required`
- `starts_at`
- `ends_at`
- anexos de `lesson_materials`
- acoes de rodape em `lesson_footer_actions`
- assets internos de blocos ricos, exceto quando o HTML referencia URLs externas ou paths persistidos em texto

## 4. Contrato de avaliacao

### Estrutura

```json
{
  "title": "Avaliacao Final",
  "description": "Descricao da prova",
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
| `title` | string | sim | titulo da avaliacao |
| `description` | string | nao | descricao |
| `passing_score` | number | nao | default de importacao: `70` |
| `max_attempts` | number | nao | default de importacao: `3` |
| `estimated_minutes` | number | nao | default de importacao: `10` |
| `questions` | array | nao | perguntas avulsas |
| `case_studies` | array | nao | estudos de caso com perguntas internas |

### Observacao sobre `assessment_type`

No export de quiz de modulo, cada item dentro de `assessments` recebe:

```json
{ "assessment_type": "module" }
```

Mas o importador de avaliacao nao depende desse campo. O destino e definido pelo fluxo:

- quiz de modulo: criado dentro de um modulo;
- avaliacao final: criada ou atualizada como `assessment_type = final`.

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
| `question_type` | enum | nao | ha normalizacao silenciosa, detalhada abaixo |
| `points` | number | nao | default `1`, exceto `essay_ai` standalone que vira `0` |
| `is_required` | boolean | nao | default `true` |
| `essay_expected_answer` | string | nao | so persistido para tipos discursivos |
| `options` | array | nao | apenas para tipos de multipla escolha |
| `interaction` | objeto | nao | usado em perguntas gamificadas |
| `grading` | objeto | nao | usado em perguntas gamificadas |

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

- `option_text`: string obrigatoria.
- `is_correct`: boolean obrigatorio.

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
- `case_text`: string obrigatoria.
- `questions`: array obrigatoria.

## Regras de Normalizacao e Defaults

## 1. Parsing tolerante de JSON

Antes de importar, o sistema:

1. faz `trim()`;
2. tenta extrair conteudo de bloco Markdown `````json ... `````;
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

### Avaliacao

- `passing_score`: `70` se ausente/falsy.
- `max_attempts`: `3` se ausente/falsy.
- `estimated_minutes`: `10` se ausente/falsy.

### Pergunta

- `is_required`: `true` se ausente.
- `points`: `1` se ausente, exceto `essay_ai` fora de estudo de caso, que grava `0`.

## 3. Normalizacao de `question_type`

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

- `essay_ai` dentro de `case_studies` nao vira `case_study_ai` automaticamente;
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

Se o tipo da pergunta nao for gamificado:

- quaisquer dados anteriores de interacao e gabarito sao apagados;
- `interaction` e `grading` no JSON nao tem efeito persistente.

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

## 1. Modulos

Na importacao incremental:

- busca-se o maior `position` atual do curso;
- novos modulos entram a partir dali.

Na substituicao de modulo:

- o modulo existente e mantido;
- seu titulo e descricao sao atualizados;
- suas aulas e quizzes sao apagados;
- o conteudo novo e recriado dentro do mesmo modulo;
- se vierem modulos adicionais no JSON, os demais sao inseridos depois dos existentes.

## 2. Aulas

As aulas sao inseridas na ordem do array com `position = index + 1`.

## 3. Avaliacoes

Quizzes de modulo sao criados em ordem de iteracao.

## 4. Perguntas

### Perguntas avulsas

Recebem `position` sequencial crescente.

### Estudos de caso

Cada estudo de caso ocupa um `position` unico no fluxo da avaliacao.
Todas as perguntas internas do caso recebem esse mesmo `position`, e a ordem interna e controlada por `case_question_position`.

Isso significa:

- a avaliacao mistura perguntas avulsas e blocos de estudo de caso em um eixo unico;
- dentro de um caso, a ordem visivel depende de `case_question_position`.

## Comportamento Destrutivo

## 1. `clearExisting = true`

Executa `clearCourseContent(courseId)`.

Isso:

1. apaga primeiro as avaliacoes sem modulo do curso, ou seja, a avaliacao final;
2. apaga todos os modulos do curso;
3. depende de cascade delete no banco para remover:
   - aulas;
   - materiais;
   - quizzes de modulo;
   - questoes;
   - opcoes;
   - estudos de caso;
   - interacoes e gabaritos relacionados.

Esse modo e destrutivo e reinicia o curso do zero.

## 2. Substituicao em linha de modulo

`replaceModuleContentInPlace(courseId, moduleId, moduleData)` faz:

1. update de `title` e `description` do modulo;
2. delete de todas as avaliacoes do modulo;
3. delete de todas as aulas do modulo;
4. recriacao das aulas;
5. recriacao dos quizzes.

Campos do modulo fora do contrato JSON permanecem como estavam, exceto o que foi apagado por cascata.

## 3. Importacao de avaliacao final

Quando o input e somente avaliacao:

1. faz `upsert` da avaliacao final com conflito em `course_id, assessment_type`;
2. apaga todos os estudos de caso da avaliacao;
3. apaga todas as questoes da avaliacao;
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
- modulos ordenados
- aulas ordenadas
- quizzes de modulo completos

### Modulo

- `title`
- `description`
- aulas
- quizzes de modulo

### Avaliacao

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
- timestamps

### Modulo

- `is_required`
- janelas de liberacao
- PDF do modulo
- timestamps

### Aula

- `is_required`
- datas de liberacao
- materiais anexos
- acoes de rodape
- timestamps

### Avaliacao

- `is_required`
- `is_active`
- `created_by`
- timestamps

### Perguntas/opcoes

- IDs de banco
- timestamps

## Entidades de Banco Impactadas

O modulo atual interage diretamente com estas tabelas:

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
para cada modulo:
  criar modulo
  para cada aula:
    criar aula
  para cada quiz:
    criar assessment module
    importar estrutura da avaliacao
retornar curso criado
```

## 2. Importar em curso existente

```text
parse input
se clearExisting:
  apagar avaliacao final
  apagar modulos

se input tiver modules:
  atualizar metadados do curso atual

se input for avaliacao apenas:
  criar/atualizar assessment final
  limpar questoes e estudos de caso
  recriar estrutura da avaliacao
  encerrar

se houver moduleIdToReplace:
  atualizar modulo alvo
  apagar aulas e quizzes desse modulo
  recriar conteudo com o primeiro modulo do JSON
  se houver modulos adicionais:
    inseri-los depois

se nao houver replace:
  inserir todos os modulos no final do curso
```

## 3. Exportar curso completo

```text
carregar curso
carregar modulos ordenados
para cada modulo:
  carregar aulas ordenadas
  carregar quizzes de modulo
  exportar cada quiz
retornar objeto final
```

## Regras de UX da Implementacao Original

## 1. Importacao aceita JSON vindo de IA

O texto da UI explicitamente orienta colar JSON gerado por IA.

Por isso, a implementacao inclui:

- remocao de fences Markdown;
- parse tolerante;
- tentativa de corrigir quebras de linha;
- limpeza de escape adicional em algumas telas.

## 2. Modos expostos ao admin

No builder de curso existente, a UI permite:

- adicionar novos modulos;
- substituir um modulo existente;
- limpar todo o curso antes.

Na pagina de cursos, a UI permite:

- importar um curso completo e criar um curso novo.

Na tela de avaliacoes, a UI permite:

- importar JSON para avaliacao final;
- importar JSON para criar novo quiz de modulo.

## Limitacoes e Gaps Conhecidos

## 1. Round-trip nao e total

Exportar e reimportar um curso nao preserva 100% da plataforma.

Perdem-se principalmente:

- regras de liberacao de modulo/aula;
- obrigatoriedade de modulo/aula;
- materiais anexos;
- botoes/acoes de rodape;
- PDF de modulo;
- `has_linear_progression`;
- flags de `is_required` e `is_active` em avaliacao.

## 2. `thumbnail_url` nao e atualizado em importacao inline

Ja descrito acima. E um gap de compatibilidade da implementacao atual.

## 3. Normalizacao de tipos em estudo de caso e agressiva

Dentro de `case_studies`, qualquer tipo nao explicito cai para `case_study_single_choice`.

## 4. Dependencia de assets externos

Interacoes gamificadas exportam `storage_path` e eventualmente `signed_url`, mas a reutilizacao desses assets em outra plataforma so funciona se:

- o mesmo bucket/storage existir;
- os arquivos ainda existirem;
- os paths forem validos no ambiente de destino.

Se a nova plataforma usar outro storage, sera necessario:

1. migrar os arquivos;
2. reescrever `storage_path`;
3. opcionalmente recalcular `signed_url`.

## 5. Dependencia de integridade no banco

O modulo assume integridade referencial correta e deletes em cascata entre tabelas relacionadas.
Sem isso, o modo destrutivo pode falhar ou deixar lixo relacional.

## Recomendacoes para Reimplementacao na Outra Plataforma

1. Preserve os mesmos contratos JSON para compatibilidade operacional com este LMS.
2. Mantenha o parser tolerante a bloco Markdown e a quebras de linha ruins.
3. Implemente importacao em transacao quando a stack permitir, porque o fluxo atual e multi-etapas e pode ficar parcial em caso de erro.
4. Decida explicitamente se deseja copiar os gaps atuais ou corrigi-los.
5. Se houver storage diferente, trate assets gamificados como uma camada separada da importacao estrutural.
6. Se precisar de round-trip completo, estenda o contrato para incluir metadados hoje ignorados.

## Contratos Minimos para Compatibilidade

Se a prioridade for compatibilidade e nao replica integral de interface, a outra plataforma precisa no minimo suportar:

- curso com `title`, `description`, `workload_minutes`, `status`, `quiz_type_settings`, `modules`;
- modulo com `title`, `description`, `lessons`, `assessments`;
- aula com `title`, `description`, `lesson_type`, `youtube_url`, `text_content`, `estimated_minutes`;
- avaliacao com `title`, `description`, `passing_score`, `max_attempts`, `estimated_minutes`, `questions`, `case_studies`;
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
          "youtube_url": "https://www.youtube.com/watch?v=abc123",
          "text_content": "<p>Conteudo introdutorio</p>",
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
              "question_text": "Qual e a conduta inicial?",
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
                  "question_text": "Qual seria a melhor decisao?",
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

O modulo atual e um importador/exportador estrutural de curso, nao um backup integral da plataforma.
Ele funciona muito bem para:

- clonar curso;
- portar curso entre ambientes;
- alimentar construcao por IA;
- reconstruir modulos e quizzes rapidamente.

Ele nao cobre, por padrao:

- todo o ecossistema de anexos;
- toda a configuracao de liberacao;
- todo o estado operacional do curso.

Se a outra plataforma usar a mesma modelagem base, replicar este contrato e suficiente para compatibilidade funcional de conteudo.
