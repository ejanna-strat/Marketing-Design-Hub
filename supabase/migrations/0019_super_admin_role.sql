-- Owner, Oct 22: a Super Admin tag above Admin. Added on its own because a
-- new enum value can't be used in the same transaction that adds it (0020).
alter type public.app_role add value if not exists 'super_admin' before 'admin';
