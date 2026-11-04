-- Owner, Nov 4: Business Unit list. QA → "Quality Assurance (QA)",
-- ITSM → "ITX" (past requests show the new names), three new units for
-- requesters outside the existing ones, and the list in A–Z order.

update public.teams set name = 'Quality Assurance (QA)' where name = 'QA';
update public.teams set name = 'ITX' where name = 'ITSM';

insert into public.teams (name, is_marketing) values
  ('Management', false),
  ('Technology Governance Team (TGT)', false),
  ('Professional Services Management Office (PSMO)', false)
on conflict (name) do nothing;

update public.teams t set sort_order = o.n
from (select id, row_number() over (order by lower(name)) as n from public.teams) o
where o.id = t.id;
