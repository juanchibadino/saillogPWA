-- GPS uploads now keep only processed artifacts for new records.

alter table public.session_vakaros_uploads
  alter column raw_storage_path drop not null;
