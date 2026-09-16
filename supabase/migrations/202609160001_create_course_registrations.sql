create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 2 and 160),
  cnpj text not null check (cnpj ~ '^\\d{14}$'),
  owner_name text not null check (char_length(owner_name) between 2 and 160),
  owner_email text not null,
  owner_phone text not null check (owner_phone ~ '^\\d{10,11}$'),
  amount_cents integer not null default 87255 check (amount_cents = 87255),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','payment_pending','paid','failed','cancelled','refunded')),
  mercado_pago_preference_id text,
  mercado_pago_payment_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  full_name text not null check (char_length(full_name) between 2 and 160),
  cpf text not null check (cpf ~ '^\\d{11}$'),
  email text not null,
  phone text not null check (phone ~ '^\\d{10,11}$'),
  created_at timestamptz not null default now(),
  unique (registration_id, slot)
);

create index registrations_status_idx on public.registrations(status);
create index participants_registration_id_idx on public.participants(registration_id);

create or replace function public.enforce_campaign_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('cpusis-cursos-2026-capacity'));
  if (select count(*) from public.registrations where status in ('pending_payment','payment_pending','paid')) >= 40 then
    raise exception 'As 40 vagas desta campanha já foram preenchidas.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger registrations_capacity_before_insert
before insert on public.registrations
for each row execute function public.enforce_campaign_capacity();

alter table public.registrations enable row level security;
alter table public.participants enable row level security;

revoke all on public.registrations from anon, authenticated;
revoke all on public.participants from anon, authenticated;
revoke all on function public.enforce_campaign_capacity() from public, anon, authenticated;

comment on table public.registrations is 'Inscrições empresariais do pacote CPUSIS; acesso somente por funções administrativas.';
comment on table public.participants is 'Os dois funcionários vinculados a cada inscrição empresarial.';
