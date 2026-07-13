-- Keep camp date ranges valid at the database boundary.

alter table public.camps
  drop constraint if exists camps_end_date_on_or_after_start_date;

alter table public.camps
  add constraint camps_end_date_on_or_after_start_date
  check (end_date >= start_date)
  not valid;
