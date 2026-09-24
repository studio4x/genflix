begin;

alter table public.button_templates
  add column if not exists custom_icon_color text;

alter table public.button_templates
  drop constraint if exists button_templates_custom_colors_check;

update public.button_templates
set custom_icon_color = coalesce(custom_icon_color, custom_text_color, '#FFFFFF')
where theme = 'custom';

alter table public.button_templates
  add constraint button_templates_custom_colors_check
  check (
    (custom_background_color is null or custom_background_color ~ '^#[0-9A-Fa-f]{6}$')
    and (custom_text_color is null or custom_text_color ~ '^#[0-9A-Fa-f]{6}$')
    and (custom_icon_color is null or custom_icon_color ~ '^#[0-9A-Fa-f]{6}$')
    and (
      theme <> 'custom'
      or (
        custom_background_color is not null
        and custom_text_color is not null
        and custom_icon_color is not null
      )
    )
  );

commit;
