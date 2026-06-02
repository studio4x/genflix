insert into public.blog_categories (name, slug, display_order, is_active)
values
  ('Saúde', 'saude', 1, true),
  ('Direito', 'direito', 2, true),
  ('Exatas', 'exatas', 3, true),
  ('Gestão', 'gest?o', 4, true),
  ('Humanas', 'humanas', 5, true),
  ('Psicologia', 'psicologia', 6, true),
  ('Interesse Geral', 'interesse-geral', 7, true)
on conflict (slug) do update
set
  name = excluded.name,
  display_order = excluded.display_order,
  is_active = excluded.is_active;
