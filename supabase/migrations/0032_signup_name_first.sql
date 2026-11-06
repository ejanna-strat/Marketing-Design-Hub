-- Owner, Nov 6 (option B, with 0031): sign-up uses the name the person
-- typed; the Members name is only a fallback (it was the other way round).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  roster_name text;
begin
  select full_name into roster_name from public.team_members where email = lower(new.email);

  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      roster_name,
      initcap(replace(split_part(new.email, '@', 1), '.', ' '))
    ),
    lower(new.email)
  );

  perform public.sync_user_roles(new.id);
  return new;
end;
$$;
