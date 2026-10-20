-- Owner, Oct 21: the Link to Output must be a web link (http:// or https://).
-- Runs after requests_before_update (triggers fire in name order), so the
-- link is already trimmed. Only checked when the link changes, so older
-- requests keep what they have.

create or replace function public.requests_check_link()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.link_to_output is distinct from old.link_to_output
     and new.link_to_output is not null
     and new.link_to_output !~* '^https?://[^\s/]+\.[^\s]+$' then
    raise exception 'Please enter a valid link that starts with https:// (e.g. https://docs.google.com/…).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger requests_check_link
  before update on public.requests
  for each row execute function public.requests_check_link();
