begin;

alter table public.button_templates
  add column if not exists custom_background_color text,
  add column if not exists custom_text_color text;

alter table public.button_templates
  drop constraint if exists button_templates_theme_check;

alter table public.button_templates
  add constraint button_templates_theme_check
  check (theme in ('blue', 'emerald', 'amber', 'rose', 'slate', 'violet', 'custom'));

alter table public.button_templates
  add constraint button_templates_custom_colors_check
  check (
    (custom_background_color is null or custom_background_color ~ '^#[0-9A-Fa-f]{6}$')
    and (custom_text_color is null or custom_text_color ~ '^#[0-9A-Fa-f]{6}$')
    and (
      theme <> 'custom'
      or (custom_background_color is not null and custom_text_color is not null)
    )
  );

commit;
