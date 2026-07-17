-- Classify Conditions as a fixed Weather setup metric.
-- Keep the existing position values to avoid unique-position conflicts.

update public.team_type_setup_items
set
  label = 'Conditions',
  metric_group = 'weather'::public.setup_metric_group,
  is_fixed = true,
  updated_at = now()
where key = 'conditions'
  and (
    label is distinct from 'Conditions'
    or metric_group is distinct from 'weather'::public.setup_metric_group
    or is_fixed is distinct from true
  );

update public.team_setup_items
set
  label = 'Conditions',
  metric_group = 'weather'::public.setup_metric_group,
  is_fixed = true,
  updated_at = now()
where key = 'conditions'
  and (
    label is distinct from 'Conditions'
    or metric_group is distinct from 'weather'::public.setup_metric_group
    or is_fixed is distinct from true
  );
