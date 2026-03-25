-- Adiciona coluna de progressão linear na tabela de cursos
ALTER TABLE courses ADD COLUMN IF NOT EXISTS has_linear_progression BOOLEAN DEFAULT TRUE;

-- Comentário para documentar a coluna
COMMENT ON COLUMN courses.has_linear_progression IS 'Se TRUE, o aluno deve concluir aulas/módulos em ordem. Se FALSE, todo o conteúdo liberado fica acessível imediatamente.';

-- Atualiza a função is_module_unlocked para considerar a nova flag do curso e permitir bypass de Admin
CREATE OR REPLACE FUNCTION public.is_module_unlocked(_user_id uuid, _module_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_linear BOOLEAN;
    v_is_admin BOOLEAN;
    v_prev_module_id UUID;
BEGIN
    -- Verifica se o curso tem progressão linear
    SELECT c.has_linear_progression INTO v_has_linear
    FROM public.course_modules cm
    JOIN public.courses c ON c.id = cm.course_id
    WHERE cm.id = _module_id;

    IF v_has_linear IS NULL THEN RETURN FALSE; END IF;

    -- Se o curso não tiver progressão linear, desbloqueia tudo
    IF v_has_linear = FALSE THEN RETURN TRUE; END IF;

    -- Verifica se o usuário é Admin (Bypass)
    v_is_admin := public.has_role(_user_id, 'admin');
    IF v_is_admin THEN RETURN TRUE; END IF;

    -- Localiza o módulo anterior
    SELECT cm_prev.id INTO v_prev_module_id
    FROM public.course_modules cm_prev
    JOIN public.course_modules cm_curr ON cm_curr.course_id = cm_prev.course_id
    WHERE cm_curr.id = _module_id AND cm_prev.position < cm_curr.position
    ORDER BY cm_prev.position DESC
    LIMIT 1;

    -- Se for o primeiro módulo, sempre desbloqueado
    IF v_prev_module_id IS NULL THEN RETURN TRUE; END IF;

    -- Caso contrário, verifica se o módulo anterior foi concluído
    RETURN public.is_module_completed(_user_id, v_prev_module_id);
END;
$$;

-- Atualiza o RPC de módulos para permitir acesso de Admin
CREATE OR REPLACE FUNCTION public.get_student_course_modules_progress(_course_id uuid)
RETURNS TABLE (
  module_id uuid,
  module_position integer,
  title text,
  description text,
  is_required boolean,
  state text,
  is_unlocked boolean,
  is_completed boolean,
  required_lessons_total integer,
  required_lessons_completed integer,
  has_required_assessment boolean,
  required_assessment_approved boolean,
  progress_percent integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ctx_user AS (
    SELECT auth.uid() AS user_id
  ),
  allowed AS (
    SELECT 1
    FROM ctx_user cu
    WHERE cu.user_id IS NOT NULL
      AND (
        (public.has_role(cu.user_id, 'student') AND public.is_course_released(cu.user_id, _course_id))
        OR public.has_role(cu.user_id, 'admin')
      )
  ),
  module_base AS (
    SELECT
      cm.id AS module_id,
      cm.position,
      cm.title,
      cm.description,
      cm.is_required,
      public.is_module_unlocked(cu.user_id, cm.id) AS is_unlocked,
      public.is_module_completed(cu.user_id, cm.id) AS is_completed,
      (
        SELECT count(*)::int
        FROM public.lessons l
        WHERE l.module_id = cm.id
          AND l.is_required = true
      ) AS required_lessons_total,
      (
        SELECT count(*)::int
        FROM public.lessons l
        LEFT JOIN public.lesson_progress lp
          ON lp.lesson_id = l.id
          AND lp.user_id = cu.user_id
          AND lp.is_completed = true
        WHERE l.module_id = cm.id
          AND l.is_required = true
      ) AS required_lessons_completed,
      exists (
        SELECT 1
        FROM public.module_assessments ma
        WHERE ma.module_id = cm.id
          AND ma.is_required = true
      ) AS has_required_assessment,
      public.is_required_module_assessment_approved(cu.user_id, cm.id) AS required_assessment_approved
    FROM public.course_modules cm
    CROSS JOIN ctx_user cu 
    WHERE cm.course_id = _course_id
  )
  SELECT
    mb.module_id,
    mb.position AS module_position,
    mb.title,
    mb.description,
    mb.is_required,
    CASE
      WHEN mb.is_unlocked = false THEN 'blocked'
      WHEN mb.is_completed = true THEN 'completed'
      ELSE 'in_progress'
    END AS state,
    mb.is_unlocked,
    mb.is_completed,
    mb.required_lessons_total,
    mb.required_lessons_completed,
    mb.has_required_assessment,
    mb.required_assessment_approved,
    CASE
      WHEN (mb.required_lessons_total + CASE WHEN mb.has_required_assessment THEN 1 ELSE 0 END) = 0
        THEN 100
      ELSE floor(
        (
          (mb.required_lessons_completed + CASE WHEN (mb.has_required_assessment AND mb.required_assessment_approved) THEN 1 ELSE 0 END)::numeric
          * 100
        )
        / (mb.required_lessons_total + CASE WHEN mb.has_required_assessment THEN 1 ELSE 0 END)
      )::int
    END AS progress_percent
  FROM module_base mb
  WHERE EXISTS (SELECT 1 FROM allowed)
  ORDER BY mb.module_position ASC;
$$;

-- Atualiza o RPC de aulas para permitir acesso de Admin
CREATE OR REPLACE FUNCTION public.get_student_unlocked_lessons_progress(_course_id uuid)
RETURNS TABLE (
  lesson_id uuid,
  module_id uuid,
  module_position integer,
  lesson_position integer,
  title text,
  description text,
  is_required boolean,
  lesson_type text,
  youtube_url text,
  text_content text,
  estimated_minutes integer,
  is_completed boolean,
  completed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ctx_user AS (
    SELECT auth.uid() AS user_id
  ),
  allowed AS (
    SELECT 1
    FROM ctx_user cu
    WHERE cu.user_id IS NOT NULL
      AND (
        (public.has_role(cu.user_id, 'student') AND public.is_course_released(cu.user_id, _course_id))
        OR public.has_role(cu.user_id, 'admin')
      )
  )
  SELECT
    l.id AS lesson_id,
    cm.id AS module_id,
    cm.position AS module_position,
    l.position AS lesson_position,
    l.title,
    l.description,
    l.is_required,
    l.lesson_type::text,
    l.youtube_url,
    l.text_content,
    l.estimated_minutes,
    coalesce(lp.is_completed, false) AS is_completed,
    lp.completed_at
  FROM public.course_modules cm
  JOIN public.lessons l ON l.module_id = cm.id
  CROSS JOIN ctx_user cu
  LEFT JOIN public.lesson_progress lp
    ON lp.lesson_id = l.id
    AND lp.user_id = cu.user_id
  WHERE cm.course_id = _course_id
    AND public.is_module_unlocked(cu.user_id, cm.id)
    AND EXISTS (SELECT 1 FROM allowed)
  ORDER BY cm.position ASC, l.position ASC;
$$;
