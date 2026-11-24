-- Owner, Nov 24: Settings → Usage shows how much of the Supabase plan the app
-- uses (database size and uploaded files), for everyone on the Marketing team.
-- Only totals and table sizes come back, never any rows.

create or replace function public.app_usage()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only the Marketing team can see usage.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'file_bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o),
    'file_count', (select count(*) from storage.objects),
    'tables', (
      select coalesce(jsonb_agg(t order by t.bytes desc), '[]'::jsonb)
      from (
        select c.relname as name, pg_total_relation_size(c.oid) as bytes
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc
        limit 6
      ) t
    )
  );
end;
$$;
revoke execute on function public.app_usage() from public, anon;
grant execute on function public.app_usage() to authenticated;
