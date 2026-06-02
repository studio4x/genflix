begin;

create or replace function public.notify_admins_new_blog_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record record;
  body_preview text;
begin
  if new.moderation_status <> 'pending' then
    return new;
  end if;

  body_preview := left(new.first_name || ' ' || new.last_name || ' comentou em /blog/' || new.post_slug, 240);

  for admin_record in
    select p.id
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where r.code = 'admin'
  loop
    perform public.create_user_notification(
      admin_record.id,
      'N?ovo comentário aguardando aprovação',
      body_preview,
      'blog',
      'normal',
      '/admin/blogtab=comments',
      array['in-app', 'email'],
      jsonb_build_object('blog_comment_id', new.id, 'post_slug', new.post_slug)
    );
  end loop;

  return new;
end;
$$;

commit;
