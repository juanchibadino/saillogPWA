-- Sessions are identified by camp, type, and date; title is intentionally removed.
alter table public.sessions
  drop column if exists title;
