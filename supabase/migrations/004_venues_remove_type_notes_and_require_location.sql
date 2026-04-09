-- 004_venues_remove_type_notes_and_require_location.sql
-- Venues refactor: remove unused fields and require location data.

alter table public.venues
  drop column if exists venue_type,
  drop column if exists notes;

alter table public.venues
  alter column city set not null,
  alter column country set not null;
