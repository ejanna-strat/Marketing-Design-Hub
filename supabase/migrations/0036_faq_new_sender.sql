-- Owner, Nov 13: the app is now the Marketing Support Hub and its emails come
-- from marketingsupporthub@ejoo.site. Updates the FAQ answer that names the
-- sender address (only where it still has the old one, so edits stay).

update public.faqs
set answer = replace(answer, 'marketingcreativehub@ejoo.site', 'marketingsupporthub@ejoo.site'),
    updated_at = now()
where answer like '%marketingcreativehub@ejoo.site%';
