-- Owner, Nov 26: three review rounds. The existing "for_review" value is now
-- shown as "For review – 1st draft"; V2 and V3 are new. V3 is the last round.
-- (New enum values must be committed before they're used, so the rules that
-- use them are in 0049.)

alter type public.request_status add value if not exists 'for_review_v2' after 'for_review';
alter type public.request_status add value if not exists 'for_review_v3' after 'for_review_v2';
