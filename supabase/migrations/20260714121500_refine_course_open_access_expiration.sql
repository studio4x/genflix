create or replace function public.is_course_released(_user_id uuid, _course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_releases cr
    join public.courses c on c.id = cr.course_id
    left join public.access_group_members agm
      on agm.group_id = cr.group_id
      and agm.user_id = _user_id
    where cr.course_id = _course_id
      and cr.is_active = true
      and coalesce(cr.release_status, 'active') = 'active'
      and (cr.starts_at is null or cr.starts_at <= timezone('utc', now()))
      and (cr.ends_at is null or cr.ends_at >= timezone('utc', now()))
      and (
        c.access_expiration_mode = 'lifetime'
        or (c.access_expiration_mode = 'specific_date' and c.access_expiration_date >= (timezone('utc', now()))::date)
        or (
          c.access_expiration_mode = 'days_after_course_open'
          and c.access_expiration_days is not null
          and coalesce(c.launch_date::timestamptz, c.created_at) <= timezone('utc', now())
          and coalesce(c.launch_date::timestamptz, c.created_at) + make_interval(days => c.access_expiration_days) >= timezone('utc', now())
        )
        or (
          c.access_expiration_mode = 'days_after_enrollment'
          and c.access_expiration_days is not null
          and coalesce(cr.starts_at, cr.created_at) + make_interval(days => c.access_expiration_days) >= timezone('utc', now())
        )
      )
      and (
        (cr.release_type = 'user' and cr.user_id = _user_id)
        or (cr.release_type = 'group' and agm.user_id is not null)
      )
  );
$$;
