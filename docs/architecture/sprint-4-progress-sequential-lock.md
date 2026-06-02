# Sprint 4 - Progresso e Bloqueio Sequencial

## Escopo obrigatrio implementado

1. Progresso por aula com marcacao explicita pelo aluno.
2. Progresso por m?dulo calculado no banco.
3. Bloqueio sequencial de m?dulos.
4. Regra de conclus?o de m?dulo:
   - todas as aulas obrigatrias concluidas;
   - e, quando houver avalia??o obrigatria do m?dulo, aprova??o obrigatria.
5. Estados visuais no aluno:
   - `blocked`
   - `in_progress`
   - `completed`

## Modelagem adicionada

1. `lesson_progress` para registrar conclus?o por aluno e aula.
2. `module_assessments` e `module_assessment_attempts` como base para regra de aprova??o obrigatria (sem fluxo completo de avalia??o da Sprint 5).

## Funcoes adicionadas

1. `is_required_module_assessment_approved`
2. `is_module_completed`
3. `is_module_unlocked`
4. `get_student_course_modules_progress`
5. `get_student_unlocked_lessons_progress`

## RLS

1. RLS em `lesson_progress`, `module_assessments`, `module_assessment_attempts`.
2. Ajuste de policy em `lessons` para liberar somente aulas de m?dulos destravados.
3. Policy de `lesson_progress` com controle de ownership e contexto de libera??o/ordem.

## Fora do escopo dest? sprint

1. Fluxo completo de avalia??es (Sprint 5).
2. Conclusao final de curso.
3. Relatorios.

