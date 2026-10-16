-- New role: Lead Designer (reviews and assigns requests, manages members,
-- and is in the designer list). Added on its own because Postgres can't use a
-- new enum value in the same transaction that adds it. See 0005.

alter type public.app_role add value if not exists 'lead_designer' before 'designer';
