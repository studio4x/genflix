begin;

create or replace function public.is_valid_cpf(_cpf text)
returns boolean
language plpgsql
immutable
as $$
declare
  digits text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  first_sum integer := 0;
  second_sum integer := 0;
  first_check integer;
  second_check integer;
  index_position integer;
begin
  if length(digits) <> 11 then
    return false;
  end if;

  if digits ~ '^(\d)\1{10}$' then
    return false;
  end if;

  for index_position in 1..9 loop
    first_sum := first_sum + cast(substring(digits from index_position for 1) as integer) * (11 - index_position);
  end loop;

  first_check := (first_sum * 10) % 11;
  if first_check = 10 then
    first_check := 0;
  end if;

  for index_position in 1..10 loop
    second_sum := second_sum + cast(substring(digits from index_position for 1) as integer) * (12 - index_position);
  end loop;

  second_check := (second_sum * 10) % 11;
  if second_check = 10 then
    second_check := 0;
  end if;

  return first_check = cast(substring(digits from 10 for 1) as integer)
    and second_check = cast(substring(digits from 11 for 1) as integer);
end;
$$;

create or replace function public.enforce_profile_cpf_validity()
returns trigger
language plpgsql
as $$
begin
  if new.cpf is not null and not public.is_valid_cpf(new.cpf) then
    raise exception using errcode = '23514', message = 'CPF inválido.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_validate_cpf on public.profiles;
create trigger profiles_validate_cpf
before insert or update of cpf on public.profiles
for each row
execute function public.enforce_profile_cpf_validity();

commit;
