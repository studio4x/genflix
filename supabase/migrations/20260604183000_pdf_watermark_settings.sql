create table if not exists public.pdf_watermark_settings (
  id integer primary key default 1 check (id = 1),
  logo_asset_id uuid references public.site_assets (id) on delete set null,
  opacity_percent integer not null default 8 check (opacity_percent between 0 and 100),
  size_percent integer not null default 100 check (size_percent between 25 and 300),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.pdf_watermark_settings (id, opacity_percent, size_percent)
values (1, 8, 100)
on conflict (id) do nothing;

drop trigger if exists set_pdf_watermark_settings_updated_at on public.pdf_watermark_settings;
create trigger set_pdf_watermark_settings_updated_at
before update on public.pdf_watermark_settings
for each row execute procedure public.set_updated_at();

alter table public.pdf_watermark_settings enable row level security;

drop policy if exists "pdf_watermark_settings_public_select" on public.pdf_watermark_settings;
create policy "pdf_watermark_settings_public_select"
on public.pdf_watermark_settings
for select
to anon, authenticated
using (true);

drop policy if exists "pdf_watermark_settings_admin_all" on public.pdf_watermark_settings;
create policy "pdf_watermark_settings_admin_all"
on public.pdf_watermark_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

grant select on public.pdf_watermark_settings to anon, authenticated;
grant insert, update, delete on public.pdf_watermark_settings to authenticated;
grant all on public.pdf_watermark_settings to service_role;
