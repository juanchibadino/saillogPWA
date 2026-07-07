create index if not exists assessment_runs_team_created_idx
  on public.assessment_runs (team_id, created_at desc);

create index if not exists assessment_runs_team_template_created_idx
  on public.assessment_runs (team_id, assessment_template_id, created_at desc)
  where assessment_template_id is not null;

create index if not exists assessment_templates_team_updated_idx
  on public.assessment_templates (team_id, updated_at desc);
