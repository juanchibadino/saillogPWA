-- 064_session_setup_free_notes_atomic.sql
-- Include session setup free notes in the transaction-safe setup save RPC.

drop function if exists public.save_session_setup_atomic(uuid, uuid, jsonb, uuid[], uuid[]);

create or replace function public.save_session_setup_atomic(
  p_session_id uuid,
  p_team_id uuid,
  p_values jsonb,
  p_delete_item_ids uuid[],
  p_ordered_item_ids uuid[],
  p_update_free_notes boolean default false,
  p_free_notes text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  session_team_id uuid;
  value_entry jsonb;
  selected_option_entry jsonb;
  value_item_id uuid;
  value_text text;
  value_id uuid;
  selected_option_id uuid;
  selected_allocation_percent integer;
  current_ordered_item_ids uuid[];
  distinct_ordered_item_count integer;
  max_position integer;
  max_weather_position integer;
  temporary_base_position integer;
  final_base_position integer;
  item_index integer;
begin
  if p_values is null or jsonb_typeof(p_values) <> 'array' then
    raise exception 'Setup values payload must be an array';
  end if;

  session_team_id := public.team_id_for_session(p_session_id);

  if session_team_id is null or session_team_id <> p_team_id then
    raise exception 'Invalid session scope';
  end if;

  if not public.can_manage_team_sessions(session_team_id) then
    raise exception 'Insufficient permissions';
  end if;

  if p_update_free_notes then
    insert into public.session_setups (
      session_id,
      entered_by_profile_id,
      free_notes
    )
    values (
      p_session_id,
      auth.uid(),
      nullif(btrim(p_free_notes), '')
    )
    on conflict (session_id)
    do update set
      entered_by_profile_id = excluded.entered_by_profile_id,
      free_notes = excluded.free_notes;
  end if;

  for value_entry in
    select entry
    from jsonb_array_elements(p_values) as payload(entry)
  loop
    if value_entry->>'team_setup_item_id' is null then
      raise exception 'Setup value is missing team_setup_item_id';
    end if;

    value_item_id := (value_entry->>'team_setup_item_id')::uuid;

    if not exists (
      select 1
      from public.team_setup_items tsi
      where tsi.id = value_item_id
        and tsi.team_id = p_team_id
        and tsi.is_active
    ) then
      raise exception 'Invalid setup item %', value_item_id;
    end if;

    value_text := case
      when jsonb_typeof(value_entry->'text_value') = 'string'
        then nullif(btrim(value_entry->>'text_value'), '')
      else null
    end;

    insert into public.session_setup_item_values (
      session_id,
      team_setup_item_id,
      text_value
    )
    values (
      p_session_id,
      value_item_id,
      value_text
    )
    on conflict (session_id, team_setup_item_id)
    do update set text_value = excluded.text_value
    returning id into value_id;

    delete from public.session_setup_item_selected_options ssiso
    where ssiso.session_setup_item_value_id = value_id;

    if value_entry ? 'selected_options' then
      if jsonb_typeof(value_entry->'selected_options') <> 'array' then
        raise exception 'selected_options must be an array';
      end if;

      for selected_option_entry in
        select entry
        from jsonb_array_elements(value_entry->'selected_options') as payload(entry)
      loop
        if selected_option_entry->>'team_setup_item_option_id' is null then
          raise exception 'Selected option is missing team_setup_item_option_id';
        end if;

        selected_option_id := (selected_option_entry->>'team_setup_item_option_id')::uuid;
        selected_allocation_percent := case
          when jsonb_typeof(selected_option_entry->'allocation_percent') = 'number'
            then (selected_option_entry->>'allocation_percent')::integer
          else null
        end;

        if not exists (
          select 1
          from public.team_setup_item_options tsio
          where tsio.id = selected_option_id
            and tsio.team_setup_item_id = value_item_id
            and tsio.is_active
        ) then
          raise exception 'Invalid setup option % for item %', selected_option_id, value_item_id;
        end if;

        insert into public.session_setup_item_selected_options (
          session_setup_item_value_id,
          team_setup_item_option_id,
          allocation_percent
        )
        values (
          value_id,
          selected_option_id,
          selected_allocation_percent
        );
      end loop;
    end if;
  end loop;

  if coalesce(cardinality(p_delete_item_ids), 0) > 0 then
    delete from public.session_setup_item_values ssiv
    using public.team_setup_items tsi
    where ssiv.team_setup_item_id = tsi.id
      and ssiv.session_id = p_session_id
      and tsi.team_id = p_team_id
      and ssiv.team_setup_item_id = any(p_delete_item_ids);
  end if;

  if p_ordered_item_ids is not null then
    select coalesce(array_agg(tsi.id order by tsi.position), array[]::uuid[])
    into current_ordered_item_ids
    from public.team_setup_items tsi
    where tsi.team_id = p_team_id
      and tsi.is_active
      and tsi.metric_group = 'boat'
      and not tsi.is_fixed;

    select count(distinct ordered_item_id)
    into distinct_ordered_item_count
    from unnest(p_ordered_item_ids) as ordered(ordered_item_id);

    if cardinality(current_ordered_item_ids) <> cardinality(p_ordered_item_ids)
       or distinct_ordered_item_count <> cardinality(p_ordered_item_ids)
       or exists (
        select 1
        from unnest(p_ordered_item_ids) as ordered(ordered_item_id)
        left join public.team_setup_items tsi
          on tsi.id = ordered.ordered_item_id
         and tsi.team_id = p_team_id
         and tsi.is_active
         and tsi.metric_group = 'boat'
         and not tsi.is_fixed
        where tsi.id is null
      ) then
      raise exception 'Invalid boat setup order';
    end if;

    if current_ordered_item_ids <> p_ordered_item_ids then
      select
        coalesce(max(tsi.position), 0),
        coalesce(max(tsi.position) filter (
          where tsi.metric_group = 'weather' and tsi.is_active
        ), 0)
      into max_position, max_weather_position
      from public.team_setup_items tsi
      where tsi.team_id = p_team_id;

      temporary_base_position := max_position + 1000;
      final_base_position := max_weather_position + 1;

      for item_index in 1..cardinality(p_ordered_item_ids) loop
        update public.team_setup_items
        set position = temporary_base_position + item_index - 1
        where id = p_ordered_item_ids[item_index]
          and team_id = p_team_id;
      end loop;

      for item_index in 1..cardinality(p_ordered_item_ids) loop
        update public.team_setup_items
        set position = final_base_position + item_index - 1
        where id = p_ordered_item_ids[item_index]
          and team_id = p_team_id;
      end loop;
    end if;
  end if;
end;
$$;
