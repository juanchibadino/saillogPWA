-- Add dedicated goals text for session-level planning.
alter table public.sessions
  add column if not exists goals text;
