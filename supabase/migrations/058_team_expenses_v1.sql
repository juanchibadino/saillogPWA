-- 058_team_expenses_v1.sql
-- Team expenses v1: user-scoped expense tracking, team visibility setting,
-- currency snapshots, receipt storage, and venue/camp scope validation.

alter table public.organizations
  add column if not exists default_currency_code text not null default 'USD';

alter table public.organizations
  drop constraint if exists organizations_default_currency_code_check;

alter table public.organizations
  add constraint organizations_default_currency_code_check
  check (default_currency_code ~ '^[A-Z]{3}$');

alter table public.teams
  add column if not exists expenses_show_team_totals boolean not null default false;

do $$ begin
  create type public.expense_type as enum (
    'meals',
    'accommodation',
    'transport',
    'fuel',
    'marina_fees',
    'race_fees',
    'supplies',
    'gear',
    'coaching',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.expense_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency_code text not null,
  quote_currency_code text not null,
  rate_date date not null,
  source text not null,
  rate numeric(18,8) not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (base_currency_code, quote_currency_code, rate_date, source),
  check (base_currency_code ~ '^[A-Z]{3}$'),
  check (quote_currency_code ~ '^[A-Z]{3}$'),
  check (char_length(btrim(source)) > 0),
  check (rate > 0)
);

drop trigger if exists set_expense_exchange_rates_updated_at on public.expense_exchange_rates;
create trigger set_expense_exchange_rates_updated_at
before update on public.expense_exchange_rates
for each row
execute function public.set_updated_at();

create table if not exists public.team_expenses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  team_venue_id uuid not null references public.team_venues(id) on delete cascade,
  camp_id uuid references public.camps(id) on delete set null,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  expense_date date not null,
  expense_year integer generated always as (extract(year from expense_date)::integer) stored,
  vendor text not null,
  expense_type public.expense_type not null default 'other',
  description text,
  amount_local numeric(12,2) not null,
  currency_code text not null,
  organization_currency_code text not null,
  exchange_rate numeric(18,8) not null,
  exchange_rate_date date not null,
  exchange_rate_source text not null,
  amount_organization_currency numeric(12,2) not null,
  receipt_bucket text,
  receipt_storage_path text,
  receipt_file_name text,
  receipt_mime_type text,
  receipt_size_bytes bigint,
  receipt_thumbnail_bucket text,
  receipt_thumbnail_storage_path text,
  receipt_thumbnail_mime_type text,
  receipt_thumbnail_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(vendor)) > 0),
  check (amount_local > 0),
  check (currency_code ~ '^[A-Z]{3}$'),
  check (organization_currency_code ~ '^[A-Z]{3}$'),
  check (exchange_rate > 0),
  check (char_length(btrim(exchange_rate_source)) > 0),
  check (amount_organization_currency > 0),
  check (receipt_size_bytes is null or receipt_size_bytes >= 0),
  check (receipt_thumbnail_size_bytes is null or receipt_thumbnail_size_bytes >= 0),
  check (
    (
      receipt_bucket is null
      and receipt_storage_path is null
      and receipt_file_name is null
      and receipt_mime_type is null
      and receipt_size_bytes is null
      and receipt_thumbnail_bucket is null
      and receipt_thumbnail_storage_path is null
      and receipt_thumbnail_mime_type is null
      and receipt_thumbnail_size_bytes is null
    )
    or (
      receipt_bucket is not null
      and receipt_storage_path is not null
      and receipt_file_name is not null
      and receipt_mime_type = 'image/webp'
      and receipt_size_bytes is not null
      and receipt_thumbnail_bucket is not null
      and receipt_thumbnail_storage_path is not null
      and receipt_thumbnail_mime_type = 'image/webp'
      and receipt_thumbnail_size_bytes is not null
    )
  )
);

create index if not exists team_expenses_team_year_date_idx
  on public.team_expenses (team_id, expense_year, expense_date desc, created_at desc);

create index if not exists team_expenses_team_owner_year_idx
  on public.team_expenses (team_id, created_by_profile_id, expense_year, expense_date desc);

create index if not exists team_expenses_team_venue_year_idx
  on public.team_expenses (team_venue_id, expense_year, expense_date desc);

create index if not exists team_expenses_camp_idx
  on public.team_expenses (camp_id)
  where camp_id is not null;

create index if not exists team_expenses_receipt_storage_idx
  on public.team_expenses (receipt_bucket, receipt_storage_path)
  where receipt_storage_path is not null;

drop trigger if exists set_team_expenses_updated_at on public.team_expenses;
create trigger set_team_expenses_updated_at
before update on public.team_expenses
for each row
execute function public.set_updated_at();

create or replace function public.can_view_team_expense(target_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        public.can_read_team_scope(te.team_id)
        and (
          te.created_by_profile_id = auth.uid()
          or exists (
            select 1
            from public.teams t
            where t.id = te.team_id
              and t.expenses_show_team_totals
          )
        )
      from public.team_expenses te
      where te.id = target_expense_id
      limit 1
    ),
    false
  );
$$;

create or replace function public.can_manage_team_expense(target_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        public.can_manage_team_sessions(te.team_id)
        and (
          te.created_by_profile_id = auth.uid()
          or public.can_manage_team_structure(te.team_id)
        )
      from public.team_expenses te
      where te.id = target_expense_id
      limit 1
    ),
    false
  );
$$;

create or replace function public.validate_team_expense_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  venue_team_id uuid;
  camp_team_venue_id uuid;
  org_currency text;
begin
  select tv.team_id
  into venue_team_id
  from public.team_venues tv
  where tv.id = new.team_venue_id
  limit 1;

  if venue_team_id is null or venue_team_id <> new.team_id then
    raise exception 'Expense venue must belong to the expense team.';
  end if;

  if new.camp_id is not null then
    select c.team_venue_id
    into camp_team_venue_id
    from public.camps c
    where c.id = new.camp_id
    limit 1;

    if camp_team_venue_id is null or camp_team_venue_id <> new.team_venue_id then
      raise exception 'Expense camp must belong to the selected team venue.';
    end if;
  end if;

  select o.default_currency_code
  into org_currency
  from public.teams t
  join public.organizations o on o.id = t.organization_id
  where t.id = new.team_id
  limit 1;

  if org_currency is not null and new.organization_currency_code <> org_currency then
    raise exception 'Expense organization currency must match organization settings.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_team_expense_scope on public.team_expenses;
create trigger validate_team_expense_scope
before insert or update on public.team_expenses
for each row
execute function public.validate_team_expense_scope();

alter table public.expense_exchange_rates enable row level security;
alter table public.team_expenses enable row level security;

drop policy if exists expense_exchange_rates_select_authenticated on public.expense_exchange_rates;
create policy expense_exchange_rates_select_authenticated
on public.expense_exchange_rates
for select
to authenticated
using (true);

drop policy if exists expense_exchange_rates_insert_authenticated on public.expense_exchange_rates;
create policy expense_exchange_rates_insert_authenticated
on public.expense_exchange_rates
for insert
to authenticated
with check (true);

drop policy if exists expense_exchange_rates_update_authenticated on public.expense_exchange_rates;
create policy expense_exchange_rates_update_authenticated
on public.expense_exchange_rates
for update
to authenticated
using (true)
with check (true);

drop policy if exists team_expenses_select_visible_scope on public.team_expenses;
create policy team_expenses_select_visible_scope
on public.team_expenses
for select
using (
  public.can_read_team_scope(team_id)
  and (
    created_by_profile_id = auth.uid()
    or exists (
      select 1
      from public.teams t
      where t.id = team_expenses.team_id
        and t.expenses_show_team_totals
    )
  )
);

drop policy if exists team_expenses_insert_own_team_sessions on public.team_expenses;
create policy team_expenses_insert_own_team_sessions
on public.team_expenses
for insert
with check (
  public.can_manage_team_sessions(team_id)
  and created_by_profile_id = auth.uid()
);

drop policy if exists team_expenses_update_owner_or_structure_manager on public.team_expenses;
create policy team_expenses_update_owner_or_structure_manager
on public.team_expenses
for update
using (
  public.can_manage_team_sessions(team_id)
  and (
    created_by_profile_id = auth.uid()
    or public.can_manage_team_structure(team_id)
  )
)
with check (
  public.can_manage_team_sessions(team_id)
  and (
    created_by_profile_id = auth.uid()
    or public.can_manage_team_structure(team_id)
  )
);

drop policy if exists team_expenses_delete_owner_or_structure_manager on public.team_expenses;
create policy team_expenses_delete_owner_or_structure_manager
on public.team_expenses
for delete
using (
  public.can_manage_team_sessions(team_id)
  and (
    created_by_profile_id = auth.uid()
    or public.can_manage_team_structure(team_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  2097152,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists expense_receipts_storage_select_visible_scope on storage.objects;
create policy expense_receipts_storage_select_visible_scope
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expense-receipts'
  and name ~ '^expenses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(receipt|thumbnail)/.+$'
  and public.can_view_team_expense(split_part(name, '/', 3)::uuid)
);

drop policy if exists expense_receipts_storage_insert_manage_scope on storage.objects;
create policy expense_receipts_storage_insert_manage_scope
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expense-receipts'
  and name ~ '^expenses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(receipt|thumbnail)/.+$'
  and public.can_manage_team_expense(split_part(name, '/', 3)::uuid)
);

drop policy if exists expense_receipts_storage_update_manage_scope on storage.objects;
create policy expense_receipts_storage_update_manage_scope
on storage.objects
for update
to authenticated
using (
  bucket_id = 'expense-receipts'
  and name ~ '^expenses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(receipt|thumbnail)/.+$'
  and public.can_manage_team_expense(split_part(name, '/', 3)::uuid)
)
with check (
  bucket_id = 'expense-receipts'
  and name ~ '^expenses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(receipt|thumbnail)/.+$'
  and public.can_manage_team_expense(split_part(name, '/', 3)::uuid)
);

drop policy if exists expense_receipts_storage_delete_manage_scope on storage.objects;
create policy expense_receipts_storage_delete_manage_scope
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expense-receipts'
  and name ~ '^expenses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(receipt|thumbnail)/.+$'
  and public.can_manage_team_expense(split_part(name, '/', 3)::uuid)
);
