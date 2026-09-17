alter table public.registrations
  drop constraint if exists registrations_cnpj_check,
  drop constraint if exists registrations_owner_phone_check,
  add constraint registrations_cnpj_check check (cnpj ~ '^[0-9]{14}$'),
  add constraint registrations_owner_phone_check check (owner_phone ~ '^[0-9]{10,11}$');

alter table public.participants
  drop constraint if exists participants_cpf_check,
  drop constraint if exists participants_phone_check,
  add constraint participants_cpf_check check (cpf ~ '^[0-9]{11}$'),
  add constraint participants_phone_check check (phone ~ '^[0-9]{10,11}$');
