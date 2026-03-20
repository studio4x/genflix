# Sprint 4 - Progresso e Bloqueio Sequencial

## Escopo obrigatorio implementado

1. Progresso por aula com marcacao explicita pelo aluno.
2. Progresso por modulo calculado no banco.
3. Bloqueio sequencial de modulos.
4. Regra de conclusao de modulo:
   - todas as aulas obrigatorias concluidas;
   - e, quando houver avaliacao obrigatoria do modulo, aprovacao obrigatoria.
5. Estados visuais no aluno:
   - `blocked`
   - `in_progress`
   - `completed`

## Modelagem adicionada

1. `lesson_progress` para registrar conclusao por aluno e aula.
2. `module_assessments` e `module_assessment_attempts` como base para regra de aprovacao obrigatoria (sem fluxo completo de avaliacao da Sprint 5).

## Funcoes adicionadas

1. `is_required_module_assessment_approved`
2. `is_module_completed`
3. `is_module_unlocked`
4. `get_student_course_modules_progress`
5. `get_student_unlocked_lessons_progress`

## RLS

1. RLS em `lesson_progress`, `module_assessments`, `module_assessment_attempts`.
2. Ajuste de policy em `lessons` para liberar somente aulas de modulos destravados.
3. Policy de `lesson_progress` com controle de ownership e contexto de liberacao/ordem.

## Fora do escopo desta sprint

1. Fluxo completo de avaliacoes (Sprint 5).
2. Conclusao final de curso.
3. Relatorios.

