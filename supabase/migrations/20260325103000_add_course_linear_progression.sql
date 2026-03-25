-- Adiciona coluna de progressão linear na tabela de cursos
ALTER TABLE courses ADD COLUMN has_linear_progression BOOLEAN DEFAULT TRUE;

-- Comentário para documentar a coluna
COMMENT ON COLUMN courses.has_linear_progression IS 'Se TRUE, o aluno deve concluir aulas/módulos em ordem. Se FALSE, todo o conteúdo liberado fica acessível imediatamente.';

-- Atualiza a função is_module_unlocked para considerar a nova flag do curso
CREATE OR REPLACE FUNCTION public.is_module_unlocked(_user_id uuid, _module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_module AS (
    SELECT cm.id, cm.course_id, cm.position, c.has_linear_progression
    FROM public.course_modules cm
    JOIN public.courses c ON c.id = cm.course_id
    WHERE cm.id = _module_id
    LIMIT 1
  ),
  previous_module AS (
    SELECT cm_prev.id
    FROM public.course_modules cm_prev
    JOIN current_module cm ON cm.course_id = cm_prev.course_id
    WHERE cm_prev.position < cm.position
    ORDER BY cm_prev.position DESC
    LIMIT 1
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM current_module) THEN false
    -- Se o curso não tiver progressão linear, desbloqueia tudo
    WHEN (SELECT has_linear_progression FROM current_module) = false THEN true
    -- Se for o primeiro módulo, sempre desbloqueado
    WHEN NOT EXISTS (SELECT 1 FROM previous_module) THEN true
    -- Caso contrário, verifica se o módulo anterior foi concluído
    ELSE public.is_module_completed(
      _user_id,
      (SELECT id FROM previous_module)
    )
  END;
$$;
