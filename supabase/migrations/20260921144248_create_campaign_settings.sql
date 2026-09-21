create table if not exists public.campaign_settings (
  id text primary key check (id = 'courses_2026'),
  enrollment_deadline timestamptz not null,
  countdown_enabled boolean not null default true,
  timezone text not null default 'America/Rio_Branco',
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.campaign_settings enable row level security;
revoke all on public.campaign_settings from anon, authenticated;

insert into public.campaign_settings (id, enrollment_deadline, countdown_enabled, timezone)
values ('courses_2026', '2026-09-27T04:00:00Z', true, 'America/Rio_Branco')
on conflict (id) do nothing;

comment on table public.campaign_settings is 'Configuração privada da campanha exposta somente por Edge Function sanitizada.';
