-- Owner, Oct 27: the team is now the Marketing Brand Team.
-- Renames the dynamic social media option and any past answers that picked it.
-- (Staging briefly had "(for BRAND team)"; both old spellings are covered.)
update public.form_questions
set options = replace(replace(options::text, '(for Design Team)', '(for Brand team)'), '(for BRAND team)', '(for Brand team)')::jsonb
where options::text like '%(for Design Team)%' or options::text like '%(for BRAND team)%';

update public.request_answers
set value = replace(replace(value::text, '(for Design Team)', '(for Brand team)'), '(for BRAND team)', '(for Brand team)')::jsonb
where value::text like '%(for Design Team)%' or value::text like '%(for BRAND team)%';
