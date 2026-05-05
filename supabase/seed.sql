-- Sailog seed
-- Dummy users and team memberships with temporary password `123456`.
--
-- Seed users:
-- - ian.macdiarmid@sailog.test
-- - klaus.lange@sailog.test
-- - nevin.snow@sailog.test
-- - tadeo.funes@sailog.test
-- - maximo.videla@sailog.test
-- - john.doe@sailog.test
-- - charlie.brown@sailog.test

with seed_users (id, email, password, first_name, last_name, sailing_role_label) as (
  values
    ('b9881ec6-1c3a-4f4f-a0ce-ef0a8e425af4'::uuid, 'ian.macdiarmid@sailog.test', '123456', 'Ian', 'MacDiarmid', 'Crew (Crew)'),
    ('d96f3552-77a1-4c77-a11f-bba8f11abf84'::uuid, 'klaus.lange@sailog.test', '123456', 'Klaus', 'Lange', 'Team Coach'),
    ('5f5a53d3-efc9-45d8-9198-8d16ae5ca03d'::uuid, 'nevin.snow@sailog.test', '123456', 'Nevin', 'Snow', 'Crew (Helm)'),
    ('9baa03f0-4013-45f0-a867-6be745f70517'::uuid, 'tadeo.funes@sailog.test', '123456', 'Tadeo', 'Funes', 'Crew (Helm)'),
    ('95ca63fe-7d6d-4246-822c-77ff1d8be2ef'::uuid, 'maximo.videla@sailog.test', '123456', 'Maximo', 'Videla', 'Crew (Crew)'),
    ('3a02acf2-2d67-4d91-8fdf-f3286f4f87bf'::uuid, 'john.doe@sailog.test', '123456', 'John', 'Doe', 'Crew (Helm)'),
    ('40ad8a28-4f08-4fd4-9039-380ec45813bf'::uuid, 'charlie.brown@sailog.test', '123456', 'Charlie', 'Brown', 'Crew (Crew)')
),
resolved_seed_users as (
  select
    coalesce(u.id, s.id) as id,
    lower(s.email) as email,
    s.password,
    s.first_name,
    s.last_name,
    s.sailing_role_label
  from seed_users s
  left join auth.users u on lower(u.email) = lower(s.email)
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  s.id,
  'authenticated',
  'authenticated',
  s.email,
  crypt(s.password, gen_salt('bf')),
  timezone('utc', now()),
  '',
  '',
  '',
  '',
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  jsonb_build_object(
    'first_name', s.first_name,
    'last_name', s.last_name,
    'sailing_role_label', s.sailing_role_label
  ),
  timezone('utc', now()),
  timezone('utc', now())
from resolved_seed_users s
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
  updated_at = timezone('utc', now());

with seed_emails(email) as (
  values
    ('ian.macdiarmid@sailog.test'),
    ('klaus.lange@sailog.test'),
    ('nevin.snow@sailog.test'),
    ('tadeo.funes@sailog.test'),
    ('maximo.videla@sailog.test'),
    ('john.doe@sailog.test'),
    ('charlie.brown@sailog.test')
)
delete from auth.identities i
using seed_emails s
where i.provider = 'email'
  and i.provider_id = lower(s.email);

with seed_users (id, email, password, first_name, last_name, sailing_role_label) as (
  values
    ('b9881ec6-1c3a-4f4f-a0ce-ef0a8e425af4'::uuid, 'ian.macdiarmid@sailog.test', '123456', 'Ian', 'MacDiarmid', 'Crew (Crew)'),
    ('d96f3552-77a1-4c77-a11f-bba8f11abf84'::uuid, 'klaus.lange@sailog.test', '123456', 'Klaus', 'Lange', 'Team Coach'),
    ('5f5a53d3-efc9-45d8-9198-8d16ae5ca03d'::uuid, 'nevin.snow@sailog.test', '123456', 'Nevin', 'Snow', 'Crew (Helm)'),
    ('9baa03f0-4013-45f0-a867-6be745f70517'::uuid, 'tadeo.funes@sailog.test', '123456', 'Tadeo', 'Funes', 'Crew (Helm)'),
    ('95ca63fe-7d6d-4246-822c-77ff1d8be2ef'::uuid, 'maximo.videla@sailog.test', '123456', 'Maximo', 'Videla', 'Crew (Crew)'),
    ('3a02acf2-2d67-4d91-8fdf-f3286f4f87bf'::uuid, 'john.doe@sailog.test', '123456', 'John', 'Doe', 'Crew (Helm)'),
    ('40ad8a28-4f08-4fd4-9039-380ec45813bf'::uuid, 'charlie.brown@sailog.test', '123456', 'Charlie', 'Brown', 'Crew (Crew)')
),
resolved_seed_users as (
  select
    coalesce(u.id, s.id) as id,
    lower(s.email) as email
  from seed_users s
  left join auth.users u on lower(u.email) = lower(s.email)
)
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  s.id,
  jsonb_build_object('sub', s.id::text, 'email', s.email),
  'email',
  s.email,
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now())
from resolved_seed_users s;

with seed_users (id, email, password, first_name, last_name, sailing_role_label) as (
  values
    ('b9881ec6-1c3a-4f4f-a0ce-ef0a8e425af4'::uuid, 'ian.macdiarmid@sailog.test', '123456', 'Ian', 'MacDiarmid', 'Crew (Crew)'),
    ('d96f3552-77a1-4c77-a11f-bba8f11abf84'::uuid, 'klaus.lange@sailog.test', '123456', 'Klaus', 'Lange', 'Team Coach'),
    ('5f5a53d3-efc9-45d8-9198-8d16ae5ca03d'::uuid, 'nevin.snow@sailog.test', '123456', 'Nevin', 'Snow', 'Crew (Helm)'),
    ('9baa03f0-4013-45f0-a867-6be745f70517'::uuid, 'tadeo.funes@sailog.test', '123456', 'Tadeo', 'Funes', 'Crew (Helm)'),
    ('95ca63fe-7d6d-4246-822c-77ff1d8be2ef'::uuid, 'maximo.videla@sailog.test', '123456', 'Maximo', 'Videla', 'Crew (Crew)'),
    ('3a02acf2-2d67-4d91-8fdf-f3286f4f87bf'::uuid, 'john.doe@sailog.test', '123456', 'John', 'Doe', 'Crew (Helm)'),
    ('40ad8a28-4f08-4fd4-9039-380ec45813bf'::uuid, 'charlie.brown@sailog.test', '123456', 'Charlie', 'Brown', 'Crew (Crew)')
),
resolved_seed_users as (
  select
    coalesce(u.id, s.id) as id,
    lower(s.email) as email,
    s.first_name,
    s.last_name
  from seed_users s
  left join auth.users u on lower(u.email) = lower(s.email)
)
insert into public.profiles (id, email, first_name, last_name, is_active)
select
  s.id,
  s.email,
  s.first_name,
  s.last_name,
  true
from resolved_seed_users s
on conflict (id) do update
set
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  is_active = true,
  updated_at = timezone('utc', now());

do $$
declare
  america_org_id uuid;
  enard_org_id uuid;
  usa31_team_id uuid;
  arg49er_team_id uuid;

  test_org_id uuid;
  test_team_id uuid;
  test_venue_id uuid;
  test_team_venue_id uuid;
  arenal_camp_id uuid;
  princesa_camp_id uuid;

  john_profile_id uuid;
  charlie_profile_id uuid;
  klaus_profile_id uuid;
  juan_profile_id uuid;

  loop_camp_id uuid;
  loop_camp_start_date date;
  loop_session_id uuid;

  session_index integer;
  session_type_value public.session_type;
  session_date_value date;
  session_minutes integer;
  random_position integer;
begin
  select o.id
  into america_org_id
  from public.organizations o
  where o.slug = 'america-one-racing'
     or lower(o.name) = lower('America One Racing')
  order by case when o.slug = 'america-one-racing' then 0 else 1 end
  limit 1;

  if america_org_id is null then
    insert into public.organizations (name, slug, is_active)
    values ('America One Racing', 'america-one-racing', true)
    returning id into america_org_id;
  else
    update public.organizations
    set name = 'America One Racing',
        slug = 'america-one-racing',
        is_active = true
    where id = america_org_id;
  end if;

  select o.id
  into enard_org_id
  from public.organizations o
  where o.slug = 'enard-argentina'
     or lower(o.name) = lower('ENARD Argentina')
  order by case when o.slug = 'enard-argentina' then 0 else 1 end
  limit 1;

  if enard_org_id is null then
    insert into public.organizations (name, slug, is_active)
    values ('ENARD Argentina', 'enard-argentina', true)
    returning id into enard_org_id;
  else
    update public.organizations
    set name = 'ENARD Argentina',
        slug = 'enard-argentina',
        is_active = true
    where id = enard_org_id;
  end if;

  select t.id
  into usa31_team_id
  from public.teams t
  where t.organization_id = america_org_id
    and (t.slug = 'usa31-49er' or lower(t.name) = lower('USA31 49er'))
  limit 1;

  if usa31_team_id is null then
    insert into public.teams (organization_id, name, slug, team_type, is_active)
    values (america_org_id, 'USA31 49er', 'usa31-49er', '49er', true)
    returning id into usa31_team_id;
  else
    update public.teams
    set name = 'USA31 49er',
        slug = 'usa31-49er',
        team_type = '49er',
        is_active = true
    where id = usa31_team_id;
  end if;

  select t.id
  into arg49er_team_id
  from public.teams t
  where t.organization_id = enard_org_id
    and (t.slug = 'arg-49er' or lower(t.name) = lower('ARG 49er'))
  limit 1;

  if arg49er_team_id is null then
    insert into public.teams (organization_id, name, slug, team_type, is_active)
    values (enard_org_id, 'ARG 49er', 'arg-49er', '49er', true)
    returning id into arg49er_team_id;
  else
    update public.teams
    set name = 'ARG 49er',
        slug = 'arg-49er',
        team_type = '49er',
        is_active = true
    where id = arg49er_team_id;
  end if;

  insert into public.team_memberships (team_id, profile_id, role, is_active, left_at)
  values
    (usa31_team_id, (select p.id from public.profiles p where lower(p.email) = lower('ian.macdiarmid@sailog.test') limit 1), 'crew', true, null),
    (usa31_team_id, (select p.id from public.profiles p where lower(p.email) = lower('klaus.lange@sailog.test') limit 1), 'coach', true, null),
    (usa31_team_id, (select p.id from public.profiles p where lower(p.email) = lower('nevin.snow@sailog.test') limit 1), 'crew', true, null),
    (arg49er_team_id, (select p.id from public.profiles p where lower(p.email) = lower('klaus.lange@sailog.test') limit 1), 'coach', true, null),
    (arg49er_team_id, (select p.id from public.profiles p where lower(p.email) = lower('tadeo.funes@sailog.test') limit 1), 'crew', true, null),
    (arg49er_team_id, (select p.id from public.profiles p where lower(p.email) = lower('maximo.videla@sailog.test') limit 1), 'crew', true, null)
  on conflict (team_id, profile_id, role) do update
  set
    is_active = true,
    left_at = null;

  -- Requested test stack
  select o.id
  into test_org_id
  from public.organizations o
  where o.slug = 'test-organization'
     or lower(o.name) = lower('Test Organization')
  order by case when o.slug = 'test-organization' then 0 else 1 end
  limit 1;

  if test_org_id is null then
    insert into public.organizations (name, slug, is_active)
    values ('Test Organization', 'test-organization', true)
    returning id into test_org_id;
  else
    update public.organizations
    set name = 'Test Organization',
        slug = 'test-organization',
        is_active = true
    where id = test_org_id;
  end if;

  select t.id
  into test_team_id
  from public.teams t
  where t.organization_id = test_org_id
    and (t.slug = 'test-team' or lower(t.name) = lower('Test Team'))
  limit 1;

  if test_team_id is null then
    insert into public.teams (organization_id, name, slug, team_type, is_active)
    values (test_org_id, 'Test Team', 'test-team', '49er', true)
    returning id into test_team_id;
  else
    update public.teams
    set name = 'Test Team',
        slug = 'test-team',
        team_type = '49er',
        is_active = true
    where id = test_team_id;
  end if;

  select p.id
  into john_profile_id
  from public.profiles p
  where lower(p.email) = lower('john.doe@sailog.test')
  limit 1;

  select p.id
  into charlie_profile_id
  from public.profiles p
  where lower(p.email) = lower('charlie.brown@sailog.test')
  limit 1;

  select p.id
  into klaus_profile_id
  from public.profiles p
  where lower(p.email) = lower('klaus.lange@sailog.test')
  limit 1;

  select p.id
  into juan_profile_id
  from public.profiles p
  where lower(p.email) = lower('juan.badino@sailog.test')
     or (
      lower(coalesce(p.first_name, '')) = 'juan'
      and lower(coalesce(p.last_name, '')) = 'badino'
     )
  order by case when lower(coalesce(p.email, '')) = lower('juan.badino@sailog.test') then 0 else 1 end
  limit 1;

  if juan_profile_id is null then
    raise notice 'Juan Badino profile not found; skipped organization_admin membership for Test Organization.';
  else
    insert into public.organization_memberships (organization_id, profile_id, role)
    values (test_org_id, juan_profile_id, 'organization_admin')
    on conflict (organization_id, profile_id, role) do nothing;
  end if;

  insert into public.team_memberships (team_id, profile_id, role, is_active, left_at)
  values
    (test_team_id, john_profile_id, 'crew', true, null),
    (test_team_id, charlie_profile_id, 'crew', true, null),
    (test_team_id, klaus_profile_id, 'coach', true, null)
  on conflict (team_id, profile_id, role) do update
  set
    is_active = true,
    left_at = null;

  select v.id
  into test_venue_id
  from public.venues v
  where v.organization_id = test_org_id
    and lower(v.name) = lower('Palma Mallorca')
  limit 1;

  if test_venue_id is null then
    insert into public.venues (organization_id, name, city, country, is_active)
    values (test_org_id, 'Palma Mallorca', 'Palma', 'Spain', true)
    returning id into test_venue_id;
  else
    update public.venues
    set name = 'Palma Mallorca',
        city = 'Palma',
        country = 'Spain',
        is_active = true
    where id = test_venue_id;
  end if;

  insert into public.team_venues (team_id, venue_id, updated_at)
  values (test_team_id, test_venue_id, timezone('utc', now()))
  on conflict (team_id, venue_id) do update
  set updated_at = timezone('utc', now())
  returning id into test_team_venue_id;

  select c.id
  into arenal_camp_id
  from public.camps c
  where c.team_venue_id = test_team_venue_id
    and lower(c.name) = lower('Arenal Previa')
  limit 1;

  if arenal_camp_id is null then
    insert into public.camps (
      team_venue_id,
      name,
      camp_type,
      start_date,
      end_date,
      notes,
      is_active
    )
    values (
      test_team_venue_id,
      'Arenal Previa',
      'training',
      date '2026-03-16',
      date '2026-03-20',
      'Seeded camp for Test Team',
      true
    )
    returning id into arenal_camp_id;
  else
    update public.camps
    set
      camp_type = 'training',
      start_date = date '2026-03-16',
      end_date = date '2026-03-20',
      notes = 'Seeded camp for Test Team',
      is_active = true
    where id = arenal_camp_id;
  end if;

  select c.id
  into princesa_camp_id
  from public.camps c
  where c.team_venue_id = test_team_venue_id
    and lower(c.name) = lower('Princesa Sofia')
  limit 1;

  if princesa_camp_id is null then
    insert into public.camps (
      team_venue_id,
      name,
      camp_type,
      start_date,
      end_date,
      notes,
      is_active
    )
    values (
      test_team_venue_id,
      'Princesa Sofia',
      'regatta',
      date '2026-03-25',
      date '2026-03-29',
      'Seeded camp for Test Team',
      true
    )
    returning id into princesa_camp_id;
  else
    update public.camps
    set
      camp_type = 'regatta',
      start_date = date '2026-03-25',
      end_date = date '2026-03-29',
      notes = 'Seeded camp for Test Team',
      is_active = true
    where id = princesa_camp_id;
  end if;

  delete from public.session_regatta_results rr
  using public.sessions s
  where rr.session_id = s.id
    and s.camp_id in (arenal_camp_id, princesa_camp_id);

  delete from public.sessions s
  where s.camp_id in (arenal_camp_id, princesa_camp_id);

  foreach loop_camp_id in array array[arenal_camp_id, princesa_camp_id]
  loop
    if loop_camp_id = arenal_camp_id then
      loop_camp_start_date := date '2026-03-16';
    else
      loop_camp_start_date := date '2026-03-25';
    end if;

    for session_index in 1..10 loop
      session_date_value := loop_camp_start_date + ((session_index - 1) / 2);
      session_minutes := 60 + floor(random() * 61)::int;

      if session_index = 10 then
        session_type_value := 'regatta';
      else
        session_type_value := 'training';
      end if;

      insert into public.sessions (
        camp_id,
        session_type,
        session_date,
        net_time_minutes,
        highlighted_by_coach,
        coach_profile_id,
        weather_summary,
        notes
      )
      values (
        loop_camp_id,
        session_type_value,
        session_date_value,
        session_minutes,
        (session_index % 5 = 0),
        klaus_profile_id,
        'Seeded weather summary',
        'Seeded session'
      )
      returning id into loop_session_id;

      if session_type_value = 'regatta' then
        random_position := (array[1, 2, 3, 22])[1 + floor(random() * 4)::int];

        insert into public.session_regatta_results (
          session_id,
          race_number,
          fleet,
          position,
          points,
          result_notes
        )
        values (
          loop_session_id,
          session_index,
          'Open',
          random_position,
          null,
          'Seeded random result'
        )
        on conflict (session_id) do update
        set
          race_number = excluded.race_number,
          fleet = excluded.fleet,
          position = excluded.position,
          points = excluded.points,
          result_notes = excluded.result_notes,
          updated_at = timezone('utc', now());
      end if;
    end loop;
  end loop;
end $$;
