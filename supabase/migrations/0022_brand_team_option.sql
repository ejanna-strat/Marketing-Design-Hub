-- Owner, Oct 27: the team is now the Marketing Brand Team.
-- Renames the dynamic social media option and any past answers that picked it.
update public.form_questions
set options = replace(options::text, '(for Design Team)', '(for BRAND team)')::jsonb
where options::text like '%(for Design Team)%';

update public.request_answers
set value = replace(value::text, '(for Design Team)', '(for BRAND team)')::jsonb
where value::text like '%(for Design Team)%';
