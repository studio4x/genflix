alter table public.public_form_submissions
  drop constraint if exists public_form_submissions_form_type_check;

alter table public.public_form_submissions
  drop constraint if exists public_form_submissions_check;

alter table public.public_form_submissions
  add constraint public_form_submissions_form_type_check
  check (form_type in ('contact', 'teach', 'newsletter', 'lead', 'support', 'refer'));
